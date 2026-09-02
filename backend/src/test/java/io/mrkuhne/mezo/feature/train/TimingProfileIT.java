package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutTimingProfileEntity;
import io.mrkuhne.mezo.feature.train.repository.WorkoutSessionRepository;
import io.mrkuhne.mezo.feature.train.repository.WorkoutTimingProfileRepository;
import io.mrkuhne.mezo.feature.train.service.EwmaEstimator;
import io.mrkuhne.mezo.feature.train.service.TimingObservationExtractor;
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
import org.springframework.beans.factory.annotation.Autowired;

/**
 * Learned workout-timing profile (mezo-dzbm, spec 2026-09-02 slice 2): {@code
 * TimingProfileService.learnFrom} folds a finished session's intervals into a per-user, per-
 * component EWMA, hooked into {@code WorkoutService.finishWorkout} right after the medal replay.
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

        List<WorkoutTimingProfileEntity> rows = profileRepository.findByCreatedBy(user);
        assertThat(rows).extracting(WorkoutTimingProfileEntity::getComponent)
            .containsExactlyInAnyOrder(
                TimingObservationExtractor.LEAD_IN, TimingObservationExtractor.SET_CYCLE_COMPOUND);
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
     * {@code learnFrom} carries plain method-level {@code @Transactional} (REQUIRED), joining
     * {@code finishWorkout}'s already-open transaction — exactly as mandated (no NESTED, no
     * {@code PlatformTransactionManager} side effects). That shape has a real consequence, proven
     * here rather than assumed: Spring marks a PARTICIPATING transaction rollback-only the instant
     * any unchecked exception escapes a {@code @Transactional}-proxied method joined to it —
     * regardless of whether the failure ever touched the database — and a caller's {@code
     * try/catch} around the call cannot undo that flag (confirmed by temporarily forcing a
     * throw at the very top of {@code learnFrom}, before any repository access: finishWorkout
     * still surfaced {@code UnexpectedRollbackException} to ITS caller). A genuine Postgres-level
     * failure compounds this: once a statement aborts the physical transaction, nothing on that
     * connection — not even the eventual COMMIT — can succeed without a SAVEPOINT, which is
     * precisely the NESTED-propagation machinery this task removes as an unacceptable app-wide
     * side effect (it flips {@code nestedTransactionAllowed} on the shared, autoconfigured
     * {@code JpaTransactionManager} for every other call site too).
     *
     * <p>So under the mandated shape, "derived and decorative, must not roll back the real write"
     * (the pattern the medal derivation above demonstrates) only holds for failures that stay
     * OUTSIDE any {@code @Transactional} proxy boundary — a plain bug in in-memory logic, exactly
     * like {@code MedalService.forSession}, which carries no {@code @Transactional} of its own.
     * {@code learnFrom} cannot offer that same guarantee for a genuine DATA-INTEGRITY failure
     * without reintroducing NESTED. What it CAN and does guarantee instead — proven below with a
     * real, unmocked constraint collision, not a contrived in-memory throw — is that the failure
     * takes down ONLY this attempt, atomically: finishWorkout's completion write is never
     * partially applied, the session is left exactly as it was, and the caller gets a clear
     * signal (an exception) rather than silently-lost data. That is the correct outcome for an
     * actual data-integrity bug — the same as any other constraint violation elsewhere in the app.
     */
    @Test
    void testFinishWorkout_shouldRollBackAtomically_whenProfileLearningHitsADataIntegrityFailure() {
        UUID user = databasePopulator.populateUser("timing-profile-throws@test.local");
        WorkoutSessionEntity tmpl = template(user);
        ExerciseEntity exercise = train.createExercise(user, tmpl.getId(), "Row", 0);
        Instant t0 = Instant.now().minusSeconds(500);
        WorkoutSessionEntity instance = train.createWorkoutInstance(user, tmpl, LocalDate.now(), "active");
        instance.setStartedAt(t0);
        train.save(instance);
        train.createLoggedSet(user, exercise.getId(), instance.getId(), 0, "60.0", 8, 1, t0);
        train.createLoggedSet(user, exercise.getId(), instance.getId(), 1, "60.0", 8, 1, t0.plusSeconds(100));
        // Corrupt input state, honestly, no mocks: a SOFT-DELETED leftover row already occupies
        // the (createdBy, component) slot. @SQLRestriction(is_deleted = false) hides it from
        // findByCreatedByAndComponent, so apply() sees no row and tries to INSERT a fresh one —
        // but uq_workout_timing_profile_owner_component is NOT a partial index (it does not
        // exempt soft-deleted rows), so that insert collides and throws
        // DataIntegrityViolationException when learnFrom's transaction flushes.
        WorkoutTimingProfileEntity leftover = new WorkoutTimingProfileEntity();
        leftover.setCreatedBy(user);
        leftover.setComponent(TimingObservationExtractor.SET_CYCLE_COMPOUND);
        leftover.setValueNum(180.0);
        leftover.setDeviationNum(90.0);
        leftover.setSamples(0);
        leftover.setDeleted(true);
        profileRepository.saveAndFlush(leftover);

        // The constraint collision poisons finishWorkout's own (joined) transaction — see the
        // javadoc above for why a joined @Transactional callee makes that unavoidable without
        // NESTED. finishWorkout's try/catch still runs (it logs the warning) but cannot stop the
        // eventual commit from failing, so the whole call surfaces the failure to ITS caller.
        assertThatThrownBy(() -> workoutService.finishWorkout(user, instance.getId(), null))
            .isInstanceOf(org.springframework.transaction.UnexpectedRollbackException.class);

        // Atomicity, not silent partial writes: the finish attempt left NO trace — status and
        // finishedAt are exactly as they were before the call, not half-completed.
        WorkoutSessionEntity reloaded = workoutSessionRepository.findById(instance.getId()).orElseThrow();
        assertThat(reloaded.getStatus()).isEqualTo("active");
        assertThat(reloaded.getFinishedAt()).isNull();
    }
}
