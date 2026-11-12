package io.mrkuhne.mezo.feature.boop;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.boop.service.BoopDay;
import io.mrkuhne.mezo.feature.boop.service.BoopDayAssembler;
import io.mrkuhne.mezo.feature.wearable.repository.WearableWorkoutRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import io.mrkuhne.mezo.support.populator.WearableWorkoutPopulator;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

/** Boop B3 Task 5 (mezo-r36n9.13): the brief's session carries a done signal. */
@Transactional
class BoopSessionDoneIT extends AbstractIntegrationTest {

    private static final ZoneId BUDAPEST = ZoneId.of("Europe/Budapest");
    /** A Tuesday ("Kedd", schedule dayOfWeek 1). */
    private static final LocalDate DAY = LocalDate.parse("2026-11-10");

    @Autowired private BoopDayAssembler assembler;
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private TrainPopulator train;
    @Autowired private WearableWorkoutPopulator workoutPopulator;
    @Autowired private WearableWorkoutRepository wearableWorkouts;
    @Autowired private io.mrkuhne.mezo.feature.train.repository.WorkoutSessionRepository workoutSessions;

    @Test
    void finishedTrainSessionIsDone() {
        UUID user = databasePopulator.populateUser("sessdone1@test.local");
        var kedd = plannedKedd(user);
        var instance = train.createWorkoutInstance(user, kedd, DAY, "completed");
        instance.setStartedAt(local(18, 0));
        instance.setFinishedAt(local(19, 10));
        workoutSessions.saveAndFlush(instance);

        BoopDay.Session s = assembler.assemble(user, DAY).session();

        assertThat(s).isNotNull();
        assertThat(s.done()).isTrue();
        assertThat(s.doneMinutes()).isEqualTo(70);
        assertThat(s.avgHr()).isNull();
    }

    @Test
    void overlappingWearableWorkoutIsDone() {
        UUID user = databasePopulator.populateUser("sessdone2@test.local");
        plannedKedd(user);
        var w = workoutPopulator.createWorkout(user, "hk-d1", DAY, "traditionalStrengthTraining",
            local(18, 10), local(19, 40));
        w.setAvgHr(128);
        wearableWorkouts.saveAndFlush(w);

        BoopDay.Session s = assembler.assemble(user, DAY).session();

        assertThat(s.done()).isTrue();
        assertThat(s.doneMinutes()).isEqualTo(90);
        assertThat(s.avgHr()).isEqualTo(128);
    }

    @Test
    void shortWorkoutIsNotDone() {
        UUID user = databasePopulator.populateUser("sessdone3@test.local");
        plannedKedd(user);
        workoutPopulator.createWorkout(user, "hk-d2", DAY, "walking", local(18, 0), local(18, 19));

        BoopDay.Session s = assembler.assemble(user, DAY).session();

        assertThat(s.done()).isFalse();
        assertThat(s.doneMinutes()).isNull();
    }

    @Test
    void huaweiWorkoutWithoutHrGivesMinutesOnly() {
        UUID user = databasePopulator.populateUser("sessdone4@test.local");
        plannedKedd(user);
        workoutPopulator.createWorkout(user, "hw-d1", DAY, "strength", local(17, 30), local(18, 30));

        BoopDay.Session s = assembler.assemble(user, DAY).session();

        assertThat(s.done()).isTrue();
        assertThat(s.doneMinutes()).isEqualTo(60);
        assertThat(s.avgHr()).isNull();
    }

    @Test
    void farAwayWorkoutIsNotThePlannedSession() {
        UUID user = databasePopulator.populateUser("sessdone5@test.local");
        plannedKedd(user);
        workoutPopulator.createWorkout(user, "hk-d3", DAY, "running", local(7, 0), local(8, 0));

        assertThat(assembler.assemble(user, DAY).session().done()).isFalse();
    }

    private io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity plannedKedd(UUID user) {
        var meso = train.createActiveMeso(user);
        var kedd = train.createWorkoutSession(user, meso.getId(), "Kedd", "Legs 1", 1, "active");
        train.createExercise(user, kedd.getId(), "Guggolás", 0);
        train.createGymSlot(user, 1, "18:00");
        return kedd;
    }

    private static Instant local(int hour, int minute) {
        return LocalDateTime.of(DAY, LocalTime.of(hour, minute)).atZone(BUDAPEST).toInstant();
    }
}
