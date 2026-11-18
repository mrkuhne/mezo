package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.WeekProposal;
import io.mrkuhne.mezo.api.dto.WeekProposalLine;
import io.mrkuhne.mezo.api.dto.WeekProposalMuscle;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.repository.ExerciseRepository;
import io.mrkuhne.mezo.feature.train.repository.MesocycleRepository;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;

/**
 * The weekly-proposal read in the default {@code auto} mode (mezo-r36n9.78): the week's proposal is applied
 * at once, so the read shows it {@code auto_applied} with every line accepted; a run that is not active
 * has no proposals to show.
 */
class WeekProposalApiAutoIT extends ApiIntegrationTest {

    private static final List<String> CURVE = List.of("MEV", "MEV", "MAV", "MAV", "MRV", "Deload");

    @Autowired private TrainPopulator train;
    @Autowired private MesocycleRepository mesocycleRepository;
    @Autowired private ExerciseRepository exerciseRepository;

    @Test
    void autoModeReadShowsTheWeekAutoApplied() {
        RegisteredUser u = registerUser("Week Proposal Auto");
        MesocycleEntity meso = backRun(u.id());

        List<WeekProposal> proposals = getForList(url(meso), u.headers(), HttpStatus.OK, WeekProposal.class);

        assertThat(proposals).singleElement().satisfies(p -> {
            assertThat(p.getWeek()).isEqualTo(2);
            assertThat(p.getStatus()).isEqualTo(WeekProposal.StatusEnum.AUTO_APPLIED);
            assertThat(p.getMode()).isEqualTo(WeekProposal.ModeEnum.AUTO);
            assertThat(p.getDecidedAt()).isNotNull();
            assertThat(p.getLines()).isNotEmpty().allSatisfy(l ->
                assertThat(l.getDecision()).isEqualTo(WeekProposalLine.DecisionEnum.ACCEPTED));
            WeekProposalMuscle back = p.getMuscles().stream().filter(m -> "back".equals(m.getMuscle()))
                .findFirst().orElseThrow();
            assertThat(back.getSetsBefore()).isEqualTo(11);
            assertThat(back.getSetsAfter()).isEqualTo(13);
        });
        int total = exerciseRepository.findAll().stream()
            .filter(e -> u.id().equals(e.getCreatedBy())).mapToInt(ExerciseEntity::getWorkingSets).sum();
        assertThat(total).isEqualTo(13);
    }

    @Test
    void aRunThatIsNotActiveHasNoProposals() {
        RegisteredUser u = registerUser("Week Proposal Planned");
        MesocycleEntity meso = backRun(u.id());
        meso.setStatus("planned");
        mesocycleRepository.saveAndFlush(meso);

        assertThat(getForList(url(meso), u.headers(), HttpStatus.OK, WeekProposal.class)).isEmpty();
    }

    /** Back at 11 (Mon 4 + 2, Thu 3 + 2), emphasized, every planned set logged in week 1; the run is in week 2. */
    private MesocycleEntity backRun(UUID owner) {
        MesocycleEntity meso = train.activeMesoStartedWeeksAgo(owner, 1, 6, CURVE);
        meso.setMusclePriorities(Map.of("back", "emphasize"));
        meso = mesocycleRepository.saveAndFlush(meso);
        WorkoutSessionEntity mon = train.createWorkoutSession(owner, meso.getId(), "Hétfő", "gym", 0, "active");
        WorkoutSessionEntity thu = train.createWorkoutSession(owner, meso.getId(), "Csütörtök", "gym", 3, "active");
        logWeek(owner, meso, mon, 0, exercise(owner, mon, "Evezés", "back-mid", 4),
            exercise(owner, mon, "Lehúzás", "back-wide", 2));
        logWeek(owner, meso, thu, 3, exercise(owner, thu, "Kábeles evezés", "back-mid", 3),
            exercise(owner, thu, "Húzódzkodás", "back-wide", 2));
        return meso;
    }

    private ExerciseEntity exercise(UUID owner, WorkoutSessionEntity day, String name, String muscle, int sets) {
        ExerciseEntity e = train.createExercise(owner, day.getId(), name, muscle, "compound");
        e.setWorkingSets(sets);
        return train.save(e);
    }

    private void logWeek(UUID owner, MesocycleEntity meso, WorkoutSessionEntity day, int dayOffset,
                         ExerciseEntity... exercises) {
        WorkoutSessionEntity instance = train.createWorkoutInstance(owner, day,
            meso.getStartDate().plusDays(dayOffset), "completed");
        int i = 0;
        for (ExerciseEntity e : exercises) {
            for (int s = 0; s < e.getWorkingSets(); s++) {
                train.createLoggedSet(owner, e.getId(), instance.getId(), i++, "60", 8, 0);
            }
        }
    }

    private static String url(MesocycleEntity meso) {
        return "/api/train/mesocycles/" + meso.getId() + "/week-proposals";
    }
}
