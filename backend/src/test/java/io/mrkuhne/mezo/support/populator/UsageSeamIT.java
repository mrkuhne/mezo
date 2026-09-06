package io.mrkuhne.mezo.support.populator;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.habit.entity.HabitDayEntity;
import io.mrkuhne.mezo.feature.habit.repository.HabitDayRepository;
import io.mrkuhne.mezo.feature.journal.repository.JournalEntryRepository;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.ExerciseFeedbackEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.repository.ExerciseFeedbackRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.domain.Limit;

/**
 * Round 2 S5 (bd mezo-d58h.7.5): the three seams the question detectors are untestable without —
 * a countable/existence read per usage table, a way to make a row OLD ({@code @CreationTimestamp}
 * writes {@code now()} and nothing else can), and feedback rows in a KNOWN order.
 */
class UsageSeamIT extends AbstractIntegrationTest {

    @Autowired private JournalPopulator journalPopulator;
    @Autowired private JournalEntryRepository journalEntryRepository;
    @Autowired private HabitPopulator habitPopulator;
    @Autowired private HabitDayRepository habitDayRepository;
    @Autowired private TrainPopulator trainPopulator;
    @Autowired private ExerciseFeedbackRepository exerciseFeedbackRepository;
    @Autowired private UserPopulator userPopulator;
    @Autowired private CreatedAtBackdater createdAtBackdater;

    @Test
    void testBackdate_shouldMoveARowOutOfTheRecentWindow() {
        UUID owner = userPopulator.createUser().getId();
        UUID entryId = journalPopulator.createEntry(owner, LocalDate.now(), "régi", "quickinput").getId();
        Instant since = Instant.now().minus(30, ChronoUnit.DAYS);

        assertThat(journalEntryRepository.existsByCreatedByAndCreatedAtAfter(owner, since)).isTrue();
        createdAtBackdater.backdate("journal_entry", entryId, Instant.now().minus(60, ChronoUnit.DAYS));

        assertThat(journalEntryRepository.countByCreatedBy(owner)).isEqualTo(1L);
        assertThat(journalEntryRepository.existsByCreatedByAndCreatedAtAfter(owner, since)).isFalse();
    }

    /** The habit trap in one assertion: a {@code pending} row is the APP's write (HabitService
     *  materializes one per active def on any read), so only {@code done} may ever count as usage. */
    @Test
    void testHabitCount_shouldCountDoneRowsOnly() {
        UUID owner = userPopulator.createUser().getId();
        habitPopulator.row(owner, LocalDate.now(), "water", HabitDayEntity.STATUS_PENDING);
        habitPopulator.row(owner, LocalDate.now().minusDays(1), "water", HabitDayEntity.STATUS_DONE);

        assertThat(habitDayRepository.countByCreatedByAndStatus(owner, HabitDayEntity.STATUS_DONE))
            .isEqualTo(1L);
        assertThat(habitDayRepository.countByCreatedByAndStatus(owner, HabitDayEntity.STATUS_PENDING))
            .isEqualTo(1L);
    }

    /** {@code exercise_feedback} carries FKs to both {@code workout_session} and {@code exercise},
     *  so a debrief fixture needs a real mesocycle → template day → exercise → instance chain.
     *  One template exercise is enough: uniqueness is per (instance, exercise). */
    @Test
    void testFeedbackRead_shouldComeBackNewestFirstAndCapped() {
        UUID owner = userPopulator.createUser().getId();
        MesocycleEntity meso = trainPopulator.createMesocycle(owner, "S5 meso", "active");
        WorkoutSessionEntity template = trainPopulator.createWorkoutSession(
            owner, meso.getId(), "Day A", "Pull", 0, "planned");
        ExerciseEntity exercise = trainPopulator.createExercise(owner, template.getId(), "Row", 0);
        UUID sessionOld = trainPopulator
            .createWorkoutInstance(owner, template, LocalDate.now().minusDays(10), "completed").getId();
        UUID sessionNew = trainPopulator
            .createWorkoutInstance(owner, template, LocalDate.now().minusDays(1), "completed").getId();
        trainPopulator.createFeedbackAt(owner, sessionOld, exercise.getId(), 3, 1, 2,
            Instant.now().minus(10, ChronoUnit.DAYS));
        trainPopulator.createFeedbackAt(owner, sessionNew, exercise.getId(), 3, 1, 2,
            Instant.now().minus(1, ChronoUnit.DAYS));

        List<ExerciseFeedbackEntity> rows =
            exerciseFeedbackRepository.findByCreatedByOrderByCreatedAtDesc(owner, Limit.of(1));

        assertThat(rows).hasSize(1);
        assertThat(rows.get(0).getWorkoutSessionId()).isEqualTo(sessionNew);
    }
}
