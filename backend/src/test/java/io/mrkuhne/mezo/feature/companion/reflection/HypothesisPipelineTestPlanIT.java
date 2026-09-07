package io.mrkuhne.mezo.feature.companion.reflection;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.appnotification.repository.AppNotificationRepository;
import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.companion.entity.PatternEventEntity;
import io.mrkuhne.mezo.feature.companion.entity.TestPlanEnvelope;
import io.mrkuhne.mezo.feature.companion.reflection.entity.TextSignalEntity;
import io.mrkuhne.mezo.feature.companion.repository.PatternEventRepository;
import io.mrkuhne.mezo.feature.companion.repository.PatternRepository;
import io.mrkuhne.mezo.feature.companion.service.HypothesisPipelineService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.DailySummaryPopulator;
import io.mrkuhne.mezo.support.populator.PatternEventPopulator;
import io.mrkuhne.mezo.support.populator.PatternPopulator;
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

    /** The plan of the row an S4 revision points at — {@code people:anna → sleep-duration-h}. */
    private static final TestPlanEnvelope ANNA_PLAN = new TestPlanEnvelope(
            "people:anna", "sleep-duration-h", 1, TestPlanEnvelope.DIRECTION_POSITIVE, 8, 3, 60);

    @Autowired private HypothesisPipelineService pipeline;
    @Autowired private PatternRepository patternRepository;
    @Autowired private AppNotificationRepository appNotificationRepository;
    @Autowired private PatternEventRepository patternEventRepository;
    @Autowired private DailySummaryPopulator dailySummaryPopulator;
    @Autowired private PatternPopulator patternPopulator;
    @Autowired private PatternEventPopulator patternEventPopulator;
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

    /**
     * S4 Step 5 (mezo-eq85.4): the user's own answer rides into the nightly prompt, and the model
     * may answer with a REVISION of an open row — {@code revisesHypothesisKey} +
     * {@code revisedTestPlan}. The revision may only append a {@code revised} event to the old row
     * and create a NEW {@code proposed} row: the old row's {@code status} and {@code belief} are
     * never written from an LLM answer, and the old test keeps running ("az is fut").
     */
    @Test
    void testRun_shouldReviseIntoANewRow_whenTheModelAnswersWithAValidRevisedPlan() {
        UUID owner = seededUser();
        PatternEntity open = patternPopulator.reflection(owner, ANNA_PLAN,
                PatternEntity.STATUS_MONITORING);
        patternEventPopulator.userReply(owner, open.getId(), "chip", "watch",
                "Inkább a témát figyeld, ne Annát.");
        seedProposal(owner, """
                [{"title":"Az alvás-téma napjain többet alszol",\
                "mechanism":"Amikor az alvásról írsz, tudatosabban fekszel le.",\
                "category":"trigger",\
                "testPlan":null,\
                "revisesHypothesisKey":"%s",\
                "revisedTestPlan":{"seriesA":"topic:alvas","seriesB":"sleep-duration-h",\
                "lagDays":0,"expectedDirection":"positive"}}]""".formatted(open.getHypothesisKey()));

        assertThat(pipeline.run(owner, null)).isEqualTo(1);

        // the old row: a `revised` event, and NOTHING else moved
        assertThat(patternEventRepository
                .findByCreatedByAndPatternIdAndDeletedFalseOrderByOccurredAtAsc(owner, open.getId()))
                .anySatisfy(e -> assertThat(e.getKind()).isEqualTo(PatternEventEntity.KIND_REVISED));
        PatternEntity oldRow = patternRepository
                .findByIdAndCreatedByAndDeletedFalse(open.getId(), owner).orElseThrow();
        assertThat(oldRow.getStatus()).isEqualTo(PatternEntity.STATUS_MONITORING);
        assertThat(oldRow.getBelief()).isNull();
        assertThat(oldRow.getTestPlan().seriesA()).isEqualTo("people:anna");

        // the new row: proposed, carrying the REVISED plan
        PatternEntity revised = patternRepository
                .findByCreatedByAndDeletedFalseOrderByLastDetectedAtDesc(owner).stream()
                .filter(row -> !row.getId().equals(open.getId()))
                .findFirst().orElseThrow();
        assertThat(revised.getKind()).isEqualTo(PatternEntity.KIND_REFLECTION);
        assertThat(revised.getStatus()).isEqualTo(PatternEntity.STATUS_PROPOSED);
        assertThat(revised.getTestPlan()).isNotNull();
        assertThat(revised.getTestPlan().seriesA()).isEqualTo("topic:alvas");
        assertThat(revised.getTestPlan().seriesB()).isEqualTo("sleep-duration-h");
        assertThat(revised.getHypothesisKey()).isEqualTo(TestPlanEnvelope.key(revised.getTestPlan()));
    }

    /** A revision naming a series the user does not have is silently dropped — no event, no row,
     *  and above all no broken run. */
    @Test
    void testRun_shouldDropTheRevision_whenTheRevisedPlanDoesNotValidate() {
        UUID owner = seededUser();
        PatternEntity open = patternPopulator.reflection(owner, ANNA_PLAN,
                PatternEntity.STATUS_MONITORING);
        patternEventPopulator.userReply(owner, open.getId(), "chip", "reject", "Ez nem stimmel.");
        seedProposal(owner, """
                [{"title":"Kitalált sorozatra épülő revízió",\
                "mechanism":"A modell olyan sorozatot nevez meg, ami nem létezik.",\
                "category":"trigger",\
                "testPlan":null,\
                "revisesHypothesisKey":"%s",\
                "revisedTestPlan":{"seriesA":"people:nincs-ilyen-ember",\
                "seriesB":"sleep-duration-h","lagDays":0,"expectedDirection":"positive"}}]"""
                .formatted(open.getHypothesisKey()));

        assertThat(pipeline.run(owner, null)).isZero();

        assertThat(patternEventRepository
                .findByCreatedByAndPatternIdAndDeletedFalseOrderByOccurredAtAsc(owner, open.getId()))
                .noneSatisfy(e -> assertThat(e.getKind()).isEqualTo(PatternEventEntity.KIND_REVISED));
        PatternEntity oldRow = patternRepository
                .findByIdAndCreatedByAndDeletedFalse(open.getId(), owner).orElseThrow();
        assertThat(oldRow.getStatus()).isEqualTo(PatternEntity.STATUS_MONITORING);
        assertThat(oldRow.getBelief()).isNull();
        assertThat(patternRepository.findByCreatedByAndDeletedFalseOrderByLastDetectedAtDesc(owner))
                .hasSize(1);
    }

    /** An unknown {@code revisesHypothesisKey} is dropped the same way — the model cannot conjure
     *  a row (nor reach someone else's) by naming a key. */
    @Test
    void testRun_shouldDropTheRevision_whenTheHypothesisKeyIsUnknown() {
        UUID owner = seededUser();
        PatternEntity open = patternPopulator.reflection(owner, ANNA_PLAN,
                PatternEntity.STATUS_MONITORING);
        seedProposal(owner, """
                [{"title":"Ismeretlen kulcsra hivatkozó revízió",\
                "mechanism":"A hivatkozott hipotézis nem létezik.",\
                "category":"trigger",\
                "testPlan":null,\
                "revisesHypothesisKey":"ref-deadbeef",\
                "revisedTestPlan":{"seriesA":"topic:alvas","seriesB":"sleep-duration-h",\
                "lagDays":0,"expectedDirection":"positive"}}]""");

        assertThat(pipeline.run(owner, null)).isZero();

        assertThat(patternEventRepository
                .findByCreatedByAndPatternIdAndDeletedFalseOrderByOccurredAtAsc(owner, open.getId()))
                .isEmpty();
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
