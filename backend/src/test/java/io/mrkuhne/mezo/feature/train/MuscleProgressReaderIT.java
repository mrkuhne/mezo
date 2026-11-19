package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.repository.MesocycleRepository;
import io.mrkuhne.mezo.feature.train.service.MuscleProgressReader;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/** Per-muscle stall detection from logged sets of a styled run (mezo-r36n9.79). Run starts 3 weeks ago: now = week 4. */
class MuscleProgressReaderIT extends AbstractIntegrationTest {

    @Autowired MuscleProgressReader reader;
    @Autowired TrainPopulator train;
    @Autowired DatabasePopulator databasePopulator;
    @Autowired MesocycleRepository mesocycleRepository;

    private UUID owner;
    private MesocycleEntity meso;
    private WorkoutSessionEntity day;

    @BeforeEach
    void setUp() {
        owner = databasePopulator.populateUser("stall@test.local");
        meso = train.activeMesoStartedWeeksAgo(owner, 3, 6, List.of("MEV", "MEV", "MAV", "MAV", "MRV", "Deload"));
        day = train.createWorkoutSession(owner, meso.getId(), "Hát nap", "gym", 0, "active");
    }

    private void style(String s) {
        meso.setTrainingStyle(s);
        meso = mesocycleRepository.saveAndFlush(meso);
    }

    private ExerciseEntity row(String name, String muscle) {
        return train.createExercise(owner, day.getId(), name, muscle, "compound");
    }

    private void log(ExerciseEntity e, int week, String kg, int reps) {
        WorkoutSessionEntity inst = train.createWorkoutInstance(owner, day,
            meso.getStartDate().plusDays(7L * (week - 1) + 1), "completed");
        train.createLoggedSet(owner, e.getId(), inst.getId(), 0, kg, reps, 1);
    }

    @Test
    void unstyledRunHasNoStalls() {
        ExerciseEntity e = row("Evezés", "back-mid");
        log(e, 1, "60", 8);
        log(e, 2, "60", 8);
        log(e, 3, "60", 8);

        assertThat(reader.stalledGroups(owner, meso, 3)).isEmpty();
    }

    @Test
    void stalledGroupFromLoggedSets() {
        style("balanced");
        ExerciseEntity row = row("Evezés", "back-mid");
        ExerciseEntity pull = row("Lehúzás", "back-wide");
        ExerciseEntity curl = row("Hajlítás", "biceps-long");
        for (int w = 1; w <= 3; w++) {
            log(row, w, "60", 8);
            log(pull, w, "50", 10);
            log(curl, w, "20", 8 + w); // moves every week
        }

        assertThat(reader.stalledGroups(owner, meso, 3)).containsExactly("back");
    }

    @Test
    void aMovingExerciseKeepsTheGroupGoing() {
        style("balanced");
        ExerciseEntity row = row("Evezés", "back-mid");
        ExerciseEntity pull = row("Lehúzás", "back-wide");
        for (int w = 1; w <= 3; w++) {
            log(row, w, "60", 8);
            log(pull, w, "50", 10 + (w == 3 ? 1 : 0));
        }

        assertThat(reader.stalledGroups(owner, meso, 3)).isEmpty();
    }

    /** A deload week is not a hold: it is dropped and the loading weeks around it are compared (T3 Task 6). */
    @Test
    void midBlockDeloadWeekNotAHold() {
        meso = train.activeMesoStartedWeeksAgo(owner, 4, 6, List.of("MEV", "MAV", "MRV", "Deload", "MEV", "MAV"));
        day = train.createWorkoutSession(owner, meso.getId(), "Hát nap", "gym", 0, "active");
        style("balanced");
        ExerciseEntity row = row("Evezés", "back-mid");
        log(row, 1, "60", 8);
        log(row, 2, "60", 8);
        log(row, 3, "60", 8);
        log(row, 4, "40", 8); // the deload: lighter
        log(row, 5, "62.5", 8);

        assertThat(reader.stalledGroups(owner, meso, 5)).isEmpty(); // week 5 beat week 3
        assertThat(reader.stalledGroups(owner, meso, 4)).containsExactly("back"); // = loading week 3: 1-3 held
    }

    @Test
    void holdsAcrossADeloadWeekAreAStall() {
        meso = train.activeMesoStartedWeeksAgo(owner, 4, 6, List.of("MEV", "MAV", "MRV", "Deload", "MEV", "MAV"));
        day = train.createWorkoutSession(owner, meso.getId(), "Hát nap", "gym", 0, "active");
        style("balanced");
        ExerciseEntity row = row("Evezés", "back-mid");
        log(row, 2, "60", 8);
        log(row, 3, "60", 8);
        log(row, 4, "40", 8); // the deload: lighter — compared with it, week 5 would read as "moved"
        log(row, 5, "60", 8);

        assertThat(reader.stalledGroups(owner, meso, 5)).containsExactly("back");
    }
}
