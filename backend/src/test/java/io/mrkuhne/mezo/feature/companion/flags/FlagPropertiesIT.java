package io.mrkuhne.mezo.feature.companion.flags;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.flags.config.FlagProperties;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagKey;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class FlagPropertiesIT extends AbstractIntegrationTest {

    @Autowired private FlagProperties properties;

    @Test
    void binds_every_rule_threshold_from_application_yml() {
        assertThat(properties.sweepCron()).isEqualTo("0 5 * * * *");
        assertThat(properties.sustainedStress().threshold()).isEqualTo(7.0);
        assertThat(properties.sustainedStress().windowDays()).isEqualTo(4);
        assertThat(properties.sustainedStress().minDays()).isEqualTo(3);
        assertThat(properties.sleepDebt().nights()).isEqualTo(3);
        assertThat(properties.sleepDebt().minNights()).isEqualTo(2);
        assertThat(properties.sleepDebt().deficitHours()).isEqualTo(3.0);
        assertThat(properties.sleepDebt().defaultGoalHours()).isEqualTo(8.0);
        assertThat(properties.momentum().windowDays()).isEqualTo(3);
        assertThat(properties.momentum().baselineDays()).isEqualTo(14);
        assertThat(properties.momentum().dropRatio()).isEqualTo(0.5);
        assertThat(properties.momentum().minBaseline()).isEqualTo(1.0);
        assertThat(properties.recovery().windowDays()).isEqualTo(2);
        assertThat(properties.recovery().sleepFloorHours()).isEqualTo(6.0);
        assertThat(properties.recovery().rpeThreshold()).isEqualTo(7.0);
        assertThat(properties.recovery().stressThreshold()).isEqualTo(6.0);
        assertThat(properties.allHealthy().quietDays()).isEqualTo(7);
        assertThat(properties.cooldownHours().sustainedStress()).isEqualTo(24);
        assertThat(properties.cooldownHours().sleepDebt()).isEqualTo(24);
        assertThat(properties.cooldownHours().momentumAtRisk()).isEqualTo(48);
        assertThat(properties.cooldownHours().recoveryNeeded()).isEqualTo(24);
        assertThat(properties.cooldownHours().allHealthy()).isEqualTo(168);
    }

    /** S6 (mezo-d58h.6): the six batch-B cooldowns bind before either rule/threshold exists —
     *  same pattern as S2's logging-gap/missed-workouts cooldowns landing ahead of their rules.
     *  Whole-branch review fix: the values are deliberately unequal (see the application.yml
     *  comment) so two rules that can co-fire from the same underlying state don't share a
     *  cooldown and starve each other's delivery forever. */
    @Test
    void binds_the_six_s6_cooldowns_from_application_yml() {
        assertThat(properties.cooldownHours().acuteBadDay()).isEqualTo(24);
        assertThat(properties.cooldownHours().loadFuelMismatch()).isEqualTo(72);
        assertThat(properties.cooldownHours().rapidWeightLoss()).isEqualTo(96);
        assertThat(properties.cooldownHours().jointOveruse()).isEqualTo(60);
        assertThat(properties.cooldownHours().ignoredNudge()).isEqualTo(120);
        assertThat(properties.cooldownHours().lateEating()).isEqualTo(48);
    }

    /** S6: the six new keys must answer through the same switch before either rule exists — an
     *  unmapped key throws {@code SystemRuntimeErrorException} at raise time. */
    @Test
    void forFlag_answers_for_the_six_s6_keys() {
        assertThat(properties.cooldownHours().forFlag(FlagKey.ACUTE_BAD_DAY)).isEqualTo(24);
        assertThat(properties.cooldownHours().forFlag(FlagKey.LOAD_FUEL_MISMATCH)).isEqualTo(72);
        assertThat(properties.cooldownHours().forFlag(FlagKey.RAPID_WEIGHT_LOSS)).isEqualTo(96);
        assertThat(properties.cooldownHours().forFlag(FlagKey.JOINT_OVERUSE)).isEqualTo(60);
        assertThat(properties.cooldownHours().forFlag(FlagKey.IGNORED_NUDGE)).isEqualTo(120);
        assertThat(properties.cooldownHours().forFlag(FlagKey.LATE_EATING)).isEqualTo(48);
    }

    /** S2 (mezo-d58h.2): the two new keys must answer through the same switch before either rule
     *  exists — an unmapped key throws {@code SystemRuntimeErrorException} at raise time. */
    @Test
    void forFlag_answers_for_logging_gap_and_missed_workouts() {
        assertThat(properties.cooldownHours().forFlag(FlagKey.LOGGING_GAP)).isEqualTo(48);
        assertThat(properties.cooldownHours().forFlag(FlagKey.MISSED_WORKOUTS)).isEqualTo(48);
    }

    @Test
    void binds_logging_gap_and_missed_workouts_thresholds_from_application_yml() {
        assertThat(properties.loggingGap().mealStaleHours()).isEqualTo(36);
        assertThat(properties.loggingGap().checkinStaleHours()).isEqualTo(48);
        assertThat(properties.loggingGap().sleepStaleMornings()).isEqualTo(2);
        assertThat(properties.loggingGap().minStaleDomains()).isEqualTo(1);
        assertThat(properties.loggingGap().sleepSuspicionDeficitHours()).isEqualTo(1.0);
        assertThat(properties.missedWorkouts().windowDays()).isEqualTo(14);
        assertThat(properties.missedWorkouts().minConsecutiveMissed()).isEqualTo(2);
    }

    /** S6 batch B (mezo-d58h.6, spec §4): the six new rules' own threshold records — every one
     *  of their fields, so a YAML key that drifts from its record component is caught here rather
     *  than surfacing as a silent null/zero at detection time. */
    @Test
    void binds_the_six_s6_rule_thresholds_from_application_yml() {
        assertThat(properties.acuteBadDay().minCheckIns()).isEqualTo(2);
        assertThat(properties.acuteBadDay().bodyOrEnergyAtMost()).isEqualTo(3);

        assertThat(properties.loadFuelMismatch().windowDays()).isEqualTo(7);
        assertThat(properties.loadFuelMismatch().loadThreshold()).isEqualTo(50.0);
        assertThat(properties.loadFuelMismatch().kcalFractionOfTarget()).isEqualTo(0.80);
        assertThat(properties.loadFuelMismatch().sleepFloorHours()).isEqualTo(7.0);
        assertThat(properties.loadFuelMismatch().minLoggedDaysPerSide()).isEqualTo(4);

        assertThat(properties.rapidWeightLoss().pctPerWeekAtMost()).isEqualTo(-0.7);
        assertThat(properties.rapidWeightLoss().minWeighIns()).isEqualTo(4);

        assertThat(properties.jointOveruse().windowDays()).isEqualTo(7);
        assertThat(properties.jointOveruse().strainAvgAtLeast()).isEqualTo(5.0);
        assertThat(properties.jointOveruse().muscleNeedle()).isEqualTo("shoulder");

        assertThat(properties.ignoredNudge().category()).isEqualTo("lights_out");
        assertThat(properties.ignoredNudge().minConsecutiveDays()).isEqualTo(5);
        assertThat(properties.ignoredNudge().nonComplianceMinutes()).isEqualTo(60);

        assertThat(properties.lateEating().minutesBeforeBed()).isEqualTo(90);
        assertThat(properties.lateEating().absoluteHour()).isEqualTo(22.5);
        assertThat(properties.lateEating().minDaysOfLastThree()).isEqualTo(2);
        assertThat(properties.lateEating().windowDays()).isEqualTo(3);
    }

    /** Round 2 S1 (mezo-d58h.7.1): key-level cooldown is deliberately SHORT (24h) — the 7-day
     *  "per item" cooldown the spec asks for lives inside ProtocolLapseRule, so a DIFFERENT item
     *  lapsing tomorrow is not starved by the first one's raise. */
    @Test
    void binds_the_protocol_lapse_cooldown() {
        assertThat(properties.cooldownHours().protocolLapse()).isEqualTo(24);
        assertThat(properties.cooldownHours().forFlag(FlagKey.PROTOCOL_LAPSE)).isEqualTo(24);
    }

    /** Round 2 S1 (mezo-d58h.7.1, spec 2026-09-05 §(11)). */
    @Test
    void binds_the_protocol_lapse_thresholds() {
        assertThat(properties.protocolLapse().consecutiveMissedDays()).isEqualTo(2);
        assertThat(properties.protocolLapse().historyWindowDays()).isEqualTo(30);
        assertThat(properties.protocolLapse().minHistoryDueDays()).isEqualTo(7);
        assertThat(properties.protocolLapse().minHistoryAdherence()).isEqualTo(0.60);
        assertThat(properties.protocolLapse().perItemCooldownDays()).isEqualTo(7);
    }

    /** Round 2 S4 (mezo-d58h.7.4): the spec's 14-day cadence is a KEY-level cooldown here (unlike
     *  protocol_lapse's per-item one) — and application.yml's protocol_lapse lesson applies: the
     *  intervention-library entry's own cooldown-hours must match it, or InterventionService's
     *  per-key gate silently overrides the design. */
    @Test
    void binds_the_meal_rhythm_drift_thresholds_and_cooldown() {
        assertThat(properties.mealRhythmDrift().windowDays()).isEqualTo(14);
        assertThat(properties.mealRhythmDrift().minDaysWithMeals()).isEqualTo(10);
        assertThat(properties.mealRhythmDrift().driftMinutes()).isEqualTo(90);
        assertThat(properties.mealRhythmDrift().minSlotDays()).isEqualTo(8);
        assertThat(properties.mealRhythmDrift().minSameDirectionShare()).isEqualTo(0.70);
        assertThat(properties.mealRhythmDrift().deadSlotMaxPresence()).isEqualTo(0.30);
        assertThat(properties.mealRhythmDrift().otherSlotsMinPresence()).isEqualTo(0.70);
        assertThat(properties.mealRhythmDrift().minSlotPlannedDays()).isEqualTo(10);
        assertThat(properties.cooldownHours().mealRhythmDrift()).isEqualTo(336);
        assertThat(properties.cooldownHours().forFlag(FlagKey.MEAL_RHYTHM_DRIFT)).isEqualTo(336);
    }

    /** Round 2 S6 (mezo-d58h.7.7): the 30-day insight cadence lives in TWO places that must agree —
     *  this key-level cooldown and the energy_dip_timing_insight library entry's own cooldown-hours
     *  (InterventionService.deliverForFlag applies the LIBRARY value, so a mismatch silently
     *  overrides the design — the protocol_lapse review lesson, repeated in S4). */
    @Test
    void binds_the_energy_dip_meal_timing_thresholds_and_cooldown() {
        assertThat(properties.energyDipMealTiming().windowDays()).isEqualTo(30);
        assertThat(properties.energyDipMealTiming().minQualifyingDays()).isEqualTo(10);
        assertThat(properties.energyDipMealTiming().afternoonFromHour()).isEqualTo(11);
        assertThat(properties.energyDipMealTiming().afternoonToHour()).isEqualTo(16);
        assertThat(properties.energyDipMealTiming().minGroupDays()).isEqualTo(4);
        assertThat(properties.energyDipMealTiming().minEnergyDelta()).isEqualTo(1.0);
        assertThat(properties.energyDipMealTiming().minSuperiority()).isEqualTo(0.70);
        assertThat(properties.energyDipMealTiming().minLunchSplitSeparationMinutes()).isEqualTo(45);
        assertThat(properties.cooldownHours().energyDipMealTiming()).isEqualTo(720);
        assertThat(properties.cooldownHours().forFlag(FlagKey.ENERGY_DIP_MEAL_TIMING)).isEqualTo(720);
    }
}
