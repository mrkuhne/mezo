package io.mrkuhne.mezo.feature.train.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.ProgressionSignal;
import io.mrkuhne.mezo.api.dto.TodayExercise;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.MesoWeekProposalEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.entity.json.WeekProposalLineJson;
import io.mrkuhne.mezo.feature.train.repository.ExerciseCatalogRepository;
import io.mrkuhne.mezo.feature.train.repository.ExerciseRepository;
import io.mrkuhne.mezo.feature.train.repository.MesoWeekProposalRepository;
import io.mrkuhne.mezo.feature.train.repository.MesocycleRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * The weight / rep lines of the weekly proposal (volume engine v2 S3, {@link LoadLinePreview}): a preview
 * of the week's load progression that equals what {@code getToday} then prescribes, accepted in
 * {@code auto} mode without touching {@code working_sets}; none in a deload week. Entered through
 * {@code getToday}, as in production — the template day is today's weekday, so the same call also
 * returns the session's prescription to compare against.
 */
class WeekProposalLoadLinesIT extends AbstractIntegrationTest {

    private static final List<String> NO_DELOAD = List.of("MEV", "MEV", "MAV", "MAV", "MRV", "Deload");
    private static final List<String> DELOAD_IN_WEEK_2 = List.of("MEV", "Deload", "MEV", "MAV", "MRV", "MRV");

    @Autowired WorkoutService workoutService;
    @Autowired TrainPopulator train;
    @Autowired DatabasePopulator databasePopulator;
    @Autowired MesocycleRepository mesocycleRepository;
    @Autowired ExerciseRepository exerciseRepository;
    @Autowired ExerciseCatalogRepository catalogRepository;
    @Autowired MesoWeekProposalRepository proposalRepository;

    private UUID owner;

    @BeforeEach
    void setUp() {
        owner = databasePopulator.populateUser("week-proposal-load@test.local");
    }

    @Test
    void topOfTheRangeGetsTheWeightLineGetTodayPrescribes() {
        MesocycleEntity meso = run(NO_DELOAD, null);
        WorkoutSessionEntity day = todaysDay(meso);
        ExerciseEntity row = exercise(day, "Evezés", "back-mid", 3, null); // 6–8 reps, target reserve 0
        logLastWeek(meso, day, row, "60", 8, 2); // the top of the range with 2 in reserve

        TodayExercise today = only(workoutService.getToday(owner, null).getExercises());

        WeekProposalLineJson weight = loadLine(meso, row, "weight");
        assertThat(today.getProgression().getLever()).isEqualTo(ProgressionSignal.LeverEnum.WEIGHT);
        assertThat(weight.fromKg()).isEqualByComparingTo("60");
        assertThat(weight.toKg()).isEqualByComparingTo(today.getProgression().getTargetWeightKg());
        assertThat(weight.toKg()).isGreaterThan(weight.fromKg());
        assertThat(weight.from()).isNull();
        assertThat(weight.to()).isNull();
        assertThat(weight.reasons()).startsWith("top_of_rep_range").contains("reserve_left");
        assertThat(weight.dayIndex()).isZero();
        assertThat(weight.dayName()).isEqualTo(day.getDayLabel());
        assertThat(weight.muscleGroup()).isEqualTo("back");
        assertThat(weight.exerciseName()).isEqualTo("Evezés");
        assertThat(weight.decision()).isEqualTo("accepted"); // auto mode
        assertThat(weight.id()).isNotBlank();
        assertWorkingSetsUntouchedByLoadLines(meso, row, 3);
    }

    @Test
    void styledRunPreviewsWithTheSessionsStyleContext() {
        MesocycleEntity meso = run(NO_DELOAD, "balanced");
        WorkoutSessionEntity day = todaysDay(meso);
        ExerciseEntity row = exercise(day, "Machine Chest Press", "chest-mid", 3,
            catalogRepository.findBySlug("machine-chest-press").orElseThrow().getId());
        logLastWeek(meso, day, row, "50", 8, 3);

        TodayExercise today = only(workoutService.getToday(owner, null).getExercises());

        ProgressionSignal p = today.getProgression();
        assertThat(p.getLever()).isEqualTo(ProgressionSignal.LeverEnum.WEIGHT);
        WeekProposalLineJson weight = loadLine(meso, row, "weight");
        assertThat(weight.fromKg()).isEqualByComparingTo("50");
        assertThat(weight.toKg()).isEqualByComparingTo(p.getTargetWeightKg());
    }

    @Test
    void reserveInsideTheRangeGetsARepLine() {
        MesocycleEntity meso = run(NO_DELOAD, null);
        WorkoutSessionEntity day = todaysDay(meso);
        ExerciseEntity row = exercise(day, "Evezés", "back-mid", 3, null);
        logLastWeek(meso, day, row, "60", 6, 2); // bottom of 6–8, reserve left

        TodayExercise today = only(workoutService.getToday(owner, null).getExercises());

        assertThat(today.getProgression().getLever()).isEqualTo(ProgressionSignal.LeverEnum.REP);
        WeekProposalLineJson reps = loadLine(meso, row, "reps");
        assertThat(reps.from()).isEqualTo(6);
        assertThat(reps.to()).isEqualTo(today.getProgression().getTargetReps()).isGreaterThan(6);
        assertThat(reps.fromKg()).isNull();
        assertThat(reps.toKg()).isNull();
        assertThat(reps.reasons()).containsExactly("reserve_left");
        assertThat(reps.decision()).isEqualTo("accepted");
        assertWorkingSetsUntouchedByLoadLines(meso, row, 3);
    }

    @Test
    void holdGetsNoLine() {
        MesocycleEntity meso = run(NO_DELOAD, null);
        WorkoutSessionEntity day = todaysDay(meso);
        ExerciseEntity row = exercise(day, "Evezés", "back-mid", 3, null);
        logLastWeek(meso, day, row, "60", 5, 2); // under the range with reserve left: the weight holds

        TodayExercise today = only(workoutService.getToday(owner, null).getExercises());

        assertThat(today.getProgression().getLever()).isEqualTo(ProgressionSignal.LeverEnum.HOLD);
        assertThat(loadLines(meso)).isEmpty();
    }

    @Test
    void aGrindUnderTheRangeGetsAWeightDownLine() {
        MesocycleEntity meso = run(NO_DELOAD, null);
        WorkoutSessionEntity day = todaysDay(meso);
        ExerciseEntity row = exercise(day, "Evezés", "back-mid", 3, null);
        logLastWeek(meso, day, row, "60", 4, 0); // under 6–8 at full effort: too heavy

        TodayExercise today = only(workoutService.getToday(owner, null).getExercises());

        WeekProposalLineJson weight = loadLine(meso, row, "weight");
        assertThat(weight.fromKg()).isEqualByComparingTo("60");
        assertThat(weight.toKg()).isEqualByComparingTo(today.getProgression().getTargetWeightKg())
            .isLessThan(weight.fromKg());
        assertThat(weight.reasons()).containsExactly("grind");
    }

    @Test
    void deloadWeekHasNoLoadLines() {
        MesocycleEntity meso = run(DELOAD_IN_WEEK_2, null);
        WorkoutSessionEntity day = todaysDay(meso);
        ExerciseEntity row = exercise(day, "Evezés", "back-mid", 3, null);
        logLastWeek(meso, day, row, "60", 8, 2);

        workoutService.getToday(owner, null);

        MesoWeekProposalEntity p = proposalRepository.findWeekly(owner, meso.getId(), 2).orElseThrow();
        assertThat(p.getLines()).isNotEmpty() // the deload's set lines
            .allSatisfy(l -> assertThat(l.kind()).isEqualTo("sets"));
    }

    // ── fixtures ──────────────────────────────────────────────────────────────────────────────

    /** A run in its week 2 (started a week ago). */
    private MesocycleEntity run(List<String> curve, String style) {
        MesocycleEntity meso = train.activeMesoStartedWeeksAgo(owner, 1, 6, curve);
        meso.setTrainingStyle(style);
        return mesocycleRepository.saveAndFlush(meso);
    }

    /** The template day planned for today's weekday, first in the run. */
    private WorkoutSessionEntity todaysDay(MesocycleEntity meso) {
        String label = WorkoutService.HU_DAY_LABELS.get(LocalDate.now().getDayOfWeek().getValue() - 1);
        return train.createWorkoutSession(owner, meso.getId(), label, "gym", 0, "active");
    }

    private ExerciseEntity exercise(WorkoutSessionEntity day, String name, String muscle, int sets, UUID catalogId) {
        ExerciseEntity e = train.createExercise(owner, day.getId(), name, muscle, "compound");
        e.setWorkingSets(sets);
        e.setCatalogId(catalogId);
        return train.save(e);
    }

    /** Last week's completed instance of {@code day}, every planned set logged at the same load. */
    private void logLastWeek(MesocycleEntity meso, WorkoutSessionEntity day, ExerciseEntity e,
                             String kg, int reps, int rir) {
        WorkoutSessionEntity instance = train.createWorkoutInstance(owner, day, meso.getStartDate(), "completed");
        for (int s = 0; s < e.getWorkingSets(); s++) {
            train.createLoggedSet(owner, e.getId(), instance.getId(), s, kg, reps, rir);
        }
    }

    private List<WeekProposalLineJson> loadLines(MesocycleEntity meso) {
        return proposalRepository.findWeekly(owner, meso.getId(), 2).orElseThrow().getLines().stream()
            .filter(l -> !"sets".equals(l.kind())).toList();
    }

    private WeekProposalLineJson loadLine(MesocycleEntity meso, ExerciseEntity row, String kind) {
        List<WeekProposalLineJson> lines = loadLines(meso);
        assertThat(lines).singleElement().satisfies(l -> {
            assertThat(l.kind()).isEqualTo(kind);
            assertThat(l.exerciseId()).isEqualTo(row.getId());
        });
        return lines.get(0);
    }

    /** The row holds its set line's {@code to} when it has one, else its original count; load lines never write. */
    private void assertWorkingSetsUntouchedByLoadLines(MesocycleEntity meso, ExerciseEntity row, int original) {
        MesoWeekProposalEntity p = proposalRepository.findWeekly(owner, meso.getId(), 2).orElseThrow();
        int expected = p.getLines().stream()
            .filter(l -> "sets".equals(l.kind()) && l.exerciseId().equals(row.getId()))
            .map(WeekProposalLineJson::to).findFirst().orElse(original);
        assertThat(exerciseRepository.findById(row.getId()).orElseThrow().getWorkingSets()).isEqualTo(expected);
        // the set lines come first, the load lines after them
        List<String> kinds = p.getLines().stream().map(WeekProposalLineJson::kind).toList();
        assertThat(kinds.subList(kinds.lastIndexOf("sets") + 1, kinds.size())).doesNotContain("sets");
    }

    private static TodayExercise only(List<TodayExercise> exercises) {
        assertThat(exercises).hasSize(1);
        return exercises.get(0);
    }
}
