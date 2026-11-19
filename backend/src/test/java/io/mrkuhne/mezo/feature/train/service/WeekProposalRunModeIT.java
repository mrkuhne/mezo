package io.mrkuhne.mezo.feature.train.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.MesocycleSettingsUpdateRequest;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.MesoWeekProposalEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
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

/**
 * The run's own weekly review mode (mezo-r36n9.83, decision #51) overrides the server default
 * ({@code mezo.volume.weekly-review.mode}, auto in the test profile): a run switched to manual through the
 * settings PUT gets its next weekly proposal {@code pending} with nothing written; a run without its own mode
 * keeps the default's auto-apply. Same back fixture as {@code WeekProposalManualIT}.
 */
class WeekProposalRunModeIT extends AbstractIntegrationTest {

    private static final List<String> NO_DELOAD = List.of("MEV", "MEV", "MAV", "MAV", "MRV", "Deload");

    @Autowired WorkoutService workoutService;
    @Autowired TrainService trainService;
    @Autowired TrainPopulator train;
    @Autowired DatabasePopulator databasePopulator;
    @Autowired MesocycleRepository mesocycleRepository;
    @Autowired ExerciseRepository exerciseRepository;
    @Autowired MesoWeekProposalRepository proposalRepository;

    private UUID owner;

    @BeforeEach
    void setUp() {
        owner = databasePopulator.populateUser("week-proposal-run-mode@test.local");
    }

    private record Back(MesocycleEntity meso, ExerciseEntity mon2, ExerciseEntity thu2) {}

    /** Back at 11 (Mon 4 + 2, Thu 3 + 2), emphasized, every planned set logged in week 1; the run is in week 2. */
    private Back back() {
        MesocycleEntity meso = train.activeMesoStartedWeeksAgo(owner, 1, 6, NO_DELOAD);
        meso.setMusclePriorities(Map.of("back", "emphasize"));
        meso = mesocycleRepository.saveAndFlush(meso);
        WorkoutSessionEntity mon = train.createWorkoutSession(owner, meso.getId(), "Hétfő", "gym", 0, "active");
        WorkoutSessionEntity thu = train.createWorkoutSession(owner, meso.getId(), "Csütörtök", "gym", 3, "active");
        ExerciseEntity mon4 = exercise(mon, "Evezés", "back-mid", 4);
        ExerciseEntity mon2 = exercise(mon, "Lehúzás", "back-wide", 2);
        ExerciseEntity thu3 = exercise(thu, "Kábeles evezés", "back-mid", 3);
        ExerciseEntity thu2 = exercise(thu, "Húzódzkodás", "back-wide", 2);
        logWeek(meso, mon, 0, mon4, mon2);
        logWeek(meso, thu, 3, thu3, thu2);
        return new Back(meso, mon2, thu2);
    }

    @Test
    void aRunSwitchedToManualGetsAPendingProposalAndNothingIsWritten() {
        Back b = back();
        trainService.updateSettings(owner, b.meso().getId(),
            MesocycleSettingsUpdateRequest.builder().weeklyReviewMode("manual").build());

        workoutService.getToday(owner, null);

        MesoWeekProposalEntity p = proposalRepository.findWeekly(owner, b.meso().getId(), 2).orElseThrow();
        assertThat(p.getStatus()).isEqualTo(MesoWeekProposalEntity.STATUS_PENDING);
        assertThat(p.getLines()).isNotEmpty();
        assertThat(sets(b.mon2())).isEqualTo(2);
        assertThat(sets(b.thu2())).isEqualTo(2);
    }

    @Test
    void aRunWithoutItsOwnModeFollowsTheAutoDefault() {
        Back b = back();

        workoutService.getToday(owner, null);

        MesoWeekProposalEntity p = proposalRepository.findWeekly(owner, b.meso().getId(), 2).orElseThrow();
        assertThat(p.getStatus()).isEqualTo(MesoWeekProposalEntity.STATUS_AUTO_APPLIED);
        assertThat(sets(b.mon2()) + sets(b.thu2())).isGreaterThan(4);
    }

    private ExerciseEntity exercise(WorkoutSessionEntity day, String name, String muscle, int sets) {
        ExerciseEntity e = train.createExercise(owner, day.getId(), name, muscle, "compound");
        e.setWorkingSets(sets);
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

    private int sets(ExerciseEntity e) {
        return exerciseRepository.findById(e.getId()).orElseThrow().getWorkingSets();
    }
}
