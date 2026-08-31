package io.mrkuhne.mezo.feature.companion.profile.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.feedback.config.FeedbackLearningProperties;
import io.mrkuhne.mezo.feature.companion.feedback.entity.FeedbackRollupEntity;
import io.mrkuhne.mezo.feature.companion.feedback.entity.FeedbackRollupStatsEnvelope;
import io.mrkuhne.mezo.feature.companion.feedback.repository.FeedbackRollupRepository;
import io.mrkuhne.mezo.feature.companion.feedback.service.FeedbackLearningService;
import io.mrkuhne.mezo.feature.companion.graph.entity.GraphNodeEntity;
import io.mrkuhne.mezo.feature.companion.graph.repository.GraphNodeRepository;
import io.mrkuhne.mezo.feature.companion.llm.FakeCompanionLlm;
import io.mrkuhne.mezo.feature.companion.profile.entity.ProfileMetaEnvelope;
import io.mrkuhne.mezo.feature.companion.quarterly.service.Quarters;
import io.mrkuhne.mezo.feature.journal.entity.DecisionEntryEntity;
import io.mrkuhne.mezo.feature.journal.repository.DecisionEntryRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.FeedbackPopulator;
import io.mrkuhne.mezo.support.populator.GraphPopulator;
import io.mrkuhne.mezo.support.populator.JournalPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Limit;
import org.springframework.test.context.ActiveProfiles;

/**
 * W4.3 (mezo-b3pp.17, spec §8.3): the weekly profile synthesis.
 *
 * <p>Package-scoped alongside {@link ProfileAssembler} (not {@code ...profile}, where the sibling
 * {@code ProfileSourceFindersIT} lives) deliberately: the review-fix pass (mezo-b3pp.17 review)
 * needs a DIRECT assertion on {@link ProfileAssembler#renderPayload}, which is package-private on
 * purpose so a test can call it without a public seam existing only for tests.
 */
@ActiveProfiles("companion-fake")
class ProfileAssemblerIT extends AbstractIntegrationTest {

    @Autowired
    private ProfileAssembler assembler;
    @Autowired
    private GraphNodeRepository nodeRepository;
    @Autowired
    private FeedbackRollupRepository rollupRepository;
    @Autowired
    private DecisionEntryRepository decisionRepository;
    @Autowired
    private FeedbackPopulator feedbackPopulator;
    @Autowired
    private JournalPopulator journalPopulator;
    @Autowired
    private GraphPopulator graphPopulator;
    @Autowired
    private UserPopulator userPopulator;
    @Autowired
    private FeedbackLearningService feedbackLearningService;
    @Autowired
    private FakeCompanionLlm fakeCompanionLlm;
    @Autowired
    private FeedbackLearningProperties feedbackLearningProperties;

    private UUID seedOwner() {
        return userPopulator.createUser("profile-assembler@test.local").getId();
    }

    /**
     * The anchor the WEEKLY job passes — the quarter the clock is standing in. Every test below
     * that is not about the anchor itself uses it, so those tests keep pinning exactly the
     * behaviour they pinned before the anchor became an explicit {@link ProfileAssembler#rebuild}
     * argument (mezo-b3pp.20 final review, F1).
     */
    private static LocalDate currentQuarter() {
        return Quarters.startOf(LocalDate.now());
    }

    /**
     * Seeds one up verdict AND one down-with-reason verdict, then runs the REAL {@code
     * FeedbackLearningService} rollup job — the assembler reads {@code feedback_rollup}, never
     * {@code message_feedback} directly, so a test that only writes verdicts and skips this call
     * leaves {@code feedbackSignals()} permanently at zero (review finding: this was previously the
     * case, and the whole VISSZAJELZÉSEK / ELUTASÍTÁS OKAI payload rendering went untested).
     */
    private void seedSignal(UUID owner) {
        feedbackPopulator.createVerdict(owner, "chat_message", UUID.randomUUID(), "up", null);
        feedbackPopulator.createVerdict(owner, "chat_message", UUID.randomUUID(), "down", "too_much");
        journalPopulator.createReviewedDecision(
                owner, LocalDate.of(2026, 6, 1), "Heti 3 edzés", 4, "Bevált.");
        feedbackLearningService.computeRollups(owner);
    }

    @Test
    void writes_the_singleton_profile_node_keyed_by_the_user() {
        UUID owner = seedOwner();
        seedSignal(owner);

        Optional<UUID> nodeId = assembler.rebuild(owner, currentQuarter());

        assertThat(nodeId).isPresent();
        GraphNodeEntity node = nodeRepository.findById(nodeId.orElseThrow()).orElseThrow();
        assertThat(node.getKind()).isEqualTo(GraphNodeEntity.KIND_INSIGHT);
        assertThat(node.getSourceKind()).isEqualTo(ProfileAssembler.SOURCE_PROFILE);
        assertThat(node.getSourceId()).isEqualTo(owner);
        assertThat(node.getTitle()).isEqualTo(ProfileAssembler.PROFILE_TITLE);
        assertThat(node.getStatus()).isEqualTo(GraphNodeEntity.STATUS_ACTIVE);
        assertThat(node.getSummary()).isNotBlank();
        // Review fix (mezo-b3pp.17): the meta envelope written at ProfileAssembler:112-113 was the
        // slice's only behaviour nothing would catch if broken — nothing reads meta.profile back
        // in production or tests. Pin it directly: one up + one down verdict roll up to a single
        // "surface:chat_message" effectiveness row (total = 2), seedSignal() reviews exactly one
        // decision, and no graph nodes are seeded here.
        @SuppressWarnings("unchecked")
        Map<String, Object> meta = (Map<String, Object>) node.getMeta().get(ProfileMetaEnvelope.META_KEY);
        assertThat(meta).isNotNull();
        assertThat(meta.get("feedbackSignals")).isEqualTo(2);
        assertThat(meta.get("reviewedDecisions")).isEqualTo(1);
        assertThat(meta.get("graphNodes")).isEqualTo(0);
        assertThat(meta.get("generatedAt")).isNotNull();
    }

    @Test
    void rerunning_updates_the_same_row_instead_of_adding_a_second_one() {
        UUID owner = seedOwner();
        seedSignal(owner);

        UUID first = assembler.rebuild(owner, currentQuarter()).orElseThrow();
        UUID second = assembler.rebuild(owner, currentQuarter()).orElseThrow();

        assertThat(second).isEqualTo(first);
        assertThat(nodeRepository.findByCreatedByAndStatusAndDeletedFalseOrderByCreatedAtDesc(
                owner, GraphNodeEntity.STATUS_ACTIVE))
                .filteredOn(n -> ProfileAssembler.SOURCE_PROFILE.equals(n.getSourceKind()))
                .hasSize(1);
    }

    @Test
    void an_archived_profile_is_revived_by_the_next_run() {
        UUID owner = seedOwner();
        seedSignal(owner);
        UUID nodeId = assembler.rebuild(owner, currentQuarter()).orElseThrow();
        GraphNodeEntity archived = nodeRepository.findById(nodeId).orElseThrow();
        archived.setStatus(GraphNodeEntity.STATUS_ARCHIVED);
        nodeRepository.saveAndFlush(archived);

        assembler.rebuild(owner, currentQuarter());

        assertThat(nodeRepository.findById(nodeId).orElseThrow().getStatus())
                .isEqualTo(GraphNodeEntity.STATUS_ACTIVE);
    }

    @Test
    void no_signal_means_no_profile_and_no_llm_call() {
        UUID owner = seedOwner();
        long before = fakeCompanionLlm.completeCallCount();

        assertThat(assembler.rebuild(owner, currentQuarter())).isEmpty();

        assertThat(fakeCompanionLlm.completeCallCount()).isEqualTo(before);
        assertThat(nodeRepository.findByCreatedByAndSourceKindAndSourceIdAndDeletedFalse(
                owner, ProfileAssembler.SOURCE_PROFILE, owner)).isEmpty();
    }

    /**
     * The IT-level cap assertion below only proves the SIZE of what got stored — the fake's
     * profile answer is a fixed ~130-char string, so it would pass even if {@link
     * ProfileAssembler#cap} were deleted entirely (review finding). The cap logic itself
     * (boundary, no-space text) is unit-tested directly in {@link ProfileAssemblerCapTest}; this
     * test only pins that the STORED summary never exceeds the configured budget end to end.
     */
    @Test
    void the_stored_prose_is_capped_at_the_configured_token_budget() {
        UUID owner = seedOwner();
        seedSignal(owner);

        UUID nodeId = assembler.rebuild(owner, currentQuarter()).orElseThrow();

        assertThat(nodeRepository.findById(nodeId).orElseThrow().getSummary().length())
                .isLessThanOrEqualTo(400 * 3);
    }

    /**
     * Review fix (mezo-b3pp.17): the old version of this test only pinned {@link
     * ProfileAssembler#PROFILE_MARKER} against the literal, never touching {@code
     * FakeCompanionLlm}'s private {@code PROFILE_MARKER_MIRROR}. If the mirror drifted, the fake's
     * fallthrough would return a non-blank prompt ECHO instead of the scripted profile prose, and
     * {@code assertThat(node.getSummary()).isNotBlank()} in the test above would still pass on
     * garbage. Asserting a distinctive fragment of the fake's known profile answer makes mirror
     * drift fail loudly instead of silently.
     */
    @Test
    void the_fake_llm_mirror_still_matches_the_marker() {
        assertThat(ProfileAssembler.PROFILE_MARKER).isEqualTo("ROLAD-TANULTAM");

        UUID owner = seedOwner();
        seedSignal(owner);

        UUID nodeId = assembler.rebuild(owner, currentQuarter()).orElseThrow();

        assertThat(nodeRepository.findById(nodeId).orElseThrow().getSummary())
                .contains("rövid, konkrét reggeli üzenet válik be nálad");
    }

    /**
     * Review fix (mezo-b3pp.17): a DIRECT assertion on the package-private {@link
     * ProfileAssembler#renderPayload}, fed the REAL rollup rows a completed {@code
     * computeRollups(...)} run wrote — proving the VISSZAJELZÉSEK and ELUTASÍTÁS OKAI blocks are
     * genuinely wired to {@code feedback_rollup}, not just structurally present with dead inputs.
     */
    @Test
    void renderPayload_carries_real_effectiveness_and_style_lines_from_computed_rollups() {
        UUID owner = seedOwner();
        seedSignal(owner);
        List<FeedbackRollupEntity> rollups = rollupRepository.findByCreatedByAndDeletedFalseOrderByScopeAsc(owner);
        List<DecisionEntryEntity> decisions = decisionRepository
                .findByCreatedByAndReviewedAtIsNotNullAndDeletedFalseOrderByReviewedAtDesc(owner, Limit.of(10));

        String payload = assembler.renderPayload(owner, currentQuarter(), rollups, decisions, List.of());

        assertThat(payload).contains("VISSZAJELZÉSEK (utolsó 30 nap):");
        assertThat(payload).contains("surface:chat_message: 1 tetszik / 1 nem tetszik");
        assertThat(payload).contains("ELUTASÍTÁS OKAI:");
        assertThat(payload).contains("chat_message: pontatlan 0 · túl sok 1 · rossz időzítés 0 · nem rólam szól 0");
    }

    /**
     * W5.3 (mezo-b3pp.20): seeds a reviewed decision with an explicit {@code reviewedAt} so the
     * decision-quality trend's quarter window (keyed by REVIEW time, not {@code decidedOn}) can be
     * pinned deterministically — {@code decidedOn} doubles as the review instant here purely to
     * place the row inside a specific calendar quarter for the test.
     */
    private void reviewedDecision(UUID owner, LocalDate decidedOn, short rating) {
        Instant reviewedAt = decidedOn.atStartOfDay(ZoneId.systemDefault()).toInstant();
        journalPopulator.createReviewedDecision(owner, decidedOn, "Döntés", rating, "Eredmény", reviewedAt);
    }

    /**
     * Same idiom as {@link #renderPayload_carries_real_effectiveness_and_style_lines_from_computed_rollups}
     * above: {@link ProfileAssembler#renderPayload} is package-private exactly so a test can call
     * it directly with the real rows, no {@code rebuild} (and no LLM call) required.
     */
    private String lastPayloadFor(UUID owner) {
        List<FeedbackRollupEntity> rollups = rollupRepository.findByCreatedByAndDeletedFalseOrderByScopeAsc(owner);
        List<DecisionEntryEntity> decisions = decisionRepository
                .findByCreatedByAndReviewedAtIsNotNullAndDeletedFalseOrderByReviewedAtDesc(owner, Limit.of(10));
        return assembler.renderPayload(owner, currentQuarter(), rollups, decisions, List.of());
    }

    /**
     * W5.3 (mezo-b3pp.20): the decision-quality trend compares two independently reviewed
     * quarters — two ratings this quarter (mean 4.5) against one last quarter (2.0) — proving the
     * arithmetic (mean, count, quarter windowing via {@link Quarters}) is genuinely per-quarter and
     * not, say, an all-time average mislabeled as two lines.
     */
    @Test
    void renderPayload_compares_this_quarter_against_the_previous_one_when_both_have_reviewed_decisions() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate thisQuarter = LocalDate.now();
        LocalDate lastQuarter = Quarters.previous(Quarters.startOf(thisQuarter)).plusDays(10);
        // two reviewed decisions this quarter (4 and 5), one last quarter (2)
        reviewedDecision(owner, thisQuarter, (short) 4);
        reviewedDecision(owner, thisQuarter, (short) 5);
        reviewedDecision(owner, lastQuarter, (short) 2);

        String payload = lastPayloadFor(owner);

        assertThat(payload).contains("DÖNTÉSI MINŐSÉG:")
                .contains("ez a negyedév: 4,5/5 (2 értékelt döntés)")
                .contains("előző negyedév: 2,0/5 (1 értékelt döntés)");
    }

    /**
     * W5.3 (mezo-b3pp.20): honest absence, first half — a quarter with nothing reviewed
     * contributes no line, so a lone current-quarter rating renders without a dangling "előző
     * negyedév" line for a quarter that has no data behind it.
     */
    @Test
    void renderPayload_omits_the_previous_quarter_line_when_it_has_no_reviewed_decisions() {
        UUID owner = userPopulator.createUser().getId();
        reviewedDecision(owner, LocalDate.now(), (short) 3);

        String payload = lastPayloadFor(owner);

        assertThat(payload).contains("ez a negyedév: 3,0/5 (1 értékelt döntés)")
                .doesNotContain("előző negyedév");
    }

    /**
     * W5.3 (mezo-b3pp.20): honest absence, second half — with NOTHING reviewed this quarter the
     * whole section stays out, even though the user has other signal (a graph node) that would
     * otherwise make the payload non-empty. Rendering "0,0/5" here would read to the model as
     * terrible judgement rather than as no data — this is the bug the omission rule prevents.
     */
    @Test
    void renderPayload_omits_the_whole_section_when_nothing_is_reviewed_this_quarter() {
        UUID owner = userPopulator.createUser().getId();
        graphPopulator.createNode(owner, GraphNodeEntity.KIND_PATTERN, "Késői evés rontja az alvást");

        assertThat(lastPayloadFor(owner)).doesNotContain("DÖNTÉSI MINŐSÉG");
    }

    /**
     * Review fix (mezo-b3pp.20): {@code Between} is inclusive at BOTH ends, so a decision reviewed
     * at exactly the current quarter's first instant used to land in BOTH windows — the previous
     * window's exclusive-in-intent upper bound IS the current quarter's start instant. Pins the
     * half-open fix ({@code GreaterThanEqual}/{@code LessThan}): a decision reviewed at that exact
     * boundary counts ONLY in the current quarter's line, never in the previous one's. A second row
     * is seeded in the previous quarter purely so both lines render and both counts can be asserted
     * — that way this test fails under the old query on ANY day of the year, not only when run on a
     * real quarter start.
     */
    /**
     * Review fix (mezo-b3pp.20 final review, F1): the trend window follows the ANCHOR quarter
     * handed to {@link ProfileAssembler#rebuild}/{@link ProfileAssembler#renderPayload}, NOT the
     * calendar quarter the clock happens to be in.
     *
     * <p>This is the quarterly job's own case: it anchors on the quarter that JUST FINISHED, so
     * "ez a negyedév" must name THAT quarter and "előző negyedév" the one before it. Everything
     * seeded here sits in those two quarters and NOTHING in the quarter the clock is standing in,
     * which is what makes this fail against the old now()-derived window on EVERY day of the year
     * rather than only on a quarter boundary: with no reviewed decision in the current quarter,
     * {@code decisionQuality}'s "a lone historical line is not a trend" rule dropped the whole
     * {@code DÖNTÉSI MINŐSÉG} section — exactly the silent loss that hit the profile prose at
     * 04:00 on Jan 1.
     */
    @Test
    void renderPayload_windows_the_trend_on_the_anchor_quarter_not_on_todays_quarter() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate anchor = Quarters.previous(currentQuarter());          // a FINISHED quarter
        reviewedDecision(owner, anchor.plusDays(10), (short) 5);
        reviewedDecision(owner, anchor.plusDays(20), (short) 4);
        reviewedDecision(owner, Quarters.previous(anchor).plusDays(10), (short) 1);

        List<FeedbackRollupEntity> rollups = rollupRepository.findByCreatedByAndDeletedFalseOrderByScopeAsc(owner);
        List<DecisionEntryEntity> decisions = decisionRepository
                .findByCreatedByAndReviewedAtIsNotNullAndDeletedFalseOrderByReviewedAtDesc(owner, Limit.of(10));
        String payload = assembler.renderPayload(owner, anchor, rollups, decisions, List.of());

        assertThat(payload).contains("DÖNTÉSI MINŐSÉG:")
                .contains("ez a negyedév: 4,5/5 (2 értékelt döntés)")
                .contains("előző negyedév: 1,0/5 (1 értékelt döntés)");
    }

    @Test
    void renderPayload_counts_a_decision_reviewed_at_the_exact_quarter_boundary_only_once() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate quarterStart = Quarters.startOf(LocalDate.now());
        LocalDate previousQuarterDay = Quarters.previous(quarterStart).plusDays(5);
        reviewedDecision(owner, quarterStart, (short) 4);       // reviewedAt == exact quarter-start instant
        reviewedDecision(owner, previousQuarterDay, (short) 2);

        String payload = lastPayloadFor(owner);

        assertThat(payload).contains("ez a negyedév: 4,0/5 (1 értékelt döntés)")
                .contains("előző negyedév: 2,0/5 (1 értékelt döntés)");
    }

    /** A rollup row saved directly (bypassing the real job) so a "retired window" can coexist
     *  with the live one for the same scope — {@link FeedbackLearningService} always writes the
     *  CURRENT config's {@code windowDays}, so this is the only way to get two in one test. */
    private FeedbackRollupEntity rollupRow(UUID owner, String scope, int windowDays, int up, int down) {
        FeedbackRollupEntity e = new FeedbackRollupEntity();
        e.setCreatedBy(owner);
        e.setScope(scope);
        e.setWindowDays(windowDays);
        e.setStats(FeedbackRollupStatsEnvelope.effectiveness(up, down));
        e.setComputedAt(Instant.now());
        return rollupRepository.saveAndFlush(e);
    }

    /**
     * mezo-b3pp.35 (item 3, the real latent bug): {@code feedback_rollup}'s unique key is
     * {@code (created_by, scope, window_days)} and NOTHING deletes a retired window's rows — after
     * a {@code feedback-learning.window-days} config change, the OLD window's row for a scope
     * genuinely coexists with the new one. Reading unfiltered (the pre-fix behaviour) would emit
     * TWO contradictory "surface:chat_message" lines here; filtered to the configured window it
     * must emit exactly one, and it must be the LIVE window's numbers, not the retired one's.
     */
    @Test
    void renderPayload_readsOnlyTheConfiguredWindow_whenRetiredWindowRowsExist() {
        UUID owner = seedOwner();
        seedSignal(owner);   // real job run — writes surface:chat_message at the CONFIGURED windowDays
        // a retired window's row for the SAME scope, left behind by a past config change
        rollupRow(owner, FeedbackRollupEntity.SCOPE_SURFACE_PREFIX + "chat_message", 14, 9, 9);

        List<FeedbackRollupEntity> rollups = rollupRepository
                .findByCreatedByAndWindowDaysAndDeletedFalseOrderByScopeAsc(owner, feedbackLearningProperties.windowDays());
        List<DecisionEntryEntity> decisions = decisionRepository
                .findByCreatedByAndReviewedAtIsNotNullAndDeletedFalseOrderByReviewedAtDesc(owner, Limit.of(10));

        String payload = assembler.renderPayload(owner, currentQuarter(), rollups, decisions, List.of());

        assertThat(payload).containsOnlyOnce("surface:chat_message:");
        assertThat(payload).contains("surface:chat_message: 1 tetszik / 1 nem tetszik");
        assertThat(payload).doesNotContain("9 tetszik");
    }

    /**
     * mezo-b3pp.35 (item 4, double counting): {@code surface:*} is the complete, non-overlapping
     * partition of every verdict, while {@code feed:*} is a REFINEMENT of a subset of it — a
     * {@code feed_message} verdict lands in both {@code surface:feed_message} AND its
     * {@code feed:<kind>} row. {@code feedbackSignals} must equal the {@code surface:*} total
     * alone, never the sum across every scope (which would double-count this exact case).
     */
    @Test
    void feedbackSignals_countsEachVerdictOnce_whenAFeedMessageIsRolledUpTwice() {
        UUID owner = seedOwner();
        int windowDays = feedbackLearningProperties.windowDays();
        rollupRow(owner, FeedbackRollupEntity.SCOPE_SURFACE_PREFIX + "feed_message", windowDays, 3, 2);
        rollupRow(owner, FeedbackRollupEntity.SCOPE_FEED_PREFIX + "morning", windowDays, 3, 2);

        UUID nodeId = assembler.rebuild(owner, currentQuarter()).orElseThrow();

        @SuppressWarnings("unchecked")
        Map<String, Object> meta = (Map<String, Object>) nodeRepository.findById(nodeId).orElseThrow()
                .getMeta().get(ProfileMetaEnvelope.META_KEY);
        // surface:feed_message alone (3 + 2 = 5) — NOT surface + feed (5 + 5 = 10)
        assertThat(meta.get("feedbackSignals")).isEqualTo(5);
    }
}
