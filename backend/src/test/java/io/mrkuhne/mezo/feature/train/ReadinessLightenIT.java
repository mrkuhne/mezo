package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.PrescribedSet;
import io.mrkuhne.mezo.api.dto.ProgressionSignal;
import io.mrkuhne.mezo.api.dto.ReadinessChoiceRequest;
import io.mrkuhne.mezo.api.dto.TodayExercise;
import io.mrkuhne.mezo.api.dto.WorkoutTodayResponse;
import io.mrkuhne.mezo.feature.biometrics.checkin.entity.PainRegion;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.ReadinessChoiceEntity.Choice;
import io.mrkuhne.mezo.feature.train.service.ReadinessService;
import io.mrkuhne.mezo.feature.train.service.WorkoutService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.CheckInPopulator;
import io.mrkuhne.mezo.support.populator.ReadinessChoicePopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

/**
 * Check-in 2.0 readiness „Könnyítsük" (mezo-ck2): the LIGHTEN choice as a read-time overlay on
 * {@link WorkoutService#getToday} — every prescription held at last week, the pain-loaded
 * exercise's heavy sets dropped, reversible by undo, logged sets untouched.
 */
@Transactional
class ReadinessLightenIT extends AbstractIntegrationTest {

    @Autowired WorkoutService workoutService;
    @Autowired ReadinessService readinessService;
    @Autowired TrainPopulator train;
    @Autowired CheckInPopulator checkIns;
    @Autowired ReadinessChoicePopulator choices;
    @Autowired io.mrkuhne.mezo.support.populator.UserPopulator users;

    private static final LocalDate TODAY = LocalDate.now();

    private ExerciseEntity bench;
    private ExerciseEntity rearDelt;

    /**
     * Today's day: a bench (last week 8×60 at repMax 8 → normally +5 kg) and a rear-delt fly
     * (last week 8×20 → normally +2.5 kg); this morning the shoulder hurts (5/10).
     */
    private UUID fixture() {
        UUID owner = ownerId();
        var meso = train.createActiveMeso(owner);
        String todayLabel = WorkoutService.HU_DAY_LABELS.get(TODAY.getDayOfWeek().getValue() - 1);
        var day = train.createTemplateDay(owner, meso.getId(), todayLabel);
        bench = train.createExercise(owner, day.getId(), "Fekvenyomás", "chest", "compound");
        rearDelt = train.createExercise(owner, day.getId(), "Rear Delt Fly", 1, "shoulder-rear", "isolation", null);
        var last = train.createWorkoutInstance(owner, day, TODAY.minusDays(7), "completed");
        train.createLoggedSet(owner, bench.getId(), last.getId(), 0, "60", 8, 0);
        train.createLoggedSet(owner, rearDelt.getId(), last.getId(), 1, "20", 8, 1);
        checkIns.createCheckIn(owner, TODAY, "06:30", c -> {
            c.setSoreness(8);
            c.setPain(true);
            c.setPainRegions(List.of(PainRegion.VALL));
            c.setPainIntensity(5);
        });
        return owner;
    }

    @Test
    void testGetToday_shouldProgressNormally_whenNoChoice() {
        UUID owner = fixture();

        TodayExercise b = byId(workoutService.getToday(owner, null), bench.getId());

        assertThat(b.getProgression().getLever()).isEqualTo(ProgressionSignal.LeverEnum.WEIGHT);
        assertThat(b.getProgression().getTargetWeightKg()).isEqualByComparingTo("65");
    }

    @Test
    void testGetToday_shouldHoldEveryWeight_whenLightenChosen() {
        UUID owner = fixture();
        choices.createChoice(owner, TODAY, Choice.LIGHTEN);

        WorkoutTodayResponse res = workoutService.getToday(owner, null);

        TodayExercise b = byId(res, bench.getId());
        assertThat(b.getProgression().getLever()).isEqualTo(ProgressionSignal.LeverEnum.HOLD);
        assertThat(b.getProgression().getTargetWeightKg()).isEqualByComparingTo("60");
        assertThat(b.getWorkingSets()).isEqualTo(3); // not a care exercise — sets unchanged
        assertThat(working(b)).hasSize(3).allSatisfy(s -> {
            assertThat(s.getTargetWeightKg()).isEqualByComparingTo("60");
            assertThat(s.getTargetReps()).isEqualTo(8);
        });
        assertThat(res.getOverloadSummary().getWeightUp()).isZero();
    }

    @Test
    void testGetToday_shouldDropCareExerciseHeavySets_whenLightenChosen() {
        UUID owner = fixture();
        choices.createChoice(owner, TODAY, Choice.LIGHTEN);

        TodayExercise r = byId(workoutService.getToday(owner, null), rearDelt.getId());

        assertThat(r.getWorkingSets()).isEqualTo(1);
        List<PrescribedSet> work = working(r);
        assertThat(work).hasSize(1);
        BigDecimal topWarmup = r.getPrescribedSets().stream()
            .filter(s -> s.getKind() == PrescribedSet.KindEnum.WARMUP)
            .map(PrescribedSet::getTargetWeightKg)
            .max(BigDecimal::compareTo).orElseThrow();
        assertThat(work.get(0).getTargetWeightKg()).isEqualByComparingTo(topWarmup);
        assertThat(work.get(0).getTargetWeightKg()).isLessThan(new BigDecimal("20"));
        assertThat(r.getRationale()).contains("vállad").contains("nehéz szettek kimaradnak");
    }

    @Test
    void testGetToday_shouldNotLighten_whenKeepChosen() {
        UUID owner = fixture();
        choices.createChoice(owner, TODAY, Choice.KEEP);

        WorkoutTodayResponse res = workoutService.getToday(owner, null);

        assertThat(byId(res, bench.getId()).getProgression().getLever()).isEqualTo(ProgressionSignal.LeverEnum.WEIGHT);
        assertThat(byId(res, rearDelt.getId()).getWorkingSets()).isEqualTo(3);
    }

    @Test
    void testGetToday_shouldRestoreNormalPrescriptions_whenLightenUndone() {
        UUID owner = fixture();
        readinessService.choose(owner, ReadinessChoiceRequest.builder()
            .choice(ReadinessChoiceRequest.ChoiceEnum.LIGHTEN).build());
        assertThat(byId(workoutService.getToday(owner, null), bench.getId()).getProgression().getLever())
            .isEqualTo(ProgressionSignal.LeverEnum.HOLD);

        readinessService.undo(owner);

        WorkoutTodayResponse res = workoutService.getToday(owner, null);
        assertThat(byId(res, bench.getId()).getProgression().getLever()).isEqualTo(ProgressionSignal.LeverEnum.WEIGHT);
        assertThat(byId(res, rearDelt.getId()).getWorkingSets()).isEqualTo(3);
    }

    @Test
    void testGetToday_shouldKeepLoggedSets_whenLightenChosenMidWorkout() {
        UUID owner = fixture();
        var open = train.startInstance(owner, rearDelt.getWorkoutSessionId());
        train.createLoggedSet(owner, bench.getId(), open.getId(), 0, "65", 6, 0);

        readinessService.choose(owner, ReadinessChoiceRequest.builder()
            .choice(ReadinessChoiceRequest.ChoiceEnum.LIGHTEN).build());
        WorkoutTodayResponse res = workoutService.getToday(owner, null);

        assertThat(res.getOpenWorkout().getSets()).singleElement().satisfies(s -> {
            assertThat(s.getWeightKg()).isEqualByComparingTo("65");
            assertThat(s.getReps()).isEqualTo(6);
        });
        assertThat(byId(res, bench.getId()).getProgression().getLever()).isEqualTo(ProgressionSignal.LeverEnum.HOLD);
    }

    /** A fresh, FK-valid user per test — the principal under test. */
    private UUID ownerId() {
        return users.createUser().getId();
    }

    private static TodayExercise byId(WorkoutTodayResponse res, UUID id) {
        return res.getExercises().stream().filter(e -> e.getId().equals(id)).findFirst().orElseThrow();
    }

    private static List<PrescribedSet> working(TodayExercise e) {
        return e.getPrescribedSets().stream().filter(s -> s.getKind() == PrescribedSet.KindEnum.WORKING).toList();
    }
}
