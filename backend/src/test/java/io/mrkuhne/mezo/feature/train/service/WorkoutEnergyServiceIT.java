package io.mrkuhne.mezo.feature.train.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.WorkoutEnergy;
import io.mrkuhne.mezo.api.dto.WorkoutInstanceResponse;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.repository.WorkoutSessionRepository;
import io.mrkuhne.mezo.feature.wearable.entity.WearableWorkoutEntity;
import io.mrkuhne.mezo.feature.wearable.repository.WearableWorkoutRepository;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.BiometricProfilePopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import io.mrkuhne.mezo.support.populator.WearableWorkoutPopulator;
import io.mrkuhne.mezo.support.populator.WeightLogPopulator;
import java.math.BigDecimal;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;

/**
 * The kcal shown when a workout ends (mezo-r36n9.170, owner 2026-11-25: „becslés, utána óra"):
 * the server's net estimate from the work time, replaced by the watch's figure once a matching
 * Health strength workout with kcal is synced.
 */
class WorkoutEnergyServiceIT extends ApiIntegrationTest {

    @Autowired private WorkoutEnergyService service;
    @Autowired private TrainPopulator train;
    @Autowired private WorkoutSessionRepository sessions;
    @Autowired private WearableWorkoutPopulator wearable;
    @Autowired private WearableWorkoutRepository wearableRepository;
    @Autowired private BiometricProfilePopulator biometricProfilePopulator;
    @Autowired private WeightLogPopulator weightLogPopulator;
    @Autowired private OwnerProperties ownerProperties;

    private UUID owner() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    private void seedBody(UUID owner) {
        biometricProfilePopulator.create(owner);
        weightLogPopulator.createWeightLog(owner, LocalDate.now().minusDays(3), new BigDecimal("82.0"));
    }

    /** A completed instance of a meso template, an hour long with 50 minutes of work. */
    private WorkoutSessionEntity completed(UUID owner, Instant start) {
        MesocycleEntity meso = train.createMesocycle(owner, "Hyp 05", "active");
        WorkoutSessionEntity template = train.createWorkoutSession(owner, meso.getId(), "Hétfő", "push", 0, "planned");
        WorkoutSessionEntity instance = train.createWorkoutInstance(owner, template, LocalDate.now(), "completed", 3000);
        instance.setStartedAt(start);
        instance.setFinishedAt(start.plus(Duration.ofMinutes(60)));
        return sessions.saveAndFlush(instance);
    }

    @Test
    void testEnergyOf_shouldGiveTheEstimate_whenNoWatchWorkoutMatches() {
        UUID owner = owner();
        seedBody(owner);
        WorkoutSessionEntity instance = completed(owner, Instant.now().minus(Duration.ofHours(2)));

        WorkoutEnergy energy = service.energyOf(owner, instance).orElseThrow();

        assertThat(energy.getSource()).isEqualTo(WorkoutEnergy.SourceEnum.ESTIMATE);
        assertThat(energy.getKcal()).isPositive();
    }

    @Test
    void testEnergyOf_shouldGiveTheWatchFigure_whenAMatchingStrengthWorkoutCarriesKcal() {
        UUID owner = owner();
        seedBody(owner);
        Instant start = Instant.now().minus(Duration.ofHours(2));
        WorkoutSessionEntity instance = completed(owner, start);
        // The same workout twice (two sources) — the larger one wins, never their sum.
        withKcal(wearable.createWorkout(owner, "hk-1", LocalDate.now(), "strength",
            start.plus(Duration.ofMinutes(2)), start.plus(Duration.ofMinutes(61))), 412);
        withKcal(wearable.createWorkout(owner, "hk-2", LocalDate.now(), "strength",
            start.plus(Duration.ofMinutes(1)), start.plus(Duration.ofMinutes(60))), 398);
        // A run on the same day does not lend its kcal.
        withKcal(wearable.createWorkout(owner, "hk-3", LocalDate.now(), "running",
            start.plus(Duration.ofMinutes(1)), start.plus(Duration.ofMinutes(60))), 900);

        WorkoutEnergy energy = service.energyOf(owner, instance).orElseThrow();

        assertThat(energy.getSource()).isEqualTo(WorkoutEnergy.SourceEnum.WATCH);
        assertThat(energy.getKcal()).isEqualTo(412);
    }

    @Test
    void testEnergyOf_shouldBeEmpty_whenNoBodyDataAndNoWatch() {
        UUID owner = owner();
        WorkoutSessionEntity instance = completed(owner, Instant.now().minus(Duration.ofHours(2)));

        assertThat(service.energyOf(owner, instance)).isEmpty();
    }

    @Test
    void testFinishWorkout_shouldCarryTheEstimate_whenTheBodyIsKnown() {
        UUID owner = owner();
        seedBody(owner);
        MesocycleEntity meso = train.createMesocycle(owner, "Hyp 06", "active");
        WorkoutSessionEntity template = train.createWorkoutSession(owner, meso.getId(), "Hétfő", "push", 0, "planned");
        WorkoutSessionEntity instance = train.createWorkoutInstance(owner, template, LocalDate.now(), "active");
        instance.setStartedAt(Instant.now().minus(Duration.ofMinutes(45)));
        sessions.saveAndFlush(instance);
        ExerciseEntity bench = train.createExercise(owner, template.getId(), "Fekvenyomás", 0);
        train.createExerciseSetFull(owner, bench.getId(), instance.getId(), 0, new BigDecimal("80.00"), 8, false);

        WorkoutInstanceResponse body = postForBody("/api/train/workouts/" + instance.getId() + "/finish", null,
            ownerAuthHeaders(), HttpStatus.OK, WorkoutInstanceResponse.class);

        assertThat(body.getEnergy()).isNotNull();
        assertThat(body.getEnergy().getSource()).isEqualTo(WorkoutEnergy.SourceEnum.ESTIMATE);
        assertThat(body.getEnergy().getKcal()).isPositive();
    }

    private void withKcal(WearableWorkoutEntity w, int kcal) {
        w.setKcal(kcal);
        wearableRepository.saveAndFlush(w);
    }
}
