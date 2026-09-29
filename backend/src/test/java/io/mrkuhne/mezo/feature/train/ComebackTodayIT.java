package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.PrescribedSet;
import io.mrkuhne.mezo.api.dto.ProgressionSignal;
import io.mrkuhne.mezo.api.dto.TodayComeback;
import io.mrkuhne.mezo.api.dto.TodayExercise;
import io.mrkuhne.mezo.api.dto.WorkoutTodayResponse;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.PlannedSkipEntity.Reason;
import io.mrkuhne.mezo.feature.train.entity.RecoveryPeriodEntity;
import io.mrkuhne.mezo.feature.train.entity.RecoveryPeriodEntity.Estimate;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.repository.WorkoutDayAdjustmentRepository;
import io.mrkuhne.mezo.feature.train.service.WorkoutService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.RecoveryPeriodPopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

/**
 * Kímélő mód comeback (Kihagyás S2, mezo-q4xt2.2, spec 2026-09-28 §9.1.4 + §9.1.6): the read-time
 * lightening of {@link WorkoutService#getToday} — the first 1–2 gym sessions after a recovery
 * period ends (a third fewer sets, ≈90% load then a hold, RIR ≥ 3) and a released protected day
 * that keeps its lightening. No {@code workout_day_adjustment} row is ever written.
 */
@Transactional
class ComebackTodayIT extends AbstractIntegrationTest {

    @Autowired WorkoutService workoutService;
    @Autowired TrainPopulator train;
    @Autowired RecoveryPeriodPopulator recovery;
    @Autowired UserPopulator users;
    @Autowired WorkoutDayAdjustmentRepository adjustments;

    private UUID owner;
    private WorkoutSessionEntity day;
    private ExerciseEntity squat;

    /** Per test, never a class-load constant (midnight-fragile fixtures). */
    private static LocalDate today() {
        return LocalDate.now();
    }

    /**
     * Today's gym day: a squat of 4 working sets (repMax 8, target RIR 0) last trained 10 days ago
     * at 100 kg × 8 — normally a weight increase.
     */
    private void fixture() {
        owner = users.createUser().getId();
        var meso = train.createActiveMeso(owner);
        String label = WorkoutService.HU_DAY_LABELS.get(today().getDayOfWeek().getValue() - 1);
        day = train.createTemplateDay(owner, meso.getId(), label);
        squat = train.createExercise(owner, day.getId(), "Guggolás", "quad", "compound");
        squat.setWorkingSets(4);
        train.save(squat);
        var last = train.createWorkoutInstance(owner, day, today().minusDays(10), "completed");
        train.createLoggedSet(owner, squat.getId(), last.getId(), 0, "100", 8, 0);
    }

    /** A completed session on {@code date} whose top working set is {@code kg} × 8. */
    private void completedOn(LocalDate date, String kg) {
        var s = train.createWorkoutInstance(owner, day, date, "completed");
        train.createLoggedSet(owner, squat.getId(), s.getId(), 0, kg, 8, 3);
    }

    @Test
    void testGetToday_shouldPrescribeFirstRampSession_whenPeriodEndedTodayAfterFourDays() {
        fixture();
        recovery.ended(owner, Reason.ILLNESS, today().minusDays(4), today());

        WorkoutTodayResponse res = workoutService.getToday(owner, null);

        assertComeback(res.getComeback(), 1, 2, TodayComeback.ModeEnum.RAMP);
        TodayExercise sq = only(res);
        assertThat(sq.getWorkingSets()).isEqualTo(3);
        assertThat(working(sq)).hasSize(3).allSatisfy(s -> {
            assertThat(s.getTargetWeightKg()).isEqualByComparingTo("90");
            assertThat(s.getTargetRIR()).isGreaterThanOrEqualTo(3);
        });
        assertThat(sq.getProgression().getLever()).isEqualTo(ProgressionSignal.LeverEnum.DELOAD);
        assertThat(sq.getProgression().getTargetWeightKg()).isEqualByComparingTo("90");
        assertThat(sq.getRationale()).isEqualTo("Visszatérő edzés — kb. 10%-kal könnyebb");
        assertThat(adjustments.findByCreatedByAndDateAndDeletedFalse(owner, today())).isEmpty();
    }

    @Test
    void testGetToday_shouldHoldSecondRampSession_whenOneSessionDoneSinceReturn() {
        fixture();
        recovery.ended(owner, Reason.ILLNESS, today().minusDays(7), today().minusDays(3));
        completedOn(today().minusDays(2), "90");

        WorkoutTodayResponse res = workoutService.getToday(owner, null);

        assertComeback(res.getComeback(), 2, 2, TodayComeback.ModeEnum.RAMP);
        TodayExercise sq = only(res);
        assertThat(sq.getWorkingSets()).isEqualTo(3);
        assertThat(working(sq)).hasSize(3).allSatisfy(s -> {
            assertThat(s.getTargetWeightKg()).isEqualByComparingTo("90");
            assertThat(s.getTargetRIR()).isGreaterThanOrEqualTo(3);
        });
        assertThat(sq.getProgression().getLever()).isEqualTo(ProgressionSignal.LeverEnum.HOLD);
    }

    @Test
    void testGetToday_shouldPrescribeNormally_whenRampSessionsAllDone() {
        fixture();
        recovery.ended(owner, Reason.ILLNESS, today().minusDays(8), today().minusDays(4));
        completedOn(today().minusDays(3), "90");
        completedOn(today().minusDays(1), "90");

        WorkoutTodayResponse res = workoutService.getToday(owner, null);

        assertThat(res.getComeback()).isNull();
        TodayExercise sq = only(res);
        assertThat(sq.getWorkingSets()).isEqualTo(4);
        assertThat(sq.getProgression().getLever()).isEqualTo(ProgressionSignal.LeverEnum.WEIGHT);
        assertThat(working(sq)).allSatisfy(s -> assertThat(s.getTargetRIR()).isZero());
    }

    @Test
    void testGetToday_shouldPrescribeNormally_whenComebackWaived() {
        fixture();
        RecoveryPeriodEntity p = recovery.ended(owner, Reason.ILLNESS, today().minusDays(4), today());
        p.setComebackWaived(true);
        recovery.save(p);

        WorkoutTodayResponse res = workoutService.getToday(owner, null);

        assertThat(res.getComeback()).isNull();
        assertThat(only(res).getWorkingSets()).isEqualTo(4);
        assertThat(only(res).getProgression().getLever()).isEqualTo(ProgressionSignal.LeverEnum.WEIGHT);
    }

    @Test
    void testGetToday_shouldLightenReleasedDay_whenReleaseKeepsLightening() {
        fixture();
        RecoveryPeriodEntity p = recovery.open(owner, Reason.STOMACH, today().minusDays(2), Estimate.WEEK);
        recovery.release(p, today(), true);

        WorkoutTodayResponse res = workoutService.getToday(owner, null);

        assertComeback(res.getComeback(), 1, 1, TodayComeback.ModeEnum.RELEASED);
        TodayExercise sq = only(res);
        assertThat(sq.getWorkingSets()).isEqualTo(3);
        assertThat(working(sq)).hasSize(3).allSatisfy(s -> {
            assertThat(s.getTargetWeightKg()).isEqualByComparingTo("90");
            assertThat(s.getTargetRIR()).isGreaterThanOrEqualTo(3);
        });
    }

    @Test
    void testGetToday_shouldPrescribeNormally_whenReleaseWaivesLightening() {
        fixture();
        RecoveryPeriodEntity p = recovery.open(owner, Reason.STOMACH, today().minusDays(2), Estimate.WEEK);
        recovery.release(p, today(), false);

        WorkoutTodayResponse res = workoutService.getToday(owner, null);

        assertThat(res.getComeback()).isNull();
        assertThat(only(res).getWorkingSets()).isEqualTo(4);
        assertThat(only(res).getProgression().getLever()).isEqualTo(ProgressionSignal.LeverEnum.WEIGHT);
    }

    @Test
    void testGetToday_shouldRampOneSession_whenContinueRule() {
        fixture();
        recovery.ended(owner, Reason.ILLNESS, today().minusDays(4), today().minusDays(2));

        assertComeback(workoutService.getToday(owner, null).getComeback(), 1, 1, TodayComeback.ModeEnum.RAMP);

        completedOn(today().minusDays(1), "90");

        WorkoutTodayResponse res = workoutService.getToday(owner, null);
        assertThat(res.getComeback()).isNull();
        assertThat(only(res).getWorkingSets()).isEqualTo(4);
    }

    private static void assertComeback(TodayComeback c, int index, int total, TodayComeback.ModeEnum mode) {
        assertThat(c).isNotNull();
        assertThat(c.getIndex()).isEqualTo(index);
        assertThat(c.getTotal()).isEqualTo(total);
        assertThat(c.getMode()).isEqualTo(mode);
    }

    private TodayExercise only(WorkoutTodayResponse res) {
        return res.getExercises().stream().filter(e -> e.getId().equals(squat.getId())).findFirst().orElseThrow();
    }

    private static List<PrescribedSet> working(TodayExercise e) {
        return e.getPrescribedSets().stream().filter(s -> s.getKind() == PrescribedSet.KindEnum.WORKING).toList();
    }
}
