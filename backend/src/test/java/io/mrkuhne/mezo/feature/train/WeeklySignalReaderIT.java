package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.repository.ExerciseSetRepository;
import io.mrkuhne.mezo.feature.train.service.WeeklySignalReader;
import io.mrkuhne.mezo.feature.train.service.WeeklySignalReader.GroupSignals;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.CheckInPopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * Last week's per-muscle signals (volume engine v2, spec §6.4): logged sets over the previous week's
 * completed sessions OF THE RUN, whatever row they hang on, plus the feedback flags and the soreness
 * of the next session's day. The run starts two weeks ago, so "now" is week 3 and week 2 is read.
 */
class WeeklySignalReaderIT extends AbstractIntegrationTest {

    @Autowired WeeklySignalReader reader;
    @Autowired TrainPopulator train;
    @Autowired CheckInPopulator checkIns;
    @Autowired DatabasePopulator databasePopulator;
    @Autowired ExerciseSetRepository setRepository;

    private UUID owner;
    private MesocycleEntity meso;
    private WorkoutSessionEntity day;

    @BeforeEach
    void setUp() {
        owner = databasePopulator.populateUser("signals@test.local");
        meso = train.activeMesoStartedWeeksAgo(owner, 2, 6, List.of("MEV", "MEV", "MAV", "MAV", "MRV", "Deload"));
        day = train.createWorkoutSession(owner, meso.getId(), "Hát nap", "gym", 0, "planned");
    }

    private LocalDate weekTwo(int dayOffset) {
        return meso.getStartDate().plusDays(7L + dayOffset);
    }

    private LocalDate weekThree(int dayOffset) {
        return meso.getStartDate().plusDays(14L + dayOffset);
    }

    private ExerciseEntity row(WorkoutSessionEntity on, String name, String muscle, int targetRir) {
        ExerciseEntity e = train.createExercise(owner, on.getId(), name, muscle, "compound");
        e.setTargetRir(targetRir);
        return train.save(e);
    }

    private void log(ExerciseEntity e, WorkoutSessionEntity instance, int sets, int rir) {
        for (int i = 0; i < sets; i++) {
            train.createLoggedSet(owner, e.getId(), instance.getId(), i, "60", 8, rir);
        }
    }

    private Map<String, GroupSignals> read(int week) {
        return reader.read(owner, meso, week);
    }

    @Test
    void aTodayOnlySwapIsCounted() {
        ExerciseEntity planned = row(day, "Behúzás", "back-mid", 1);
        WorkoutSessionEntity instance = train.createWorkoutInstance(owner, day, weekTwo(1), "completed");
        // "Csak ma" swap: the swapped-in row hangs off the INSTANCE, not the template day.
        ExerciseEntity swapped = row(instance, "Csörlő", "back-wide", 1);
        swapped.setAddedInWorkoutId(instance.getId());
        swapped.setReplacesExerciseId(planned.getId());
        train.save(swapped);
        log(swapped, instance, 3, 1);

        assertThat(read(3).get("back").logged()).isEqualTo(3);
    }

    @Test
    void exemptSetsAreNotCounted() {
        ExerciseEntity hang = row(day, "Dead Hang", "back-wide", 0);
        hang.setCountsTowardVolume(false);
        train.save(hang);
        ExerciseEntity counting = row(day, "Behúzás", "back-mid", 1);
        WorkoutSessionEntity instance = train.createWorkoutInstance(owner, day, weekTwo(1), "completed");
        log(hang, instance, 5, 0);
        log(counting, instance, 2, 1);

        assertThat(read(3).get("back").logged()).isEqualTo(2);
    }

    @Test
    void skippedSetsAreNotCounted() {
        ExerciseEntity e = row(day, "Behúzás", "back-mid", 1);
        WorkoutSessionEntity instance = train.createWorkoutInstance(owner, day, weekTwo(1), "completed");
        log(e, instance, 3, 1);
        var skipped = train.createLoggedSet(owner, e.getId(), instance.getId(), 3, "60", 8, 1);
        skipped.setSkipped(true);
        setRepository.saveAndFlush(skipped);
        var warmup = train.createLoggedSet(owner, e.getId(), instance.getId(), 4, "30", 10, 4);
        warmup.setKind("warmup");
        setRepository.saveAndFlush(warmup);

        assertThat(read(3).get("back").logged()).isEqualTo(3);
    }

    @Test
    void weekOneIsEmpty() {
        ExerciseEntity e = row(day, "Behúzás", "back-mid", 1);
        log(e, train.createWorkoutInstance(owner, day, weekTwo(1), "completed"), 3, 1);

        assertThat(read(1)).isEmpty();
    }

    @Test
    void nothingLoggedIsAllZero() {
        row(day, "Behúzás", "back-mid", 1);
        train.createWorkoutInstance(owner, day, weekTwo(1), "completed");

        assertThat(read(3)).isEmpty();
    }

    @Test
    void topWorkloadAnswerIsTooMuch() {
        ExerciseEntity back = row(day, "Behúzás", "back-mid", 1);
        ExerciseEntity chest = row(day, "Fekvenyomás", "chest-mid", 1);
        WorkoutSessionEntity instance = train.createWorkoutInstance(owner, day, weekTwo(1), "completed");
        log(back, instance, 3, 1);
        log(chest, instance, 3, 1);
        train.createFeedback(owner, instance.getId(), back.getId(), 3, 1, 3);  // Sok volt
        train.createFeedback(owner, instance.getId(), chest.getId(), 3, 1, 2); // Pont jó

        Map<String, GroupSignals> signals = read(3);
        assertThat(signals.get("back").tooMuch()).isTrue();
        assertThat(signals.get("chest").tooMuch()).isFalse();
    }

    @Test
    void jointPainTwoHolds() {
        ExerciseEntity back = row(day, "Behúzás", "back-mid", 1);
        ExerciseEntity chest = row(day, "Fekvenyomás", "chest-mid", 1);
        WorkoutSessionEntity instance = train.createWorkoutInstance(owner, day, weekTwo(1), "completed");
        log(back, instance, 3, 1);
        log(chest, instance, 3, 1);
        train.createFeedback(owner, instance.getId(), back.getId(), 3, 2, 2);  // Enyhe
        train.createFeedback(owner, instance.getId(), chest.getId(), 3, 1, 2); // Nincs

        Map<String, GroupSignals> signals = read(3);
        assertThat(signals.get("back").jointPain()).isTrue();
        assertThat(signals.get("chest").jointPain()).isFalse();
    }

    @Test
    void feedbackWithoutLoggedSetsStillAppears() {
        ExerciseEntity back = row(day, "Behúzás", "back-mid", 1);
        WorkoutSessionEntity instance = train.createWorkoutInstance(owner, day, weekTwo(1), "completed");
        train.createFeedback(owner, instance.getId(), back.getId(), 3, 3, 3);

        GroupSignals back0 = read(3).get("back");
        assertThat(back0.logged()).isZero();
        assertThat(back0.tooMuch()).isTrue();
        assertThat(back0.jointPain()).isTrue();
    }

    @Test
    void aGrindingExerciseMarksItsGroup() {
        ExerciseEntity back = row(day, "Behúzás", "back-mid", 3);   // target RIR 3
        ExerciseEntity chest = row(day, "Fekvenyomás", "chest-mid", 1);
        WorkoutSessionEntity instance = train.createWorkoutInstance(owner, day, weekTwo(1), "completed");
        log(back, instance, 3, 1);   // 1 <= 3 - 2 -> grind
        log(chest, instance, 3, 1);  // 1 <= 1 - 2 is false

        Map<String, GroupSignals> signals = read(3);
        assertThat(signals.get("back").grind()).isTrue();
        assertThat(signals.get("chest").grind()).isFalse();
    }

    @Test
    void sorenessOnTheNextSessionDay() {
        ExerciseEntity back = row(day, "Behúzás", "back-mid", 1);
        WorkoutSessionEntity last = train.createWorkoutInstance(owner, day, weekTwo(1), "completed");
        log(back, last, 3, 1);
        WorkoutSessionEntity next = train.createWorkoutInstance(owner, day, weekThree(0), "completed");
        log(back, next, 3, 1);
        checkIns.createCheckIn(owner, weekThree(0), "07:00", c -> c.setSoreness(9));
        // a high reading on the LAST session's own day must not count
        checkIns.createCheckIn(owner, weekTwo(1), "07:00", c -> c.setSoreness(10));

        assertThat(read(3).get("back").sorenessHigh()).isTrue();
    }

    @Test
    void sorenessBelowTheThresholdIsNotHigh() {
        ExerciseEntity back = row(day, "Behúzás", "back-mid", 1);
        log(back, train.createWorkoutInstance(owner, day, weekTwo(1), "completed"), 3, 1);
        log(back, train.createWorkoutInstance(owner, day, weekThree(0), "completed"), 3, 1);
        checkIns.createCheckIn(owner, weekThree(0), "07:00", c -> c.setSoreness(8));

        assertThat(read(3).get("back").sorenessHigh()).isFalse();
    }

    @Test
    void noCheckInMeansNoSoreness() {
        ExerciseEntity back = row(day, "Behúzás", "back-mid", 1);
        log(back, train.createWorkoutInstance(owner, day, weekTwo(1), "completed"), 3, 1);
        log(back, train.createWorkoutInstance(owner, day, weekThree(0), "completed"), 3, 1);
        checkIns.createCheckIn(owner, weekThree(0), "07:00", c -> c.setMotivation(5)); // soreness unanswered

        assertThat(read(3).get("back").sorenessHigh()).isFalse();
    }

    @Test
    void noNextSessionYetMeansNoSoreness() {
        ExerciseEntity back = row(day, "Behúzás", "back-mid", 1);
        log(back, train.createWorkoutInstance(owner, day, weekTwo(1), "completed"), 3, 1);
        checkIns.createCheckIn(owner, weekThree(0), "07:00", c -> c.setSoreness(10));

        assertThat(read(3).get("back").sorenessHigh()).isFalse();
    }

    @Test
    void setsOfAnotherRunAreNotCounted() {
        MesocycleEntity other = train.createMesocycle(owner, "Másik", "archived");
        WorkoutSessionEntity otherDay = train.createWorkoutSession(owner, other.getId(), "Hát nap", "gym", 0, "planned");
        ExerciseEntity e = row(otherDay, "Behúzás", "back-mid", 1);
        log(e, train.createWorkoutInstance(owner, otherDay, weekTwo(1), "completed"), 4, 1);

        assertThat(read(3)).isEmpty();
    }

    @Test
    void aSessionOutsideTheWeekIsNotCounted() {
        ExerciseEntity e = row(day, "Behúzás", "back-mid", 1);
        log(e, train.createWorkoutInstance(owner, day, meso.getStartDate().plusDays(2), "completed"), 4, 1); // week 1
        log(e, train.createWorkoutInstance(owner, day, weekThree(1), "completed"), 4, 1);                   // week 3
        log(e, train.createWorkoutInstance(owner, day, weekTwo(2), "active"), 4, 1);                        // not completed

        assertThat(read(3)).isEmpty();
    }
}
