package io.mrkuhne.mezo.feature.companion.profile.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.feedback.entity.FeedbackRollupEntity;
import io.mrkuhne.mezo.feature.companion.feedback.repository.FeedbackRollupRepository;
import io.mrkuhne.mezo.feature.companion.feedback.service.FeedbackLearningService;
import io.mrkuhne.mezo.feature.companion.graph.entity.GraphNodeEntity;
import io.mrkuhne.mezo.feature.companion.graph.repository.GraphNodeRepository;
import io.mrkuhne.mezo.feature.companion.llm.FakeCompanionLlm;
import io.mrkuhne.mezo.feature.companion.profile.entity.ProfileMetaEnvelope;
import io.mrkuhne.mezo.feature.journal.entity.DecisionEntryEntity;
import io.mrkuhne.mezo.feature.journal.repository.DecisionEntryRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.FeedbackPopulator;
import io.mrkuhne.mezo.support.populator.JournalPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.LocalDate;
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
    private UserPopulator userPopulator;
    @Autowired
    private FeedbackLearningService feedbackLearningService;
    @Autowired
    private FakeCompanionLlm fakeCompanionLlm;

    private UUID seedOwner() {
        return userPopulator.createUser("profile-assembler@test.local").getId();
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

        Optional<UUID> nodeId = assembler.rebuild(owner);

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

        UUID first = assembler.rebuild(owner).orElseThrow();
        UUID second = assembler.rebuild(owner).orElseThrow();

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
        UUID nodeId = assembler.rebuild(owner).orElseThrow();
        GraphNodeEntity archived = nodeRepository.findById(nodeId).orElseThrow();
        archived.setStatus(GraphNodeEntity.STATUS_ARCHIVED);
        nodeRepository.saveAndFlush(archived);

        assembler.rebuild(owner);

        assertThat(nodeRepository.findById(nodeId).orElseThrow().getStatus())
                .isEqualTo(GraphNodeEntity.STATUS_ACTIVE);
    }

    @Test
    void no_signal_means_no_profile_and_no_llm_call() {
        UUID owner = seedOwner();
        long before = fakeCompanionLlm.completeCallCount();

        assertThat(assembler.rebuild(owner)).isEmpty();

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

        UUID nodeId = assembler.rebuild(owner).orElseThrow();

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

        UUID nodeId = assembler.rebuild(owner).orElseThrow();

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

        String payload = assembler.renderPayload(rollups, decisions, List.of());

        assertThat(payload).contains("VISSZAJELZÉSEK (utolsó 30 nap):");
        assertThat(payload).contains("surface:chat_message: 1 tetszik / 1 nem tetszik");
        assertThat(payload).contains("ELUTASÍTÁS OKAI:");
        assertThat(payload).contains("chat_message: pontatlan 0 · túl sok 1 · rossz időzítés 0 · nem rólam szól 0");
    }
}
