package io.mrkuhne.mezo.feature.train;

import static java.util.concurrent.TimeUnit.SECONDS;
import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import io.mrkuhne.mezo.api.dto.WorkoutInstanceResponse;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutTimingProfileEntity;
import io.mrkuhne.mezo.feature.train.repository.WorkoutSessionRepository;
import io.mrkuhne.mezo.feature.train.repository.WorkoutTimingProfileRepository;
import io.mrkuhne.mezo.feature.train.service.EwmaEstimator;
import io.mrkuhne.mezo.feature.train.service.TimingObservationExtractor;
import io.mrkuhne.mezo.feature.train.service.TimingProfileListener;
import io.mrkuhne.mezo.feature.train.service.TimingProfileService;
import io.mrkuhne.mezo.feature.train.service.WorkoutService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * Learned workout-timing profile (mezo-dzbm, spec 2026-09-02 slice 2): {@code
 * TimingProfileService.learnFrom} folds a finished session's intervals into a per-user, per-
 * component EWMA. {@code WorkoutService.finishWorkout} publishes {@code WorkoutFinishedEvent}
 * unconditionally; {@code TimingProfileListener} consumes it AFTER_COMMIT + {@code @Async} (the
 * {@code FactExtractionListener} idiom) and calls {@code learnFrom} — so every assertion that
 * depends on the listener having run uses {@code Awaitility}, exactly like this repo's other
 * AFTER_COMMIT listener tests (see {@code TurnEmbeddingListenerIT}). This class is deliberately
 * NOT {@code @Transactional}: an AFTER_COMMIT synchronization only fires on a REAL commit, so a
 * test wrapped in its own (rolled-back) transaction would never see the event fire at all — each
 * test's direct {@code workoutService.finishWorkout(...)} / {@code learnFrom(...)} call commits
 * for real, and {@code AbstractIntegrationTest}'s {@code ResetDatabase} (not rollback) cleans up
 * between tests.
 */
class TimingProfileIT extends AbstractIntegrationTest {

    @Autowired private WorkoutService workoutService;
    @Autowired private TimingProfileService timingProfileService;
    @Autowired private WorkoutTimingProfileRepository profileRepository;
    @Autowired private WorkoutSessionRepository workoutSessionRepository;
    @Autowired private TrainPopulator train;
    @Autowired private DatabasePopulator databasePopulator;

    private static String todayLabel() {
        return WorkoutService.HU_DAY_LABELS.get(LocalDate.now().getDayOfWeek().getValue() - 1);
    }

    private WorkoutSessionEntity template(UUID user) {
        MesocycleEntity meso = train.createMesocycle(user, "Timing meso", "active");
        return train.createWorkoutSession(user, meso.getId(), todayLabel(), "Pull Day", 0, "planned");
    }

    @Test
    void testFinishWorkout_shouldCreateProfileRows_whenTheSessionHasLoggedSets() {
        UUID user = databasePopulator.populateUser("timing-profile-create@test.local");
        WorkoutSessionEntity tmpl = template(user);
        ExerciseEntity exercise = train.createExercise(user, tmpl.getId(), "Row", 0);
        Instant t0 = Instant.now().minusSeconds(2000);
        WorkoutSessionEntity instance = train.createWorkoutInstance(user, tmpl, LocalDate.now(), "active");
        instance.setStartedAt(t0);
        train.save(instance);
        // lead-in of exactly 900s (the configured cap, inclusive), then two 150s set-cycles.
        train.createLoggedSet(user, exercise.getId(), instance.getId(), 0, "60.0", 8, 1, t0.plusSeconds(900));
        train.createLoggedSet(user, exercise.getId(), instance.getId(), 1, "60.0", 8, 1, t0.plusSeconds(1050));
        train.createLoggedSet(user, exercise.getId(), instance.getId(), 2, "60.0", 8, 1, t0.plusSeconds(1200));

        workoutService.finishWorkout(user, instance.getId(), null);

        // learnFrom now runs AFTER_COMMIT on its own (async) thread — await it, don't assert
        // immediately (matches TurnEmbeddingListenerIT's shape for the same reason).
        await().atMost(10, SECONDS).untilAsserted(() -> {
            List<WorkoutTimingProfileEntity> rows = profileRepository.findByCreatedBy(user);
            assertThat(rows).extracting(WorkoutTimingProfileEntity::getComponent)
                .containsExactlyInAnyOrder(
                    TimingObservationExtractor.LEAD_IN, TimingObservationExtractor.SET_CYCLE_COMPOUND);
        });
        List<WorkoutTimingProfileEntity> rows = profileRepository.findByCreatedBy(user);
        WorkoutTimingProfileEntity setCycle = rows.stream()
            .filter(r -> TimingObservationExtractor.SET_CYCLE_COMPOUND.equals(r.getComponent()))
            .findFirst().orElseThrow();
        assertThat(setCycle.getSamples()).isEqualTo(2);
        WorkoutTimingProfileEntity leadIn = rows.stream()
            .filter(r -> TimingObservationExtractor.LEAD_IN.equals(r.getComponent()))
            .findFirst().orElseThrow();
        assertThat(leadIn.getSamples()).isEqualTo(1);
    }

    @Test
    void testFinishWorkout_shouldMoveTheEstimateTowardsReality_whenIntervalsDifferFromTheSeed() {
        UUID user = databasePopulator.populateUser("timing-profile-move@test.local");
        WorkoutSessionEntity tmpl = template(user);
        ExerciseEntity exercise = train.createExercise(user, tmpl.getId(), "Row", 0);
        // startedAt == first set's doneAt so lead-in is exactly 0 (skipped) and the ONLY observation
        // is one set_cycle_compound interval, isolating the estimate move to that one component.
        Instant t0 = Instant.now().minusSeconds(500);
        WorkoutSessionEntity instance = train.createWorkoutInstance(user, tmpl, LocalDate.now(), "active");
        instance.setStartedAt(t0);
        train.save(instance);
        train.createLoggedSet(user, exercise.getId(), instance.getId(), 0, "60.0", 8, 1, t0);
        // Seed for set_cycle_compound is 180s; observe far below it (100s).
        train.createLoggedSet(user, exercise.getId(), instance.getId(), 1, "60.0", 8, 1, t0.plusSeconds(100));

        workoutService.finishWorkout(user, instance.getId(), null);

        await().atMost(10, SECONDS).untilAsserted(() ->
            assertThat(profileRepository.findByCreatedByAndComponent(
                user, TimingObservationExtractor.SET_CYCLE_COMPOUND)).isPresent());
        WorkoutTimingProfileEntity row = profileRepository
            .findByCreatedByAndComponent(user, TimingObservationExtractor.SET_CYCLE_COMPOUND)
            .orElseThrow();
        assertThat(row.getSamples()).isEqualTo(1);
        // (1 - alpha) * 180 + alpha * 100 = 170, moved toward the 100s observation and away from seed 180.
        assertThat(row.getValueNum()).isLessThan(180.0).isCloseTo(170.0, org.assertj.core.data.Offset.offset(0.5));
    }

    @Test
    void testLearnFrom_shouldWriteNothing_whenTheSessionWasAutoClosed() {
        UUID user = databasePopulator.populateUser("timing-profile-autoclosed@test.local");
        WorkoutSessionEntity tmpl = template(user);
        ExerciseEntity exercise = train.createExercise(user, tmpl.getId(), "Row", 0);
        Instant t0 = Instant.now().minusSeconds(500);
        // completed status but finishedAt left NULL — the auto-close shape (finishedAt IS NULL).
        WorkoutSessionEntity instance = train.createWorkoutInstance(user, tmpl, LocalDate.now(), "completed");
        instance.setStartedAt(t0);
        train.save(instance);
        train.createLoggedSet(user, exercise.getId(), instance.getId(), 0, "60.0", 8, 1, t0);
        train.createLoggedSet(user, exercise.getId(), instance.getId(), 1, "60.0", 8, 1, t0.plusSeconds(100));

        // Direct call, not through finishWorkout/the event — synchronous, no await needed.
        timingProfileService.learnFrom(user, instance.getId());

        assertThat(profileRepository.findByCreatedBy(user)).isEmpty();
    }

    @Test
    void testLearnFrom_shouldWriteNothing_whenTheSessionIsTooNoisy() {
        UUID user = databasePopulator.populateUser("timing-profile-noisy@test.local");
        WorkoutSessionEntity tmpl = template(user);
        ExerciseEntity exercise = train.createExercise(user, tmpl.getId(), "Row", 0);
        Instant t0 = Instant.now().minusSeconds(3000);
        WorkoutSessionEntity instance = train.createWorkoutInstance(user, tmpl, LocalDate.now(), "completed");
        instance.setStartedAt(t0);
        instance.setFinishedAt(Instant.now());
        train.save(instance);
        // 5 sets -> 4 gaps: 100(ok), 400(clip), 400(clip), 100(ok) -> clipped ratio 0.5 > 0.25 cap.
        train.createLoggedSet(user, exercise.getId(), instance.getId(), 0, "60.0", 8, 1, t0);
        train.createLoggedSet(user, exercise.getId(), instance.getId(), 1, "60.0", 8, 1, t0.plusSeconds(100));
        train.createLoggedSet(user, exercise.getId(), instance.getId(), 2, "60.0", 8, 1, t0.plusSeconds(500));
        train.createLoggedSet(user, exercise.getId(), instance.getId(), 3, "60.0", 8, 1, t0.plusSeconds(900));
        train.createLoggedSet(user, exercise.getId(), instance.getId(), 4, "60.0", 8, 1, t0.plusSeconds(1000));

        // Direct call, not through finishWorkout/the event — synchronous, no await needed.
        timingProfileService.learnFrom(user, instance.getId());

        assertThat(profileRepository.findByCreatedBy(user)).isEmpty();
    }

    @Test
    void testRead_shouldReturnConfigSeeds_whenTheUserHasNoProfileRows() {
        UUID user = databasePopulator.populateUser("timing-profile-seeds@test.local");

        Map<String, EwmaEstimator.Estimate> profile = timingProfileService.read(user);

        assertThat(profile).containsOnlyKeys(
            TimingObservationExtractor.SET_CYCLE_COMPOUND, TimingObservationExtractor.SET_CYCLE_ISOLATION,
            TimingObservationExtractor.TRANSITION, TimingObservationExtractor.LEAD_IN);
        assertThat(profile.get(TimingObservationExtractor.SET_CYCLE_COMPOUND))
            .isEqualTo(new EwmaEstimator.Estimate(180.0, 90.0, 0));
        assertThat(profile.get(TimingObservationExtractor.SET_CYCLE_ISOLATION))
            .isEqualTo(new EwmaEstimator.Estimate(125.0, 62.5, 0));
        assertThat(profile.get(TimingObservationExtractor.TRANSITION))
            .isEqualTo(new EwmaEstimator.Estimate(240.0, 120.0, 0));
        assertThat(profile.get(TimingObservationExtractor.LEAD_IN))
            .isEqualTo(new EwmaEstimator.Estimate(480.0, 240.0, 0));
    }

    /**
     * Proves the ACTUAL guarantee the AFTER_COMMIT hand-off buys: {@code finishWorkout} commits
     * and returns the finished workout regardless of what profile learning does, because by the
     * time {@code TimingProfileListener} runs, {@code finishWorkout}'s transaction is already
     * gone — there is no shared transaction left for a failure in the listener to poison.
     *
     * <p>Real, unmocked fault injection, unchanged from the earlier (rejected) design: a
     * SOFT-DELETED leftover {@code workout_timing_profile} row already occupies the
     * {@code (createdBy, component)} slot. {@code @SQLRestriction(is_deleted = false)} hides it
     * from {@code findByCreatedByAndComponent}, so {@code apply()} tries to INSERT a fresh row
     * and collides with {@code uq_workout_timing_profile_owner_component} (not a partial index —
     * it does not exempt soft-deleted rows), throwing inside the listener's OWN transaction (a
     * fresh one, opened by {@code learnFrom}'s plain {@code @Transactional} on the listener's
     * detached {@code @Async} thread), long after {@code finishWorkout} has committed.
     *
     * <p>A bare "still zero profile rows" assertion right after the call would be vacuous — it
     * passes identically whether the listener ran and failed, or simply hasn't fired yet (this
     * repo's own {@code GraphFactOptOutEventIT} calls out exactly this trap). So this test
     * attaches a {@code ListAppender} (the {@code WebPushClientIT} log-capture idiom, no mocks)
     * to {@code TimingProfileListener}'s logger and awaits its catch-and-log warning, keyed on
     * this session's id, before asserting the negative — proof the listener genuinely ran and
     * failed, not that it hasn't run yet.
     */
    @Test
    void testFinishWorkout_shouldStillComplete_whenProfileLearningThrows() {
        UUID user = databasePopulator.populateUser("timing-profile-throws@test.local");
        WorkoutSessionEntity tmpl = template(user);
        ExerciseEntity exercise = train.createExercise(user, tmpl.getId(), "Row", 0);
        Instant t0 = Instant.now().minusSeconds(500);
        WorkoutSessionEntity instance = train.createWorkoutInstance(user, tmpl, LocalDate.now(), "active");
        instance.setStartedAt(t0);
        train.save(instance);
        train.createLoggedSet(user, exercise.getId(), instance.getId(), 0, "60.0", 8, 1, t0);
        train.createLoggedSet(user, exercise.getId(), instance.getId(), 1, "60.0", 8, 1, t0.plusSeconds(100));
        WorkoutTimingProfileEntity leftover = new WorkoutTimingProfileEntity();
        leftover.setCreatedBy(user);
        leftover.setComponent(TimingObservationExtractor.SET_CYCLE_COMPOUND);
        leftover.setValueNum(180.0);
        leftover.setDeviationNum(90.0);
        leftover.setSamples(0);
        leftover.setDeleted(true);
        profileRepository.saveAndFlush(leftover);

        Logger logger = (Logger) LoggerFactory.getLogger(TimingProfileListener.class);
        ListAppender<ILoggingEvent> appender = new ListAppender<>();
        appender.start();
        logger.addAppender(appender);
        try {
            WorkoutInstanceResponse finished = workoutService.finishWorkout(user, instance.getId(), null);

            // The completion write is unaffected — it committed before the listener ever ran.
            assertThat(finished.getFinishedAt()).isNotNull();
            WorkoutSessionEntity reloaded = workoutSessionRepository.findById(instance.getId()).orElseThrow();
            assertThat(reloaded.getStatus()).isEqualTo("completed");
            assertThat(reloaded.getFinishedAt()).isNotNull();

            // Non-vacuous: wait for PROOF the listener ran and failed for THIS session, not just
            // that no rows exist yet.
            await().atMost(10, SECONDS).untilAsserted(() ->
                assertThat(appender.list.stream().map(ILoggingEvent::getFormattedMessage))
                    .anyMatch(message -> message.contains(instance.getId().toString())));

            assertThat(profileRepository.findByCreatedBy(user)).isEmpty();
        } finally {
            logger.detachAppender(appender);
        }
    }
}
