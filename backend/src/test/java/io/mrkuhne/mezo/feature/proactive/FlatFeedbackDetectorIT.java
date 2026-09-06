package io.mrkuhne.mezo.feature.proactive;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.proactive.service.FlatFeedbackDetector;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * Round 2 S5 (bd mezo-d58h.7.5, spec §(18)): the last 8 feedback-carrying workouts all carrying the
 * SAME (workload, jointPain) pair — likely reflex-clicked. Fewer than 8 is not flat, it is not
 * enough data, and stays silent.
 *
 * <p>{@code exercise_feedback} has FKs to both {@code workout_session} and {@code exercise}, so every
 * fixture below hangs off one real mesocycle → template day → exercise chain.
 */
class FlatFeedbackDetectorIT extends AbstractIntegrationTest {

    @Autowired private FlatFeedbackDetector detector;
    @Autowired private TrainPopulator trainPopulator;
    @Autowired private UserPopulator userPopulator;

    private WorkoutSessionEntity template;
    private ExerciseEntity exercise;
    private ExerciseEntity secondExercise;

    @Test
    void testDetect_shouldFire_whenTheLastEightWorkoutsCarryTheSamePair() {
        UUID owner = trainingUser();
        seedWorkouts(owner, 8, 2, 1);

        var verdict = detector.detect(owner);

        assertThat(verdict).isPresent();
        assertThat(verdict.orElseThrow().workload()).isEqualTo(2);
        assertThat(verdict.orElseThrow().jointPain()).isEqualTo(1);
        assertThat(verdict.orElseThrow().workouts()).isEqualTo(8);
    }

    /** Honesty gate: seven workouts is not a pattern, it is a short history. */
    @Test
    void testDetect_shouldStaySilent_whenThereAreTooFewWorkouts() {
        UUID owner = trainingUser();
        seedWorkouts(owner, 7, 2, 1);

        assertThat(detector.detect(owner)).isEmpty();
    }

    /** One differing workload anywhere in the window is variance — the user IS answering. */
    @Test
    void testDetect_shouldStaySilent_whenTheWorkloadVaries() {
        UUID owner = trainingUser();
        seedWorkouts(owner, 8, 2, 1);
        newestWorkout(owner, 1, 3);

        assertThat(detector.detect(owner)).isEmpty();
    }

    /** Same for the joint-pain half: the pair must be flat, not just one of its halves. */
    @Test
    void testDetect_shouldStaySilent_whenTheJointPainVaries() {
        UUID owner = trainingUser();
        seedWorkouts(owner, 8, 2, 1);
        newestWorkout(owner, 3, 2);

        assertThat(detector.detect(owner)).isEmpty();
    }

    /** A workout with SEVERAL exercises is still one workout — and every one of its rows counts
     *  towards flatness, so one differing exercise inside an otherwise flat workout speaks. */
    @Test
    void testDetect_shouldStaySilent_whenOneExerciseInsideAWorkoutDiffers() {
        UUID owner = trainingUser();
        seedWorkouts(owner, 8, 2, 1);
        UUID newest = instance(owner, LocalDate.now());
        trainPopulator.createFeedbackAt(owner, newest, exercise.getId(), 3, 1, 2,
            Instant.now().minus(2, ChronoUnit.HOURS));
        trainPopulator.createFeedbackAt(owner, newest, secondExercise.getId(), 3, 1, 3,
            Instant.now().minus(1, ChronoUnit.HOURS));

        assertThat(detector.detect(owner)).isEmpty();
    }

    private UUID trainingUser() {
        UUID owner = userPopulator.createUser().getId();
        MesocycleEntity meso = trainPopulator.createMesocycle(owner, "S5 meso", "active");
        template = trainPopulator.createWorkoutSession(owner, meso.getId(), "Day A", "Pull", 0,
            "planned");
        exercise = trainPopulator.createExercise(owner, template.getId(), "Row", 0);
        secondExercise = trainPopulator.createExercise(owner, template.getId(), "Curl", 1);
        return owner;
    }

    /** One debrief row per workout, oldest first so the newest fixture is the last one written. */
    private void seedWorkouts(UUID owner, int workouts, int workload, int jointPain) {
        for (int i = 0; i < workouts; i++) {
            UUID session = instance(owner, LocalDate.now().minusDays(workouts - (long) i));
            trainPopulator.createFeedbackAt(owner, session, exercise.getId(), 3, jointPain, workload,
                Instant.now().minus(workouts - (long) i, ChronoUnit.DAYS));
        }
    }

    private void newestWorkout(UUID owner, int jointPain, int workload) {
        UUID session = instance(owner, LocalDate.now());
        trainPopulator.createFeedbackAt(owner, session, exercise.getId(), 3, jointPain, workload,
            Instant.now().minus(1, ChronoUnit.HOURS));
    }

    private UUID instance(UUID owner, LocalDate date) {
        return trainPopulator.createWorkoutInstance(owner, template, date, "completed").getId();
    }
}
