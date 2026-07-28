package io.mrkuhne.mezo.feature.proactive;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.proactive.entity.ChallengeEntity;
import io.mrkuhne.mezo.feature.proactive.repository.ChallengeRepository;
import io.mrkuhne.mezo.feature.proactive.service.OverloadChallengeGenerator;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.VolumeRecomputeJson;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.repository.MesocycleRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

/**
 * The deterministic biggest-jump generator (Plan 3 Task 2, bd mezo-gj42): reads the already-computed
 * per-exercise {@code ProgressionSignal} off {@link io.mrkuhne.mezo.feature.train.service.WorkoutService#getToday}
 * — no re-derivation of the intensity engine here — and persists exactly one {@code overload}
 * challenge for the day's biggest recommended jump. {@code @ActiveProfiles("companion-fake")} mirrors
 * {@code ChallengeGeneratorIT} (keeps the companion+proactive-gated bean wiring off the real LLM,
 * even though this generator never calls it).
 */
@Transactional
@ActiveProfiles("companion-fake")
class OverloadChallengeGeneratorIT extends AbstractIntegrationTest {

    @Autowired
    private OverloadChallengeGenerator generator;

    @Autowired
    private ChallengeRepository challengeRepository;

    @Autowired
    private UserPopulator userPopulator;

    @Autowired
    private TrainPopulator trainPopulator;

    @Autowired
    private MesocycleRepository mesocycleRepository;

    /** A completed instance of {@code day} carrying one working set that hits repMax (→ WEIGHT lever). */
    private void seedRepMaxHistory(UUID owner, WorkoutSessionEntity day, ExerciseEntity ex, String weightKg) {
        WorkoutSessionEntity instance =
            trainPopulator.createWorkoutInstance(owner, day, LocalDate.now().minusDays(7), "completed");
        trainPopulator.createLoggedSet(owner, ex.getId(), instance.getId(), 0, weightKg, 8, 0);
    }

    @Test
    void testGenerate_shouldEmitOneOverload_targetingTheBiggestWeightJump() {
        UUID owner = userPopulator.createUser("overload-biggest@test.local").getId();
        MesocycleEntity meso = trainPopulator.createActiveMeso(owner);
        WorkoutSessionEntity day = trainPopulator.createTemplateDay(owner, meso.getId(), "Pull");
        // exA: compound → intensity engine's +5 kg increment (the bigger jump).
        ExerciseEntity exA = trainPopulator.createExercise(owner, day.getId(), "Fekvenyomás", "chest", "compound");
        seedRepMaxHistory(owner, day, exA, "60");
        // exB: isolation → +2.5 kg increment (the smaller jump) — same day, same owner.
        ExerciseEntity exB = trainPopulator.createExercise(owner, day.getId(), "Bicepsz Curl", "biceps", "isolation");
        seedRepMaxHistory(owner, day, exB, "40");

        List<ChallengeEntity> result = generator.generate(owner, day.getId(), LocalDate.now());

        assertThat(result).hasSize(1);
        ChallengeEntity ch = result.get(0);
        assertThat(ch.getType()).isEqualTo(ChallengeEntity.TYPE_OVERLOAD);
        assertThat(ch.getExerciseId()).isEqualTo(exA.getId());           // the biggest +kg
        assertThat(ch.getExerciseName()).isEqualTo("Fekvenyomás");
        assertThat(ch.getStatus()).isEqualTo(ChallengeEntity.STATUS_PROPOSED);
        assertThat(ch.getTargetWeightKg()).isEqualByComparingTo("65");   // 60 + 5
        assertThat(ch.getTargetReps()).isNotNull();
        assertThat(ch.getConfidence()).isNull();                        // DC8: deterministic, no learned confidence
        assertThat(ch.getWhy()).isNotBlank();

        // Idempotent: a second call returns the same single row, no duplicate.
        assertThat(generator.generate(owner, day.getId(), LocalDate.now())).hasSize(1);
        assertThat(challengeRepository
            .findByCreatedByAndTemplateSessionIdAndWorkoutDateOrderByGeneratedAtAsc(owner, day.getId(), LocalDate.now())
            .stream().filter(c -> ChallengeEntity.TYPE_OVERLOAD.equals(c.getType())).count())
            .isEqualTo(1);
    }

    @Test
    void testGenerate_shouldEmitNone_whenCurrentWeekIsDeload() {
        UUID owner = userPopulator.createUser("overload-deload@test.local").getId();
        MesocycleEntity meso = trainPopulator.createActiveMeso(owner);
        meso.setPhaseCurve(List.of("Deload"));
        meso.setCurrentWeek(1);
        // Volume rollover runs at the top of getToday whenever the switch is on (default) — pin
        // lastRun far ahead of any calendar week this fixture's startDate could ever clamp to, so
        // the rollover is a guaranteed no-op and this currentWeek sticks (mirrors
        // WorkoutTodayProgressionIT's deload seed).
        meso.setVolumeRecompute(new VolumeRecomputeJson("W999", "W1000", "batch", List.of()));
        mesocycleRepository.saveAndFlush(meso);
        WorkoutSessionEntity day = trainPopulator.createTemplateDay(owner, meso.getId(), "Pull");
        ExerciseEntity ex = trainPopulator.createExercise(owner, day.getId(), "Fekvenyomás", "chest", "compound");
        seedRepMaxHistory(owner, day, ex, "60");

        assertThat(generator.generate(owner, day.getId(), LocalDate.now())).isEmpty();
    }

    @Test
    void testGenerate_shouldEmitNone_whenExerciseHasNoHistory() {
        UUID owner = userPopulator.createUser("overload-nohist@test.local").getId();
        MesocycleEntity meso = trainPopulator.createActiveMeso(owner);
        WorkoutSessionEntity day = trainPopulator.createTemplateDay(owner, meso.getId(), "Pull");
        trainPopulator.createExercise(owner, day.getId(), "Lat Pulldown", "back", "compound");   // no logged sets

        assertThat(generator.generate(owner, day.getId(), LocalDate.now())).isEmpty();
    }

    @Test
    void testGenerate_shouldReturnEmpty_whenDateIsNotToday() {
        UUID owner = userPopulator.createUser("overload-past@test.local").getId();
        assertThat(generator.generate(owner, UUID.randomUUID(), LocalDate.now().minusDays(1))).isEmpty();
    }
}
