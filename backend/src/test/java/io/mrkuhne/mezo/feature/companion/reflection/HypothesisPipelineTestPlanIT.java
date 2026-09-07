package io.mrkuhne.mezo.feature.companion.reflection;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.appnotification.repository.AppNotificationRepository;
import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.companion.reflection.entity.TextSignalEntity;
import io.mrkuhne.mezo.feature.companion.repository.PatternRepository;
import io.mrkuhne.mezo.feature.companion.service.HypothesisPipelineService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.DailySummaryPopulator;
import io.mrkuhne.mezo.support.populator.TextSignalPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

/**
 * Reflexió S3 (mezo-eq85.3): the proposal loop becomes TEST-PLAN aware. A proposal that names two
 * series the user actually has becomes a falsifiable {@code reflection} row keyed by its plan; one
 * that names a series out of thin air degrades to the pre-S3 qualitative {@code ai_hypothesis} row
 * instead of being lost. Identity is the PLAN, not the prose — rewording re-proposes nothing.
 *
 * <p>No class-level {@code @Transactional}: the pipeline is emit-reachable and {@code
 * AppNotificationEmitter}'s {@code REQUIRES_NEW} would deadlock against an uncommitted test user
 * (the {@code HypothesisPipelineServiceIT} precedent).
 */
@ActiveProfiles("companion-fake")
class HypothesisPipelineTestPlanIT extends AbstractIntegrationTest {

    private static final LocalDate DAY = LocalDate.now().minusDays(1);

    @Autowired private HypothesisPipelineService pipeline;
    @Autowired private PatternRepository patternRepository;
    @Autowired private AppNotificationRepository appNotificationRepository;
    @Autowired private DailySummaryPopulator dailySummaryPopulator;
    @Autowired private TextSignalPopulator textSignalPopulator;
    @Autowired private UserPopulator userPopulator;

    @Test
    void testRun_shouldPersistReflectionRowKeyedByPlan_whenTestPlanIsUsable() {
        UUID owner = seededUser();
        seedProposal(owner, """
                [{"title":"Anna után jobban alszol",\
                "mechanism":"A vele töltött esték után hamarabb elalszol.",\
                "category":"trigger",\
                "testPlan":{"seriesA":"people:anna","seriesB":"sleep-duration-h",\
                "lagDays":1,"expectedDirection":"positive"}}]""");

        assertThat(pipeline.run(owner, null)).isEqualTo(1);

        PatternEntity row = onlyRow(owner);
        assertThat(row.getKind()).isEqualTo(PatternEntity.KIND_REFLECTION);
        assertThat(row.getStatus()).isEqualTo(PatternEntity.STATUS_PROPOSED);
        assertThat(row.getOrigin()).isEqualTo(PatternEntity.ORIGIN_NIGHTLY_REFLECTION);
        assertThat(row.getHypothesisKey()).startsWith("ref-");
        assertThat(row.getPairKey()).isEqualTo(row.getHypothesisKey());
        assertThat(row.getTestPlan()).isNotNull();
        assertThat(row.getTestPlan().seriesA()).isEqualTo("people:anna");
        assertThat(row.getTestPlan().seriesB()).isEqualTo("sleep-duration-h");
        assertThat(row.getTestPlan().lagDays()).isEqualTo(1);
        assertThat(row.getTestPlan().minN()).isEqualTo(8);
        // Task 4 surfaces reflection rows on the observation feed — no V3.2 inbox notification here.
        assertThat(appNotificationRepository.findByCreatedByAndReadAtIsNullAndDeletedFalse(owner))
                .noneSatisfy(n -> assertThat(n.getKind()).isEqualTo("hypothesis_new"));
    }

    @Test
    void testRun_shouldFallBackToQualitativeRow_whenTestPlanNamesAnUnknownSeries() {
        UUID owner = seededUser();
        seedProposal(owner, """
                [{"title":"Anna után jobban alszol",\
                "mechanism":"A vele töltött esték után hamarabb elalszol.",\
                "category":"trigger",\
                "testPlan":{"seriesA":"people:nincs-ilyen-ember","seriesB":"sleep-duration-h",\
                "lagDays":1,"expectedDirection":"positive"}}]""");

        assertThat(pipeline.run(owner, null)).isEqualTo(1);

        PatternEntity row = onlyRow(owner);
        assertThat(row.getKind()).isEqualTo(PatternEntity.KIND_AI_HYPOTHESIS);
        assertThat(row.getTestPlan()).isNull();
        assertThat(row.getHypothesisKey()).isNull();
        assertThat(row.getPairKey()).startsWith("hyp-");
    }

    @Test
    void testRun_shouldNotReProposeTheSamePlan_whenOnlyTheWordingChanged() {
        UUID owner = seededUser();
        seedProposal(owner, """
                [{"title":"Anna után jobban alszol",\
                "mechanism":"A vele töltött esték után hamarabb elalszol.",\
                "category":"trigger",\
                "testPlan":{"seriesA":"people:anna","seriesB":"sleep-duration-h",\
                "lagDays":1,"expectedDirection":"positive"}}]""");
        assertThat(pipeline.run(owner, null)).isEqualTo(1);

        // Same plan, brand new prose — the identity is the TEST, not the sentence. Seeded on a
        // LATER day so the gathered narrative (summary date desc) hands the fake THIS sentinel.
        dailySummaryPopulator.summary(owner, DAY.plusDays(1), """
                Másik nap. [fake-hypotheses:[{"title":"Az Anna-esték nyugodtabb alvást hoznak",\
                "mechanism":"Ugyanaz a sejtés, más szavakkal.",\
                "category":"trigger",\
                "testPlan":{"seriesA":"people:anna","seriesB":"sleep-duration-h",\
                "lagDays":1,"expectedDirection":"positive"}}]]""");

        assertThat(pipeline.run(owner, null)).isZero();
        assertThat(patternRepository.findByCreatedByAndDeletedFalseOrderByLastDetectedAtDesc(owner))
                .hasSize(1);
    }

    private UUID seededUser() {
        UUID owner = userPopulator.createUser().getId();
        textSignalPopulator.signal(owner, TextSignalEntity.SOURCE_JOURNAL, UUID.randomUUID(),
                DAY, 4, 3, 2, List.of("Anna"), List.of("alvas"));
        return owner;
    }

    /** The {@code [fake-hypotheses:…]} sentinel rides a daily-summary narrative into the context. */
    private void seedProposal(UUID owner, String hypothesesJson) {
        dailySummaryPopulator.summary(owner, DAY,
                "Tegnap Annával voltunk. [fake-hypotheses:" + hypothesesJson + "]");
    }

    private PatternEntity onlyRow(UUID owner) {
        List<PatternEntity> rows =
                patternRepository.findByCreatedByAndDeletedFalseOrderByLastDetectedAtDesc(owner);
        assertThat(rows).hasSize(1);
        return rows.getFirst();
    }
}
