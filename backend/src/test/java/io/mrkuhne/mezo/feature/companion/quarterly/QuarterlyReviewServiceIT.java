package io.mrkuhne.mezo.feature.companion.quarterly;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.entity.PeriodSummaryEntity;
import io.mrkuhne.mezo.feature.companion.graph.entity.GraphNodeEntity;
import io.mrkuhne.mezo.feature.companion.graph.repository.GraphNodeRepository;
import io.mrkuhne.mezo.feature.companion.llm.FakeCompanionLlm;
import io.mrkuhne.mezo.feature.companion.quarterly.service.QuarterlyReviewService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.PeriodSummaryPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

/**
 * W5.3 (mezo-b3pp.20, spec §9.3) — the quarterly pass proposes, never activates (IDENT-6), pays
 * for nothing when there is nothing to compare, and never re-proposes a quarter it already
 * touched (the W2.3 day-gate idiom, one rung up).
 */
@ActiveProfiles("companion-fake")
class QuarterlyReviewServiceIT extends AbstractIntegrationTest {

    private static final LocalDate Q3 = LocalDate.of(2026, 7, 1);
    private static final LocalDate Q2 = LocalDate.of(2026, 4, 1);

    @Autowired private QuarterlyReviewService quarterlyReviewService;
    @Autowired private GraphNodeRepository nodeRepository;
    @Autowired private PeriodSummaryPopulator periodSummaryPopulator;
    @Autowired private UserPopulator userPopulator;
    @Autowired private FakeCompanionLlm fakeCompanionLlm;

    /** Both quarters' month rungs, with the script planted in the PREVIOUS quarter's April rung
     *  (the [fake-period:…] channel idiom — plant it in what the pure-code gather actually
     *  renders). Planting it on the previous-quarter side is deliberate: it makes every test in
     *  this class depend on the season-over-season gather being real, and gives
     *  {@code testRunFor_shouldRenderThePreviousQuarterIntoThePrompt…} its assertion. */
    private UUID seedBothQuarters(String script) {
        UUID owner = userPopulator.createUser().getId();
        periodSummaryPopulator.periodSummary(owner, PeriodSummaryEntity.GRANULARITY_MONTH,
                Q2, "Áprilisi hónap. " + script);
        periodSummaryPopulator.periodSummary(owner, PeriodSummaryEntity.GRANULARITY_MONTH,
                Q2.plusMonths(1), "Májusi hónap.");
        periodSummaryPopulator.periodSummary(owner, PeriodSummaryEntity.GRANULARITY_MONTH,
                Q3, "Júliusi hónap.");
        periodSummaryPopulator.periodSummary(owner, PeriodSummaryEntity.GRANULARITY_MONTH,
                Q3.plusMonths(1), "Augusztusi hónap.");
        return owner;
    }

    @Test
    void testRunFor_shouldCreateCandidatesNotActives_whenBothQuartersHaveRungs() {
        UUID owner = seedBothQuarters(
                "[fake-season:[{\"title\":\"Nyári alapozás\",\"summary\":\"A nyár a volumenről szólt.\"}]]");

        int created = quarterlyReviewService.runFor(owner, Q3);

        assertThat(created).isEqualTo(1);
        List<GraphNodeEntity> nodes = nodeRepository.findByCreatedByAndStatusAndDeletedFalseOrderByCreatedAtDesc(
                owner, GraphNodeEntity.STATUS_CANDIDATE);
        assertThat(nodes).singleElement().satisfies(n -> {
            assertThat(n.getKind()).isEqualTo(GraphNodeEntity.KIND_SEASON);
            assertThat(n.getTitle()).isEqualTo("Nyári alapozás");
            assertThat(n.getSummary()).isEqualTo("A nyár a volumenről szólt.");
            assertThat(n.getSourceKind()).isEqualTo(QuarterlyReviewService.SOURCE_QUARTERLY);
            assertThat(n.getOccurredOn()).isEqualTo(Q3);
        });
        assertThat(nodeRepository.findByCreatedByAndStatusAndDeletedFalseOrderByCreatedAtDesc(
                owner, GraphNodeEntity.STATUS_ACTIVE)).isEmpty();
    }

    @Test
    void testRunFor_shouldRenderThePreviousQuarterIntoThePrompt_whenItHasRungs() {
        // seedBothQuarters plants its script in the APRIL rung — a PREVIOUS-quarter row. The
        // sentinel can only match if the gather actually rendered the previous quarter into the
        // user message, so a candidate here is proof the season-OVER-season comparison is real
        // and not a single-quarter read. (Every other test in this class would pass either way.)
        UUID owner = seedBothQuarters(
                "[fake-season:[{\"title\":\"Elozobol jott\",\"summary\":\"Az elozo negyedev szovegebol.\"}]]");

        assertThat(quarterlyReviewService.runFor(owner, Q3)).isEqualTo(1);
        assertThat(nodeRepository.findByCreatedByAndStatusAndDeletedFalseOrderByCreatedAtDesc(
                owner, GraphNodeEntity.STATUS_CANDIDATE))
                .singleElement()
                .satisfies(n -> assertThat(n.getTitle()).isEqualTo("Elozobol jott"));
    }

    @Test
    void testRunFor_shouldCapCandidates_whenModelProposesMoreThanTheConfiguredMax() {
        UUID owner = seedBothQuarters("[fake-season:["
                + "{\"title\":\"Egy\",\"summary\":\"a\"},"
                + "{\"title\":\"Kettő\",\"summary\":\"b\"},"
                + "{\"title\":\"Három\",\"summary\":\"c\"}]]");

        assertThat(quarterlyReviewService.runFor(owner, Q3)).isEqualTo(2);   // max-candidates: 2
    }

    @Test
    void testRunFor_shouldSkipEntirely_whenTheQuarterHasNoRungs() {
        UUID owner = userPopulator.createUser().getId();
        int before = fakeCompanionLlm.completeCallCount();

        assertThat(quarterlyReviewService.runFor(owner, Q3)).isZero();

        // The emptiness gate is BEFORE any spend: a quarter with nothing in it costs no call.
        assertThat(fakeCompanionLlm.completeCallCount()).isEqualTo(before);
        assertThat(nodeRepository.findByCreatedByAndStatusAndDeletedFalseOrderByCreatedAtDesc(
                owner, GraphNodeEntity.STATUS_CANDIDATE)).isEmpty();
    }

    @Test
    void testRunFor_shouldStillRun_whenOnlyTheCurrentQuarterHasRungs() {
        UUID owner = userPopulator.createUser().getId();
        periodSummaryPopulator.periodSummary(owner, PeriodSummaryEntity.GRANULARITY_MONTH, Q3,
                "Júliusi hónap. [fake-season:[{\"title\":\"Első szezon\",\"summary\":\"Nincs mihez mérni.\"}]]");

        // No previous quarter is an honest "nincs mit összehasonlítani" IN THE PROMPT, not a
        // reason to skip: the first quarter of a user's history still deserves a season reading.
        assertThat(quarterlyReviewService.runFor(owner, Q3)).isEqualTo(1);
    }

    @Test
    void testRunFor_shouldNotReProposeTheQuarter_whenItWasAlreadyProcessed() {
        UUID owner = seedBothQuarters(
                "[fake-season:[{\"title\":\"Nyári alapozás\",\"summary\":\"A nyár a volumenről szólt.\"}]]");
        assertThat(quarterlyReviewService.runFor(owner, Q3)).isEqualTo(1);
        int afterFirst = fakeCompanionLlm.completeCallCount();

        assertThat(quarterlyReviewService.runFor(owner, Q3)).isZero();
        assertThat(fakeCompanionLlm.completeCallCount()).isEqualTo(afterFirst);   // gate before spend
    }

    @Test
    void testRunFor_shouldNotResurrectARejectedQuarter_whenTheCandidateWasSoftDeleted() {
        UUID owner = seedBothQuarters(
                "[fake-season:[{\"title\":\"Nyári alapozás\",\"summary\":\"A nyár a volumenről szólt.\"}]]");
        assertThat(quarterlyReviewService.runFor(owner, Q3)).isEqualTo(1);
        GraphNodeEntity candidate = nodeRepository.findByCreatedByAndStatusAndDeletedFalseOrderByCreatedAtDesc(
                owner, GraphNodeEntity.STATUS_CANDIDATE).getFirst();
        nodeRepository.delete(candidate);   // @SQLDelete soft delete — the reject path

        // The gate counts soft-deleted rows too; a rejected quarter must never come back.
        assertThat(quarterlyReviewService.runFor(owner, Q3)).isZero();
    }

    @Test
    void testRunFor_shouldDegradeToZero_whenTheModelAnswerIsUnparseable() {
        UUID owner = seedBothQuarters(FakeCompanionLlm.SEASON_BROKEN);

        assertThat(quarterlyReviewService.runFor(owner, Q3)).isZero();
        assertThat(nodeRepository.findByCreatedByAndStatusAndDeletedFalseOrderByCreatedAtDesc(
                owner, GraphNodeEntity.STATUS_CANDIDATE)).isEmpty();
    }

    @Test
    void testRunFor_shouldDegradeToZero_whenTheModelCallFails() {
        UUID owner = seedBothQuarters(FakeCompanionLlm.FAIL_COMPLETE);

        assertThat(quarterlyReviewService.runFor(owner, Q3)).isZero();
    }

    @Test
    void testRunFor_shouldDropBlankTitles_whenTheModelProposesThem() {
        UUID owner = seedBothQuarters("[fake-season:["
                + "{\"title\":\"   \",\"summary\":\"üres\"},"
                + "{\"title\":\"Jó szezon\",\"summary\":\"ez marad\"}]]");

        assertThat(quarterlyReviewService.runFor(owner, Q3)).isEqualTo(1);
        assertThat(nodeRepository.findByCreatedByAndStatusAndDeletedFalseOrderByCreatedAtDesc(
                owner, GraphNodeEntity.STATUS_CANDIDATE))
                .singleElement()
                .satisfies(n -> assertThat(n.getTitle()).isEqualTo("Jó szezon"));
    }
}
