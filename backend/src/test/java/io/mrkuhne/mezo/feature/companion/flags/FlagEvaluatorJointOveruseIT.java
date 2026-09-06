package io.mrkuhne.mezo.feature.companion.flags;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.flags.entity.FlagPayloadEnvelope;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagEvaluator;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagKey;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagOutcome;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagVerdict;
import io.mrkuhne.mezo.feature.companion.flags.service.UnavailableReason;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.service.WorkoutService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * Spec 2026-09-03 §4 row 16 (rank 4, offers {@code lighten_tomorrow} — wired by a later task):
 * sport {@code SHOULDER_STRAIN} 7-day average at or above {@code strainAvgAtLeast} (config
 * default 5.0) AND tomorrow's planned gym session is shoulder-focused (muscle, normalised through
 * {@code MuscleGroup.of}, matches the configured {@code muscleNeedle}, default {@code "shoulder"}).
 *
 * <p>Tomorrow's planned session is read via {@link WorkoutService#findPlannedTemplateForDate} —
 * never {@code getToday}, which WRITES (auto-close/rollover) on every call.
 */
class FlagEvaluatorJointOveruseIT extends AbstractIntegrationTest {

    private static final String SHOULDER = "shoulder";
    private static final String LEG = "quad";

    @Autowired private FlagEvaluator evaluator;
    @Autowired private TrainPopulator trainPopulator;
    @Autowired private UserPopulator userPopulator;

    private UUID ownerId() {
        return userPopulator.createUser().getId();
    }

    private List<String> keys(UUID owner) {
        return raisedKeys(evaluator.evaluate(owner));
    }

    /** The keys that actually RAISED — the old evaluate() return, reconstructed. */
    private static List<String> raisedKeys(List<FlagVerdict> verdicts) {
        return verdicts.stream()
            .filter(v -> v.outcome() == FlagOutcome.RAISED)
            .map(FlagVerdict::flagKey)
            .toList();
    }

    private static FlagVerdict verdictFor(List<FlagVerdict> verdicts, String flagKey) {
        return verdicts.stream().filter(v -> flagKey.equals(v.flagKey())).findFirst().orElseThrow();
    }

    private Optional<FlagPayloadEnvelope.JointOveruse> payload(UUID owner) {
        return evaluator.evaluate(owner).stream()
            .filter(v -> FlagKey.JOINT_OVERUSE.equals(v.flagKey()))
            .filter(v -> v.outcome() == FlagOutcome.RAISED)
            .map(v -> v.payload().jointOveruse())
            .findFirst();
    }

    /** {@code windowDays} strain readings ending TODAY (one sport session/day, no nulls). */
    private void strainDays(UUID owner, LocalDate today, int... strains) {
        int n = strains.length;
        for (int i = 0; i < n; i++) {
            trainPopulator.createSportSessionWithShoulderStrain(
                owner, today.minusDays(n - 1 - i), 60, strains[i]);
        }
    }

    /**
     * A planned (template) gym day for tomorrow with the given {@code muscle}. The populator's
     * {@code createWorkoutSession} hardcodes {@code muscle} to {@code "hát"} (back), so this
     * builds the session normally, then overwrites the muscle field and re-saves via the
     * populator's {@code save} passthrough — no new populator method needed for this one field.
     */
    private void plannedTomorrow(UUID owner, LocalDate today, String muscle) {
        MesocycleEntity meso = trainPopulator.createActiveMeso(owner);
        LocalDate tomorrow = today.plusDays(1);
        String dayLabel = WorkoutService.HU_DAY_LABELS.get(tomorrow.getDayOfWeek().getValue() - 1);
        WorkoutSessionEntity session = trainPopulator.createWorkoutSession(
            owner, meso.getId(), dayLabel, "gym", 0, "active");
        session.setMuscle(muscle);
        trainPopulator.save(session);
    }

    @Test
    void raises_when_shoulder_strain_is_high_and_tomorrow_is_a_shoulder_day() {
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        strainDays(owner, today, 8, 8, 8, 8, 8, 8, 8);
        plannedTomorrow(owner, today, SHOULDER);

        assertThat(keys(owner)).contains(FlagKey.JOINT_OVERUSE);
    }

    @Test
    void stays_silent_when_shoulder_strain_is_high_but_tomorrow_is_a_leg_day() {
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        strainDays(owner, today, 8, 8, 8, 8, 8, 8, 8);
        plannedTomorrow(owner, today, LEG);

        assertThat(keys(owner)).doesNotContain(FlagKey.JOINT_OVERUSE);
    }

    @Test
    void stays_silent_when_shoulder_strain_is_high_but_nothing_is_planned_for_tomorrow() {
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        strainDays(owner, today, 8, 8, 8, 8, 8, 8, 8);
        // No mesocycle / planned session created at all.

        assertThat(keys(owner)).doesNotContain(FlagKey.JOINT_OVERUSE);
    }

    @Test
    void stays_silent_when_there_is_no_strain_data_in_the_window_at_all() {
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        // No sport sessions logged — must never average over an empty set.
        plannedTomorrow(owner, today, SHOULDER);

        assertThat(keys(owner)).doesNotContain(FlagKey.JOINT_OVERUSE);
    }

    /** A session with a null shoulder strain is not a data point: it must neither pull the
     *  average down nor inflate the frozen {@code dataPoints} count. */
    @Test
    void a_null_shoulder_strain_session_is_not_counted_as_a_data_point() {
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        // 6 high-strain days (avg 8, well above 5.0) + 1 day with a null-strain session only.
        strainDays(owner, today.minusDays(1), 8, 8, 8, 8, 8, 8);
        trainPopulator.createSportSessionWithShoulderStrain(owner, today, 45, null);
        plannedTomorrow(owner, today, SHOULDER);

        assertThat(keys(owner)).contains(FlagKey.JOINT_OVERUSE);
        FlagPayloadEnvelope.JointOveruse p = payload(owner).orElseThrow();
        assertThat(p.dataPoints()).isEqualTo(6);
        assertThat(p.strainAvg()).isEqualTo(8.0);
    }

    /** A dashed sub-zone must still match through {@code MuscleGroup.of} normalisation, not a
     *  substring test. */
    @Test
    void a_dashed_shoulder_sub_zone_still_matches_via_muscle_group_normalisation() {
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        strainDays(owner, today, 8, 8, 8, 8, 8, 8, 8);
        plannedTomorrow(owner, today, "shoulder-lateral");

        assertThat(keys(owner)).contains(FlagKey.JOINT_OVERUSE);
        assertThat(payload(owner).orElseThrow().tomorrowMuscle()).isEqualTo("shoulder");
    }

    // ── boundary pair around strainAvgAtLeast (5.0) — only the last day's value differs ──────

    @Test
    void stays_silent_when_the_strain_average_sits_just_below_the_threshold() {
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        // 6×5 + 1×4 = 34/7 ≈ 4.857, just below 5.0.
        strainDays(owner, today, 5, 5, 5, 5, 5, 5, 4);
        plannedTomorrow(owner, today, SHOULDER);

        assertThat(keys(owner)).doesNotContain(FlagKey.JOINT_OVERUSE);
    }

    @Test
    void raises_when_the_strain_average_sits_just_above_the_threshold() {
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        // 6×5 + 1×6 = 36/7 ≈ 5.143, just above 5.0.
        strainDays(owner, today, 5, 5, 5, 5, 5, 5, 6);
        plannedTomorrow(owner, today, SHOULDER);

        assertThat(keys(owner)).contains(FlagKey.JOINT_OVERUSE);
        FlagPayloadEnvelope.JointOveruse p = payload(owner).orElseThrow();
        assertThat(p.strainAvg()).isGreaterThanOrEqualTo(p.strainAvgAtLeast());
    }

    @Test
    void the_payload_freezes_the_average_threshold_window_tomorrows_date_and_muscle() {
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        strainDays(owner, today, 8, 8, 8, 8, 8, 8, 8);
        plannedTomorrow(owner, today, SHOULDER);

        FlagPayloadEnvelope.JointOveruse p = payload(owner).orElseThrow();
        assertThat(p.strainAvg()).isEqualTo(8.0);
        assertThat(p.strainAvgAtLeast()).isEqualTo(5.0);
        assertThat(p.windowDays()).isEqualTo(7);
        assertThat(p.dataPoints()).isEqualTo(7);
        assertThat(p.tomorrowDate()).isEqualTo(today.plusDays(1).toString());
        assertThat(p.tomorrowMuscle()).isEqualTo("shoulder");
    }

    @Test
    void is_unavailable_when_there_is_no_strain_data_in_the_window_at_all() {
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        plannedTomorrow(owner, today, SHOULDER);

        FlagVerdict verdict = verdictFor(evaluator.evaluate(owner), FlagKey.JOINT_OVERUSE);

        assertThat(verdict.outcome()).isEqualTo(FlagOutcome.UNAVAILABLE);
        assertThat(verdict.reason()).isEqualTo(UnavailableReason.NO_STRAIN_DATA);
    }

    @Test
    void is_clear_when_the_strain_average_sits_just_below_the_threshold() {
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        strainDays(owner, today, 5, 5, 5, 5, 5, 5, 4);
        plannedTomorrow(owner, today, SHOULDER);

        FlagVerdict verdict = verdictFor(evaluator.evaluate(owner), FlagKey.JOINT_OVERUSE);

        assertThat(verdict.outcome()).isEqualTo(FlagOutcome.CLEAR);
        assertThat(verdict.clear().metric()).isEqualTo("shoulder_strain_avg");
        assertThat(verdict.clear().observed()).isLessThan(verdict.clear().threshold());
    }

    @Test
    void is_unavailable_when_nothing_is_planned_for_tomorrow() {
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        strainDays(owner, today, 8, 8, 8, 8, 8, 8, 8);

        FlagVerdict verdict = verdictFor(evaluator.evaluate(owner), FlagKey.JOINT_OVERUSE);

        assertThat(verdict.outcome()).isEqualTo(FlagOutcome.UNAVAILABLE);
        assertThat(verdict.reason()).isEqualTo(UnavailableReason.NO_PLANNED_SESSION);
    }

    @Test
    void is_clear_when_tomorrow_is_a_leg_day() {
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        strainDays(owner, today, 8, 8, 8, 8, 8, 8, 8);
        plannedTomorrow(owner, today, LEG);

        FlagVerdict verdict = verdictFor(evaluator.evaluate(owner), FlagKey.JOINT_OVERUSE);

        assertThat(verdict.outcome()).isEqualTo(FlagOutcome.CLEAR);
        assertThat(verdict.clear().metric()).isEqualTo("tomorrow_muscle");
        assertThat(verdict.clear().detail()).isEqualTo("quad");
    }
}
