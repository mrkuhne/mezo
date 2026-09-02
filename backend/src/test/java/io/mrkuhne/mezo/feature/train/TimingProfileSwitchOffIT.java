package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.repository.WorkoutTimingProfileRepository;
import io.mrkuhne.mezo.feature.train.service.TimingProfileListener;
import io.mrkuhne.mezo.feature.train.service.WorkoutService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationContext;
import org.springframework.test.context.TestPropertySource;

/**
 * Learned workout-timing profile switch OFF (mezo-dzbm): with
 * {@code mezo.feature.timing-profile.enabled=false} the {@code TimingProfileGate} bean is absent,
 * so {@code TimingProfileListener} (@{@code ConditionalOnBean(TimingProfileGate.class)}) is also
 * absent, and {@code WorkoutFinishedEvent} has no consumer at all — finishWorkout completes and
 * its publish is a no-op, with no profile row ever written (not merely "not yet" — there is no
 * listener to eventually run, so no await is needed here, unlike the positive-path tests in
 * {@code TimingProfileIT}). Separate class because a @ConditionalOnProperty/@ConditionalOnBean
 * bean's presence is fixed per Spring context.
 */
@TestPropertySource(properties = "mezo.feature.timing-profile.enabled=false")
class TimingProfileSwitchOffIT extends AbstractIntegrationTest {

    @Autowired private WorkoutService workoutService;
    @Autowired private WorkoutTimingProfileRepository profileRepository;
    @Autowired private TrainPopulator train;
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private ApplicationContext context;

    private static String todayLabel() {
        return WorkoutService.HU_DAY_LABELS.get(LocalDate.now().getDayOfWeek().getValue() - 1);
    }

    /** Mirrors {@code ChatExtractionSwitchOffIT}: assert the bean is gone, not just its effect. */
    @Test
    void testListener_shouldNotExist_whenTimingProfileDisabled() {
        assertThat(context.getBeanProvider(TimingProfileListener.class).getIfAvailable()).isNull();
    }

    @Test
    void testFinishWorkout_shouldWriteNoProfileRows_whenTheSwitchIsOff() {
        UUID user = databasePopulator.populateUser("timing-profile-switchoff@test.local");
        MesocycleEntity meso = train.createMesocycle(user, "Timing meso", "active");
        WorkoutSessionEntity tmpl = train.createWorkoutSession(user, meso.getId(), todayLabel(), "Pull Day", 0, "planned");
        ExerciseEntity exercise = train.createExercise(user, tmpl.getId(), "Row", 0);
        Instant t0 = Instant.now().minusSeconds(500);
        WorkoutSessionEntity instance = train.createWorkoutInstance(user, tmpl, LocalDate.now(), "active");
        instance.setStartedAt(t0);
        train.save(instance);
        train.createLoggedSet(user, exercise.getId(), instance.getId(), 0, "60.0", 8, 1, t0);
        train.createLoggedSet(user, exercise.getId(), instance.getId(), 1, "60.0", 8, 1, t0.plusSeconds(100));

        workoutService.finishWorkout(user, instance.getId(), null);

        assertThat(profileRepository.findByCreatedBy(user)).isEmpty();
    }
}
