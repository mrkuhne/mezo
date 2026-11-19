package io.mrkuhne.mezo.feature.train.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.GymExerciseInput;
import io.mrkuhne.mezo.api.dto.ProgressionSignal;
import io.mrkuhne.mezo.api.dto.TodayExercise;
import io.mrkuhne.mezo.api.dto.WeekProposalDecisionRequest;
import io.mrkuhne.mezo.api.dto.WeekProposalLineDecision;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.MesoWeekProposalEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.entity.json.WeekProposalLineJson;
import io.mrkuhne.mezo.feature.train.repository.MesoWeekProposalRepository;
import io.mrkuhne.mezo.feature.train.repository.MesocycleRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.TestPropertySource;

/**
 * The weekly pin (volume engine v2 S3, spec §6.4 "Load lines"): a {@code kept} weight or rep line of the
 * week's proposal holds that exercise at last week's load for that week ({@code getToday} prescribes with
 * the progression capped at hold); an accepted line steps as previewed; the next week is free again. The
 * kept line still pins the exercise after a day edit re-mints its row (identity on the same template day).
 */
@TestPropertySource(properties = "mezo.volume.weekly-review.mode=manual")
class WeeklyPinIT extends AbstractIntegrationTest {

    private static final List<String> NO_DELOAD = List.of("MEV", "MEV", "MAV", "MAV", "MRV", "Deload");

    @Autowired WorkoutService workoutService;
    @Autowired WeekProposalDecisionService decisions;
    @Autowired TrainService trainService;
    @Autowired TrainPopulator train;
    @Autowired DatabasePopulator databasePopulator;
    @Autowired MesocycleRepository mesocycleRepository;
    @Autowired MesoWeekProposalRepository proposalRepository;

    private UUID owner;

    @BeforeEach
    void setUp() {
        owner = databasePopulator.populateUser("weekly-pin@test.local");
    }

    @Test
    void aKeptWeightLineHoldsLastWeeksWeight() {
        MesocycleEntity meso = run();
        WorkoutSessionEntity day = todaysDay(meso);
        ExerciseEntity row = exercise(day);
        logLastWeek(meso, day, row, 8); // top of 6–8 with reserve: the weight steps up

        TodayExercise before = only();
        assertThat(before.getProgression().getLever()).isEqualTo(ProgressionSignal.LeverEnum.WEIGHT);
        assertThat(before.getProgression().getTargetWeightKg()).isGreaterThan(new BigDecimal("60"));

        decide(meso, line(meso, 2, "weight"), WeekProposalLineDecision.DecisionEnum.KEPT);

        TodayExercise pinned = only();
        assertThat(pinned.getProgression().getLever()).isEqualTo(ProgressionSignal.LeverEnum.HOLD);
        assertThat(pinned.getProgression().getTargetWeightKg()).isEqualByComparingTo("60");

        nextWeek(meso); // week 3: a fresh, undecided proposal — no pin
        TodayExercise week3 = only();
        assertThat(reload(meso).getCurrentWeek()).isEqualTo(3);
        assertThat(week3.getProgression().getLever()).isEqualTo(ProgressionSignal.LeverEnum.WEIGHT);
        assertThat(week3.getProgression().getTargetWeightKg()).isGreaterThan(new BigDecimal("60"));
    }

    @Test
    void anAcceptedWeightLineSteps() {
        MesocycleEntity meso = run();
        WorkoutSessionEntity day = todaysDay(meso);
        ExerciseEntity row = exercise(day);
        logLastWeek(meso, day, row, 8);
        TodayExercise before = only();

        WeekProposalLineJson weight = line(meso, 2, "weight");
        decide(meso, weight, WeekProposalLineDecision.DecisionEnum.ACCEPTED);

        TodayExercise after = only();
        assertThat(after.getProgression().getLever()).isEqualTo(ProgressionSignal.LeverEnum.WEIGHT);
        assertThat(after.getProgression().getTargetWeightKg())
            .isEqualByComparingTo(before.getProgression().getTargetWeightKg())
            .isEqualByComparingTo(weight.toKg());
    }

    @Test
    void aKeptRepLineHoldsLastWeeksReps() {
        MesocycleEntity meso = run();
        WorkoutSessionEntity day = todaysDay(meso);
        ExerciseEntity row = exercise(day);
        logLastWeek(meso, day, row, 6); // bottom of 6–8 with reserve: the reps step up

        TodayExercise before = only();
        assertThat(before.getProgression().getLever()).isEqualTo(ProgressionSignal.LeverEnum.REP);
        assertThat(before.getProgression().getTargetReps()).isGreaterThan(6);

        decide(meso, line(meso, 2, "reps"), WeekProposalLineDecision.DecisionEnum.KEPT);

        TodayExercise pinned = only();
        assertThat(pinned.getProgression().getLever()).isEqualTo(ProgressionSignal.LeverEnum.HOLD);
        assertThat(pinned.getProgression().getTargetWeightKg()).isEqualByComparingTo("60");
        assertThat(pinned.getProgression().getTargetReps()).isEqualTo(6);
    }

    @Test
    void aKeptLineStillPinsTheRowAfterADayEdit() {
        MesocycleEntity meso = run();
        WorkoutSessionEntity day = todaysDay(meso);
        ExerciseEntity row = exercise(day);
        logLastWeek(meso, day, row, 8);
        only();
        decide(meso, line(meso, 2, "weight"), WeekProposalLineDecision.DecisionEnum.KEPT);

        trainService.replaceDayExercises(owner, meso.getId(), day.getId(), List.of(
            GymExerciseInput.builder().name("Evezés").muscle("back-mid").warmupSets(2).workingSets(3)
                .repMin(6).repMax(8).targetRIR(0).type(GymExerciseInput.TypeEnum.COMPOUND).build()));

        TodayExercise pinned = only();
        // the same one-exercise list is saved in place (mezo-r36n9.83): the row keeps its id
        assertThat(pinned.getId()).isEqualTo(row.getId());
        assertThat(pinned.getProgression().getLever()).isEqualTo(ProgressionSignal.LeverEnum.HOLD);
        assertThat(pinned.getProgression().getTargetWeightKg()).isEqualByComparingTo("60");
    }

    // ── fixtures ──────────────────────────────────────────────────────────────────────────────

    /** A run in its week 2 (started a week ago). */
    private MesocycleEntity run() {
        return mesocycleRepository.saveAndFlush(train.activeMesoStartedWeeksAgo(owner, 1, 6, NO_DELOAD));
    }

    /** The template day planned for today's weekday, first in the run. */
    private WorkoutSessionEntity todaysDay(MesocycleEntity meso) {
        String label = WorkoutService.HU_DAY_LABELS.get(LocalDate.now().getDayOfWeek().getValue() - 1);
        return train.createWorkoutSession(owner, meso.getId(), label, "gym", 0, "active");
    }

    /** Evezés, 3 × 6–8, target reserve 0. */
    private ExerciseEntity exercise(WorkoutSessionEntity day) {
        ExerciseEntity e = train.createExercise(owner, day.getId(), "Evezés", "back-mid", "compound");
        e.setWorkingSets(3);
        return train.save(e);
    }

    /** Last week's completed instance of {@code day}: every planned set at 60 kg × {@code reps}, 2 in reserve. */
    private void logLastWeek(MesocycleEntity meso, WorkoutSessionEntity day, ExerciseEntity e, int reps) {
        WorkoutSessionEntity instance = train.createWorkoutInstance(owner, day, meso.getStartDate(), "completed");
        for (int s = 0; s < e.getWorkingSets(); s++) {
            train.createLoggedSet(owner, e.getId(), instance.getId(), s, "60", reps, 2);
        }
    }

    private WeekProposalLineJson line(MesocycleEntity meso, int week, String kind) {
        MesoWeekProposalEntity p = proposalRepository.findWeekly(owner, meso.getId(), week).orElseThrow();
        return p.getLines().stream().filter(l -> kind.equals(l.kind())).findFirst().orElseThrow();
    }

    private void decide(MesocycleEntity meso, WeekProposalLineJson line, WeekProposalLineDecision.DecisionEnum d) {
        MesoWeekProposalEntity p = proposalRepository.findWeekly(owner, meso.getId(), 2).orElseThrow();
        decisions.decide(owner, meso.getId(), p.getId(), new WeekProposalDecisionRequest()
            .decisions(List.of(new WeekProposalLineDecision().lineId(line.id()).decision(d))));
    }

    private void nextWeek(MesocycleEntity meso) {
        MesocycleEntity later = reload(meso);
        later.setStartDate(later.getStartDate().minusWeeks(1));
        later.setEndDate(later.getEndDate().minusWeeks(1));
        mesocycleRepository.saveAndFlush(later);
    }

    private MesocycleEntity reload(MesocycleEntity meso) {
        return mesocycleRepository.findById(meso.getId()).orElseThrow();
    }

    private TodayExercise only() {
        List<TodayExercise> exercises = workoutService.getToday(owner, null).getExercises();
        assertThat(exercises).hasSize(1);
        return exercises.get(0);
    }
}
