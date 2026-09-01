package io.mrkuhne.mezo.feature.character;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.character.detector.DetectorInput;
import io.mrkuhne.mezo.feature.character.service.CharacterMetaReads;
import io.mrkuhne.mezo.feature.companion.entity.LearnedFactEntity;
import io.mrkuhne.mezo.feature.companion.entity.PatternEventEntity;
import io.mrkuhne.mezo.feature.companion.repository.PatternEventRepository;
import io.mrkuhne.mezo.feature.proactive.entity.ChallengeEntity;
import io.mrkuhne.mezo.feature.proactive.entity.ExperimentEntity;
import io.mrkuhne.mezo.feature.proactive.entity.PredictionEntity;
import io.mrkuhne.mezo.feature.proactive.repository.ExperimentRepository;
import io.mrkuhne.mezo.feature.proactive.repository.PredictionRepository;
import io.mrkuhne.mezo.feature.quest.entity.DailyQuestEntity;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.ChallengePopulator;
import io.mrkuhne.mezo.support.populator.ExperimentPopulator;
import io.mrkuhne.mezo.support.populator.LearnedFactPopulator;
import io.mrkuhne.mezo.support.populator.PatternEventPopulator;
import io.mrkuhne.mezo.support.populator.PatternPopulator;
import io.mrkuhne.mezo.support.populator.PredictionPopulator;
import io.mrkuhne.mezo.support.populator.QuestPopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

/**
 * IT for {@code CharacterMetaReads} (mezo-1gim.15): the system-side (AI-meta) read composer —
 * triage decisions, predictions, quests and proposal outcomes, each bounded above by {@code day}
 * for catch-up honesty.
 */
@ActiveProfiles("companion-fake")
class CharacterMetaReadsIT extends ApiIntegrationTest {

    private static final LocalDate DAY = LocalDate.of(2026, 8, 26);

    @Autowired private CharacterMetaReads metaReads;
    @Autowired private OwnerProperties ownerProperties;
    @Autowired private LearnedFactPopulator learnedFactPopulator;
    @Autowired private PatternPopulator patternPopulator;
    @Autowired private PatternEventPopulator patternEventPopulator;
    @Autowired private PatternEventRepository patternEventRepository;
    @Autowired private PredictionPopulator predictionPopulator;
    @Autowired private PredictionRepository predictionRepository;
    @Autowired private QuestPopulator questPopulator;
    @Autowired private ExperimentPopulator experimentPopulator;
    @Autowired private ExperimentRepository experimentRepository;
    @Autowired private ChallengePopulator challengePopulator;
    @Autowired private TrainPopulator trainPopulator;
    @Autowired private JdbcTemplate jdbcTemplate;

    private UUID owner;

    @BeforeEach
    void owner() {
        owner = databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    private LocalDate from() {
        return DAY.minusWeeks(8).plusDays(1);
    }

    private static Timestamp at(LocalDate d) {
        return Timestamp.from(d.atStartOfDay(ZoneId.systemDefault()).toInstant().plusSeconds(3600));
    }

    private void factDecision(LocalDate createdOn, String category, String decision) {
        LearnedFactEntity f = learnedFactPopulator.weeklyCandidate(owner, createdOn, "t", category, "e", decision);
        jdbcTemplate.update("update learned_fact set created_at = ? where id = ?", at(createdOn), f.getId());
    }

    private void patternEvent(LocalDate on, String kind) {
        UUID patternId = patternPopulator.statistical(owner).getId();
        PatternEventEntity e = patternEventPopulator.snapshot(owner, patternId, -0.5, 12, 0.05,
                on.atStartOfDay(ZoneId.systemDefault()).toInstant().plusSeconds(3600));
        e.setKind(kind);
        patternEventRepository.saveAndFlush(e);
    }

    /** A planted template session (the challenge's {@code templateSessionId}) + its target exercise
     *  — copied from {@code ChallengeOutcomeIT.Plan}/{@code plantTemplate} so the challenge FKs
     *  resolve. */
    private record ChallengePlan(WorkoutSessionEntity template, UUID exerciseId) {
        UUID templateSessionId() {
            return template.getId();
        }
    }

    private ChallengePlan challengePlan(UUID owner) {
        MesocycleEntity meso = trainPopulator.createMesocycle(owner, "Teszt meso", "active");
        WorkoutSessionEntity template = trainPopulator.createWorkoutSession(
                owner, meso.getId(), "H", "gym", 0, "planned");
        ExerciseEntity exercise = trainPopulator.createExercise(owner, template.getId(), "Chest Supported Row", 0);
        return new ChallengePlan(template, exercise.getId());
    }

    @Test
    void gather_triageDecisions_factsByCreatedAtProxy_patternsByOccurredAt_boundedByDay() {
        factDecision(DAY, "fuel", LearnedFactEntity.DECISION_REJECT);
        factDecision(DAY.minusDays(3), "life", LearnedFactEntity.DECISION_REFINE);
        factDecision(DAY.plusDays(1), "train", LearnedFactEntity.DECISION_ACCEPT);   // after day: out
        LearnedFactEntity pending = learnedFactPopulator.candidate(owner, "pending", "health", null); // undecided: out
        patternEvent(DAY.minusDays(1), PatternEventEntity.KIND_REJECTED);
        patternEvent(DAY.minusDays(1), PatternEventEntity.KIND_SNAPSHOT);            // not a decision: out

        List<DetectorInput.TriageDecisionPoint> t = metaReads.gather(owner, from(), DAY).triageDecisions();

        assertThat(t).hasSize(3);
        assertThat(t).filteredOn(p -> p.source().equals("fact")).extracting(DetectorInput.TriageDecisionPoint::decision)
                .containsExactlyInAnyOrder("rejected", "kept");
        assertThat(t).filteredOn(DetectorInput.TriageDecisionPoint::refined).singleElement()
                .satisfies(p -> assertThat(p.category()).isEqualTo("life"));
        assertThat(t).filteredOn(p -> p.source().equals("pattern")).singleElement().satisfies(p -> {
            assertThat(p.category()).isEqualTo("minta");
            assertThat(p.decision()).isEqualTo("rejected");
            assertThat(p.date()).isEqualTo(DAY.minusDays(1));
        });
        assertThat(pending).isNotNull();
    }

    @Test
    void gather_predictions_byValidToWindow_carriesStatusAndConfidence() {
        PredictionEntity p = predictionPopulator.prediction(owner, DAY.minusDays(10), "sleep_avg", "up",
                PredictionEntity.STATUS_VALIDATED);          // validTo = DAY-4
        p.setConfidence(new BigDecimal("0.80"));
        predictionRepository.saveAndFlush(p);
        predictionPopulator.prediction(owner, DAY.minusDays(70), "sleep_avg", "up", PredictionEntity.STATUS_MISSED); // out
        predictionPopulator.prediction(owner, DAY.plusDays(1), "sleep_avg", "up", PredictionEntity.STATUS_PENDING);   // validTo after day: out

        List<DetectorInput.PredictionPoint> preds = metaReads.gather(owner, from(), DAY).predictions();

        assertThat(preds).singleElement().satisfies(x -> {
            assertThat(x.validTo()).isEqualTo(DAY.minusDays(4));
            assertThat(x.status()).isEqualTo("validated");
            assertThat(x.confidence()).isEqualByComparingTo("0.80");
        });
    }

    @Test
    void gather_quests_inWindow_includingRerolled_boundedByDay() {
        questPopulator.activityQuest(owner, DAY, "reading", 10, DailyQuestEntity.STATUS_OFFERED);
        questPopulator.activityQuest(owner, DAY.minusDays(1), "reading", 10, DailyQuestEntity.STATUS_REROLLED);
        questPopulator.activityQuest(owner, DAY.plusDays(1), "reading", 10, DailyQuestEntity.STATUS_OFFERED);

        List<DetectorInput.QuestPoint> q = metaReads.gather(owner, from(), DAY).quests();

        assertThat(q).extracting(DetectorInput.QuestPoint::status).containsExactlyInAnyOrder("offered", "rerolled");
        assertThat(q).allSatisfy(x -> assertThat(x.slot()).isEqualTo("GROWTH"));
    }

    @Test
    void gather_proposalOutcomes_experimentsByGeneratedAt_challengesByWorkoutDate() {
        ExperimentEntity done = experimentPopulator.experiment(owner, ExperimentEntity.STATUS_COMPLETED, "sleep_avg", "up");
        done.setOutcomeGood(Boolean.TRUE);
        experimentRepository.saveAndFlush(done);
        jdbcTemplate.update("update experiment set generated_at = ? where id = ?", at(DAY.minusDays(5)), done.getId());
        ExperimentEntity late = experimentPopulator.experiment(owner, ExperimentEntity.STATUS_DISMISSED, "sleep_avg", "up");
        jdbcTemplate.update("update experiment set generated_at = ? where id = ?", at(DAY.plusDays(2)), late.getId());
        // A challenge needs a real template session + exercise (FKs): build them the way
        // ChallengeOutcomeIT does (its `plan` helper).
        ChallengePlan plan = challengePlan(owner);
        challengePopulator.challenge(owner, plan.templateSessionId(), DAY.minusDays(2), plan.exerciseId(),
                ChallengeEntity.TYPE_PR, ChallengeEntity.STATUS_HIT);

        List<DetectorInput.ProposalOutcomePoint> out = metaReads.gather(owner, from(), DAY).proposalOutcomes();

        assertThat(out).hasSize(2);
        assertThat(out).filteredOn(p -> p.kind().equals("experiment")).singleElement().satisfies(p -> {
            assertThat(p.status()).isEqualTo("completed");
            assertThat(p.outcomeGood()).isTrue();
            assertThat(p.date()).isEqualTo(DAY.minusDays(5));
        });
        assertThat(out).filteredOn(p -> p.kind().equals("challenge")).singleElement().satisfies(p -> {
            assertThat(p.status()).isEqualTo("hit");
            assertThat(p.date()).isEqualTo(DAY.minusDays(2));
        });
    }

    @Test
    void gather_freshOwner_isHonestlyEmpty() {
        DetectorInput.MetaWindow w = metaReads.gather(owner, from(), DAY);
        assertThat(w.triageDecisions()).isEmpty();
        assertThat(w.predictions()).isEmpty();
        assertThat(w.quests()).isEmpty();
        assertThat(w.proposalOutcomes()).isEmpty();
    }
}
