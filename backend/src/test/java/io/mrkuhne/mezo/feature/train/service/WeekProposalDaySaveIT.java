package io.mrkuhne.mezo.feature.train.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.GymExerciseInput;
import io.mrkuhne.mezo.api.dto.MesocycleSettingsUpdateRequest;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.MesoWeekProposalEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.entity.json.WeekProposalLineJson;
import io.mrkuhne.mezo.feature.train.repository.ExerciseRepository;
import io.mrkuhne.mezo.feature.train.repository.MesoWeekProposalRepository;
import io.mrkuhne.mezo.feature.train.repository.MesocycleRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
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
 * A day saved from the block builder while a manual weekly proposal is pending (mezo-r36n9.83): the same
 * exercises in the same order are updated in place, so the proposal's set lines still find their rows and
 * are applied — before the fix the save re-minted every id and the lines were silently recorded "kept".
 * Same back fixture as {@code WeekProposalRunModeIT}.
 */
class WeekProposalDaySaveIT extends AbstractIntegrationTest {

    private static final List<String> NO_DELOAD = List.of("MEV", "MEV", "MAV", "MAV", "MRV", "Deload");

    @Autowired WorkoutService workoutService;
    @Autowired TrainService trainService;
    @Autowired WeekProposalService proposals;
    @Autowired TrainPopulator train;
    @Autowired DatabasePopulator databasePopulator;
    @Autowired MesocycleRepository mesocycleRepository;
    @Autowired ExerciseRepository exerciseRepository;
    @Autowired MesoWeekProposalRepository proposalRepository;
    @Autowired PlatformTransactionManager transactionManager;

    private UUID owner;

    @BeforeEach
    void setUp() {
        owner = databasePopulator.populateUser("week-proposal-day-save@test.local");
    }

    @Test
    void aPendingSetLineIsStillAppliedAfterASameListDaySave() {
        MesocycleEntity meso = back();
        trainService.updateSettings(owner, meso.getId(),
            MesocycleSettingsUpdateRequest.builder().weeklyReviewMode("manual").build());
        workoutService.getToday(owner, null);

        MesoWeekProposalEntity pending = proposalRepository.findWeekly(owner, meso.getId(), 2).orElseThrow();
        assertThat(pending.getStatus()).isEqualTo(MesoWeekProposalEntity.STATUS_PENDING);
        WeekProposalLineJson line = pending.getLines().stream()
            .filter(l -> WeekProposalLineJson.KIND_SETS.equals(l.kind())).findFirst().orElseThrow();
        ExerciseEntity target = exerciseRepository.findById(line.exerciseId()).orElseThrow();
        UUID dayId = target.getWorkoutSessionId();

        // the block builder saves that day: the same exercises, one unrelated value changed (warm-up sets)
        List<ExerciseEntity> before = exerciseRepository
            .findByCreatedByAndWorkoutSessionIdInOrderByOrderIndexAsc(owner, List.of(dayId));
        trainService.replaceDayExercises(owner, meso.getId(), dayId, before.stream()
            .map(e -> GymExerciseInput.builder().name(e.getName()).muscle(e.getMuscle())
                .warmupSets(e.getWarmupSets() + 1).workingSets(e.getWorkingSets()).repMin(e.getRepMin())
                .repMax(e.getRepMax()).targetRIR(e.getTargetRir()).type(GymExerciseInput.TypeEnum.COMPOUND)
                .build())
            .toList());
        assertThat(exerciseRepository.findByCreatedByAndWorkoutSessionIdInOrderByOrderIndexAsc(owner, List.of(dayId)))
            .extracting(ExerciseEntity::getId)
            .containsExactlyElementsOf(before.stream().map(ExerciseEntity::getId).toList());

        // he accepts that line
        new TransactionTemplate(transactionManager).executeWithoutResult(status -> {
            MesoWeekProposalEntity p = proposalRepository.findWeekly(owner, meso.getId(), 2).orElseThrow();
            p.setLines(p.getLines().stream()
                .map(l -> l.id().equals(line.id()) ? proposals.applySetLine(p, l) : l).toList());
            proposals.close(p, MesoWeekProposalEntity.STATUS_APPLIED);
        });

        MesoWeekProposalEntity applied = proposalRepository.findWeekly(owner, meso.getId(), 2).orElseThrow();
        assertThat(applied.getLines()).filteredOn(l -> l.id().equals(line.id()))
            .extracting(WeekProposalLineJson::decision).containsExactly(WeekProposalLineJson.DECISION_ACCEPTED);
        assertThat(exerciseRepository.findById(line.exerciseId()).orElseThrow().getWorkingSets())
            .isEqualTo(line.to());
    }

    /** Back at 11 (Mon 4 + 2, Thu 3 + 2), emphasized, every planned set logged in week 1; the run is in week 2. */
    private MesocycleEntity back() {
        MesocycleEntity meso = train.activeMesoStartedWeeksAgo(owner, 1, 6, NO_DELOAD);
        meso.setMusclePriorities(Map.of("back", "emphasize"));
        meso = mesocycleRepository.saveAndFlush(meso);
        WorkoutSessionEntity mon = train.createWorkoutSession(owner, meso.getId(), "Hétfő", "gym", 0, "active");
        WorkoutSessionEntity thu = train.createWorkoutSession(owner, meso.getId(), "Csütörtök", "gym", 3, "active");
        ExerciseEntity mon4 = exercise(mon, "Evezés", "back-mid", 4, 0);
        ExerciseEntity mon2 = exercise(mon, "Lehúzás", "back-wide", 2, 1);
        ExerciseEntity thu3 = exercise(thu, "Kábeles evezés", "back-mid", 3, 0);
        ExerciseEntity thu2 = exercise(thu, "Húzódzkodás", "back-wide", 2, 1);
        logWeek(meso, mon, 0, mon4, mon2);
        logWeek(meso, thu, 3, thu3, thu2);
        return meso;
    }

    private ExerciseEntity exercise(WorkoutSessionEntity day, String name, String muscle, int sets, int order) {
        ExerciseEntity e = train.createExercise(owner, day.getId(), name, muscle, "compound");
        e.setWorkingSets(sets);
        e.setOrderIndex(order); // a strict order: the same-list save aligns by position
        return train.save(e);
    }

    private void logWeek(MesocycleEntity meso, WorkoutSessionEntity day, int dayOffset, ExerciseEntity... exercises) {
        WorkoutSessionEntity instance = train.createWorkoutInstance(owner, day,
            meso.getStartDate().plusDays(dayOffset), "completed");
        int i = 0;
        for (ExerciseEntity e : exercises) {
            for (int s = 0; s < e.getWorkingSets(); s++) {
                train.createLoggedSet(owner, e.getId(), instance.getId(), i++, "60", 8, 0);
            }
        }
    }
}
