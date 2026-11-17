package io.mrkuhne.mezo.feature.train.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;

import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.MesoWeekProposalEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.MuscleGroupVolumeLogEntity;
import io.mrkuhne.mezo.feature.train.entity.VolumeRecomputeJson;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.entity.json.WeekProposalLineJson;
import io.mrkuhne.mezo.feature.train.repository.ExerciseRepository;
import io.mrkuhne.mezo.feature.train.repository.MesoWeekProposalRepository;
import io.mrkuhne.mezo.feature.train.repository.MesocycleRepository;
import io.mrkuhne.mezo.feature.train.repository.MuscleGroupVolumeLogRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.GoalPopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * The weekly proposal in {@code auto} mode (volume engine v2, spec §6.4): once per calendar week
 * of a run, per muscle group a decision, one line per changed exercise, stored as a
 * {@code meso_week_proposal} and applied to the exercises' {@code working_sets} — entered through
 * {@code getToday}, as in production. "Moving the clock" = a run that started N weeks ago.
 *
 * <p>Lives in the service package so the {@code build}/{@code apply} seam can stay package-private.
 */
class WeekProposalAutoIT extends AbstractIntegrationTest {

    private static final List<String> NO_DELOAD = List.of("MEV", "MEV", "MAV", "MAV", "MRV", "Deload");
    private static final List<String> DELOAD_IN_WEEK_3 = List.of("MEV", "MAV", "Deload", "MEV", "MAV", "MRV");

    @Autowired WorkoutService workoutService;
    @Autowired WeekProposalService proposals;
    @Autowired TrainPopulator train;
    @Autowired GoalPopulator goals;
    @Autowired DatabasePopulator databasePopulator;
    @Autowired MesocycleRepository mesocycleRepository;
    @Autowired ExerciseRepository exerciseRepository;
    @Autowired MesoWeekProposalRepository proposalRepository;
    @Autowired MuscleGroupVolumeLogRepository volumeRepo;
    @Autowired PlatformTransactionManager transactionManager;

    private UUID owner;

    @BeforeEach
    void setUp() {
        owner = databasePopulator.populateUser("week-proposal@test.local");
    }

    // ── the back fixture: Mon 4 + Mon 2, Thu 3 + Thu 2 = 11 ─────────────────────────────────────

    private record Back(MesocycleEntity meso, ExerciseEntity mon4, ExerciseEntity mon2,
                        ExerciseEntity thu3, ExerciseEntity thu2) {}

    /** Back at 11 on a run in {@code week}, every planned set logged the week before. */
    private Back back(int week, String tier, boolean logAll) {
        MesocycleEntity meso = run(week, NO_DELOAD, Map.of("back", tier));
        WorkoutSessionEntity mon = day(meso, "Hétfő", 0);
        WorkoutSessionEntity thu = day(meso, "Csütörtök", 3);
        Back b = new Back(meso,
            exercise(mon, "Evezés", "back-mid", 4), exercise(mon, "Lehúzás", "back-wide", 2),
            exercise(thu, "Kábeles evezés", "back-mid", 3), exercise(thu, "Húzódzkodás", "back-wide", 2));
        if (logAll) {
            logWeek(meso, week - 1, mon, 0, b.mon4(), b.mon2());
            logWeek(meso, week - 1, thu, 3, b.thu3(), b.thu2());
        }
        return b;
    }

    @Test
    void emphasizedBackGainsTwo() {
        Back b = back(2, "emphasize", true);

        workoutService.getToday(owner, null);

        assertThat(sets(b.mon4())).isEqualTo(4);
        assertThat(sets(b.mon2())).isEqualTo(3);
        assertThat(sets(b.thu3())).isEqualTo(3);
        assertThat(sets(b.thu2())).isEqualTo(3);
        assertThat(ledger(b.meso(), "back").getCurrentSets()).isEqualTo(13);

        MesoWeekProposalEntity p = weekly(b.meso(), 2);
        assertThat(p.getStatus()).isEqualTo(MesoWeekProposalEntity.STATUS_AUTO_APPLIED);
        assertThat(p.getDecidedAt()).isNotNull();
        // the Thursday one first (lighter day), then the Monday one — one line each
        assertThat(p.getLines()).extracting(WeekProposalLineJson::exerciseId)
            .containsExactly(b.thu2().getId(), b.mon2().getId());
        assertThat(p.getLines()).allSatisfy(l -> {
            assertThat(l.from()).isEqualTo(2);
            assertThat(l.to()).isEqualTo(3);
            assertThat(l.kind()).isEqualTo("sets");
            assertThat(l.muscleGroup()).isEqualTo("back");
            assertThat(l.decision()).isEqualTo("accepted");
            assertThat(l.reasons()).containsExactly("all_sets_done", "room_in_band");
            assertThat(l.id()).isNotBlank();
        });
        WeekProposalLineJson thu = p.getLines().get(0);
        assertThat(thu.exerciseName()).isEqualTo("Húzódzkodás");
        assertThat(thu.dayIndex()).isEqualTo(3);
        assertThat(p.getPlanAfter()).containsEntry(b.mon4().getId().toString(), 4)
            .containsEntry(b.thu2().getId().toString(), 3).hasSize(4);

        VolumeRecomputeJson audit = reload(b.meso()).getVolumeRecompute();
        assertThat(audit.lastRun()).isEqualTo("W2");
        assertThat(audit.nextRun()).isEqualTo("W3");
        assertThat(audit.trigger()).isEqualTo("weekly-rollover");
        assertThat(audit.changes()).singleElement().satisfies(c -> {
            assertThat(c.muscle()).isEqualTo("back");
            assertThat(c.change()).isEqualTo("+2 (11 → 13)");
        });
        assertThat(reload(b.meso()).getCurrentWeek()).isEqualTo(2);
        assertThat(ledger(b.meso(), "back").getSource().adjustments())
            .anyMatch(a -> a.label().equals("W2: +2 (11 → 13)"));
    }

    @Test
    void inADeficitItGainsOne() {
        goals.createGoal(owner, "cut", "active");
        Back b = back(2, "emphasize", true);

        workoutService.getToday(owner, null);

        assertThat(ledger(b.meso(), "back").getCurrentSets()).isEqualTo(12);
        assertThat(sets(b.thu2())).isEqualTo(3);
        assertThat(sets(b.mon2())).isEqualTo(2);
        assertThat(weekly(b.meso(), 2).getLines()).singleElement().satisfies(l -> {
            assertThat(l.exerciseId()).isEqualTo(b.thu2().getId());
            assertThat(l.reasons()).contains("deficit_pace");
        });
    }

    @Test
    void maintainedQuadStaysThree() {
        MesocycleEntity meso = run(2, NO_DELOAD, Map.of("quad", "maintain"));
        WorkoutSessionEntity mon = day(meso, "Hétfő", 0);
        ExerciseEntity squat = exercise(mon, "Guggolás", "quad", 3);
        logWeek(meso, 1, mon, 0, squat);

        workoutService.getToday(owner, null);

        assertThat(sets(squat)).isEqualTo(3);
        assertThat(weekly(meso, 2).getLines()).isEmpty();
        assertThat(reload(meso).getVolumeRecompute().changes())
            .anyMatch(c -> c.muscle().equals("quad") && c.change().equals("tart (3)"));
    }

    @Test
    void nothingLoggedLastWeekHolds() {
        Back b = back(2, "emphasize", false);

        workoutService.getToday(owner, null);

        assertThat(ledger(b.meso(), "back").getCurrentSets()).isEqualTo(11);
        assertThat(weekly(b.meso(), 2).getLines()).isEmpty();
        assertThat(reload(b.meso()).getVolumeRecompute().changes())
            .anyMatch(c -> c.muscle().equals("back") && c.change().equals("tart (11)"));
    }

    @Test
    void noSlotIsReportedNotDropped() {
        MesocycleEntity meso = run(2, NO_DELOAD, Map.of("back", "emphasize"));
        WorkoutSessionEntity mon = day(meso, "Hétfő", 0);
        WorkoutSessionEntity thu = day(meso, "Csütörtök", 3);
        ExerciseEntity row = exercise(mon, "Evezés", "back-mid", 5);
        ExerciseEntity pull = exercise(thu, "Húzódzkodás", "back-wide", 5);
        logWeek(meso, 1, mon, 0, row);
        logWeek(meso, 1, thu, 3, pull);

        workoutService.getToday(owner, null);

        assertThat(sets(row)).isEqualTo(5);
        assertThat(sets(pull)).isEqualTo(5);
        MesoWeekProposalEntity p = weekly(meso, 2);
        assertThat(p.getLines()).isEmpty();
        assertThat(p.getStatus()).isEqualTo(MesoWeekProposalEntity.STATUS_AUTO_APPLIED);
        assertThat(reload(meso).getVolumeRecompute().changes()).singleElement().satisfies(c -> {
            assertThat(c.muscle()).isEqualTo("back");
            assertThat(c.change()).contains("nincs hely");
        });
    }

    @Test
    void deloadHalvesAndTheNextWeekRestores() {
        MesocycleEntity meso = run(3, DELOAD_IN_WEEK_3, Map.of("quad", "maintain"));
        WorkoutSessionEntity mon = day(meso, "Hétfő", 0);
        ExerciseEntity squat = exercise(mon, "Guggolás", "quad", 4);
        ExerciseEntity lunge = exercise(mon, "Kitörés", "quad", 1);
        logWeek(meso, 2, mon, 0, squat, lunge);

        workoutService.getToday(owner, null);

        assertThat(sets(squat)).isEqualTo(2);
        assertThat(sets(lunge)).isEqualTo(1); // ⌈1/2⌉ = 1, min 1: no line
        MesoWeekProposalEntity deload = weekly(meso, 3);
        assertThat(deload.getLines()).singleElement().satisfies(l -> {
            assertThat(l.from()).isEqualTo(4);
            assertThat(l.to()).isEqualTo(2);
            assertThat(l.reasons()).containsExactly("deload");
        });
        assertThat(deload.getRestore()).containsExactly(Map.entry(squat.getId().toString(), 4));
        assertThat(reload(meso).getVolumeRecompute().changes()).singleElement().satisfies(c -> {
            assertThat(c.change()).isEqualTo("Deload 5 → 3");
            assertThat(c.warning()).isTrue();
        });

        // a week later: the run started one more week ago
        MesocycleEntity later = reload(meso);
        later.setStartDate(later.getStartDate().minusWeeks(1));
        later.setEndDate(later.getEndDate().minusWeeks(1));
        mesocycleRepository.saveAndFlush(later);
        workoutService.getToday(owner, null);

        assertThat(sets(squat)).isEqualTo(4);
        assertThat(sets(lunge)).isEqualTo(1);
        assertThat(weekly(meso, 4).getLines()).isEmpty();
        assertThat(reload(meso).getVolumeRecompute().lastRun()).isEqualTo("W4");
    }

    @Test
    void aSecondOpenOfTheSameWeekChangesNothing() {
        Back b = back(2, "emphasize", true);

        workoutService.getToday(owner, null);
        workoutService.getToday(owner, null);

        assertThat(ledger(b.meso(), "back").getCurrentSets()).isEqualTo(13);
        assertThat(proposalRepository.findAll()).hasSize(1);
        assertThat(ledger(b.meso(), "back").getSource().adjustments()).hasSize(1);
    }

    @Test
    void lineForAVanishedExerciseIsDropped() {
        Back b = back(2, "emphasize", true);

        assertThatCode(() -> new TransactionTemplate(transactionManager).executeWithoutResult(status -> {
            MesocycleEntity meso = mesocycleRepository.findById(b.meso().getId()).orElseThrow();
            MesoWeekProposalEntity p = proposals.build(owner, meso, 2).proposal();
            exerciseRepository.delete(exerciseRepository.findById(b.thu2().getId()).orElseThrow());
            proposals.apply(p);
        })).doesNotThrowAnyException();

        MesoWeekProposalEntity p = weekly(b.meso(), 2);
        assertThat(p.getLines()).extracting(WeekProposalLineJson::exerciseId, WeekProposalLineJson::decision)
            .containsExactly(
                org.assertj.core.groups.Tuple.tuple(b.thu2().getId(), "kept"),
                org.assertj.core.groups.Tuple.tuple(b.mon2().getId(), "accepted"));
        assertThat(sets(b.mon2())).isEqualTo(3);
        assertThat(p.getPlanAfter()).doesNotContainKey(b.thu2().getId().toString());
    }

    @Test
    void weekOneChangesNothing() {
        Back b = back(1, "emphasize", false);

        workoutService.getToday(owner, null);

        assertThat(proposalRepository.findAll()).isEmpty();
        assertThat(sets(b.mon2())).isEqualTo(2);
        MesocycleEntity after = reload(b.meso());
        assertThat(after.getCurrentWeek()).isEqualTo(1);
        assertThat(after.getVolumeRecompute().lastRun()).isEqualTo("W1");
        assertThat(after.getVolumeRecompute().changes()).isEmpty();

        // a second call inside the same calendar week is a no-op
        workoutService.getToday(owner, null);
        assertThat(proposalRepository.findAll()).isEmpty();
        assertThat(sets(b.mon2())).isEqualTo(2);
    }

    /** Re-creates VolumeProgressionServiceIT's clean-week ramp: a grow group with room steps +1,
     *  the week advances, the audit and the ledger follow, and a second call in the same week is a
     *  no-op. */
    @Test
    void aCleanWeekRampsAndAdvancesTheWeek() {
        MesocycleEntity meso = run(3, NO_DELOAD, Map.of());
        WorkoutSessionEntity mon = day(meso, "Hétfő", 0);
        WorkoutSessionEntity thu = day(meso, "Csütörtök", 3);
        ExerciseEntity bench = exercise(mon, "Fekvenyomás", "chest-mid", 3);
        ExerciseEntity fly = exercise(mon, "Tárogatás", "chest-mid", 2);
        ExerciseEntity incline = exercise(thu, "Ferde nyomás", "chest-upper", 3);
        ExerciseEntity dip = exercise(thu, "Tolódzkodás", "chest-lower", 2);
        logWeek(meso, 2, mon, 0, bench, fly);
        logWeek(meso, 2, thu, 3, incline, dip);

        workoutService.getToday(owner, null);

        assertThat(ledger(meso, "chest").getCurrentSets()).isEqualTo(11);
        MesocycleEntity after = reload(meso);
        assertThat(after.getCurrentWeek()).isEqualTo(3);
        assertThat(after.getVolumeRecompute().lastRun()).isEqualTo("W3");
        assertThat(after.getVolumeRecompute().changes()).singleElement().satisfies(c -> {
            assertThat(c.muscle()).isEqualTo("chest");
            assertThat(c.change()).isEqualTo("+1 (10 → 11)");
            assertThat(c.warning()).isNotEqualTo(Boolean.TRUE);
        });

        workoutService.getToday(owner, null); // same calendar week: nothing moves
        assertThat(ledger(meso, "chest").getCurrentSets()).isEqualTo(11);
        assertThat(reload(meso).getVolumeRecompute().lastRun()).isEqualTo("W3");
    }

    // ── fixtures ──────────────────────────────────────────────────────────────────────────────

    /** An active 6-week run that is now in {@code week} (started {@code week − 1} weeks ago). */
    private MesocycleEntity run(int week, List<String> curve, Map<String, String> priorities) {
        MesocycleEntity meso = train.activeMesoStartedWeeksAgo(owner, week - 1, 6, curve);
        meso.setMusclePriorities(priorities);
        return mesocycleRepository.saveAndFlush(meso);
    }

    private WorkoutSessionEntity day(MesocycleEntity meso, String label, int orderIndex) {
        return train.createWorkoutSession(owner, meso.getId(), label, "gym", orderIndex, "active");
    }

    private ExerciseEntity exercise(WorkoutSessionEntity day, String name, String muscle, int sets) {
        ExerciseEntity e = train.createExercise(owner, day.getId(), name, muscle, "compound");
        e.setWorkingSets(sets);
        return train.save(e);
    }

    /** One completed instance of {@code day} in {@code week}, every planned set of {@code exercises} logged. */
    private void logWeek(MesocycleEntity meso, int week, WorkoutSessionEntity day, int dayOffset,
                         ExerciseEntity... exercises) {
        WorkoutSessionEntity instance = train.createWorkoutInstance(owner, day,
            meso.getStartDate().plusDays(7L * (week - 1) + dayOffset), "completed");
        int i = 0;
        for (ExerciseEntity e : exercises) {
            for (int s = 0; s < e.getWorkingSets(); s++) {
                train.createLoggedSet(owner, e.getId(), instance.getId(), i++, "60", 8, 0);
            }
        }
    }

    private int sets(ExerciseEntity e) {
        return exerciseRepository.findById(e.getId()).orElseThrow().getWorkingSets();
    }

    private MesoWeekProposalEntity weekly(MesocycleEntity meso, int week) {
        return proposalRepository.findWeekly(owner, meso.getId(), week).orElseThrow();
    }

    private MuscleGroupVolumeLogEntity ledger(MesocycleEntity meso, String group) {
        return volumeRepo.findByCreatedByAndMesocycleIdInOrderByMuscleAsc(owner, List.of(meso.getId())).stream()
            .filter(r -> r.getMuscle().equals(group)).findFirst().orElseThrow();
    }

    private MesocycleEntity reload(MesocycleEntity meso) {
        return mesocycleRepository.findById(meso.getId()).orElseThrow();
    }
}
