package io.mrkuhne.mezo.feature.companion.flags;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.flags.service.FlagEvaluator;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagKey;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagOutcome;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagVerdict;
import io.mrkuhne.mezo.feature.companion.flags.service.UnavailableReason;
import io.mrkuhne.mezo.feature.train.entity.PlannedSkipEntity.Reason;
import io.mrkuhne.mezo.feature.train.entity.RecoveryPeriodEntity.Estimate;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.RecoveryPeriodPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * Kihagyás S2 (mezo-q4xt2.2, task 6): while a recovery period ("kímélő mód") is open, the four
 * training-pressure rules — {@code missed_workouts}, {@code momentum_at_risk},
 * {@code joint_overuse}, {@code ignored_nudge} — must go quiet ({@link FlagOutcome#UNAVAILABLE},
 * {@link UnavailableReason#RECOVERY_MODE}) without running their own logic, so a genuinely serious
 * skip reason (illness, injury, …) can never be read back to the user as a nag. Every other rule
 * must be unaffected.
 */
class FlagEvaluatorRecoveryModeIT extends AbstractIntegrationTest {

    @Autowired private FlagEvaluator evaluator;
    @Autowired private UserPopulator userPopulator;
    @Autowired private RecoveryPeriodPopulator recoveryPeriodPopulator;

    private static final List<String> QUIETED = List.of(
        FlagKey.MISSED_WORKOUTS, FlagKey.MOMENTUM_AT_RISK, FlagKey.JOINT_OVERUSE, FlagKey.IGNORED_NUDGE);

    private UUID ownerId() {
        return userPopulator.createUser().getId();
    }

    private static FlagVerdict verdictFor(List<FlagVerdict> verdicts, String flagKey) {
        return verdicts.stream().filter(v -> flagKey.equals(v.flagKey())).findFirst().orElseThrow();
    }

    @Test
    void quietsTheFourTrainingPressureRules_whenARecoveryPeriodIsOpen() {
        UUID owner = ownerId();
        recoveryPeriodPopulator.open(owner, Reason.ILLNESS, LocalDate.now(), Estimate.FEW_DAYS);

        List<FlagVerdict> verdicts = evaluator.evaluate(owner);

        for (String key : QUIETED) {
            FlagVerdict verdict = verdictFor(verdicts, key);
            assertThat(verdict.outcome()).as(key).isEqualTo(FlagOutcome.UNAVAILABLE);
            assertThat(verdict.reason()).as(key).isEqualTo(UnavailableReason.RECOVERY_MODE);
        }
    }

    @Test
    void quietsTheThreeFuelJudgementRules_whenARecoveryPeriodIsOpen() {
        UUID owner = ownerId();
        recoveryPeriodPopulator.open(owner, Reason.ILLNESS, LocalDate.now(), Estimate.FEW_DAYS);

        List<FlagVerdict> verdicts = evaluator.evaluate(owner);

        for (String key : List.of(FlagKey.LOAD_FUEL_MISMATCH, FlagKey.LOGGING_GAP, FlagKey.MEAL_RHYTHM_DRIFT)) {
            FlagVerdict verdict = verdictFor(verdicts, key);
            assertThat(verdict.outcome()).as(key).isEqualTo(FlagOutcome.UNAVAILABLE);
            assertThat(verdict.reason()).as(key).isEqualTo(UnavailableReason.RECOVERY_MODE);
        }
    }

    @Test
    void leavesTheOtherRulesUnaffected_whenARecoveryPeriodIsOpen() {
        UUID owner = ownerId();
        recoveryPeriodPopulator.open(owner, Reason.INJURY, LocalDate.now(), Estimate.WEEK);

        List<FlagVerdict> verdicts = evaluator.evaluate(owner);

        // some other rule (e.g. all_healthy) must still be evaluated on its own terms, not
        // silently swallowed by the recovery gate — RECOVERY_MODE must never appear for it.
        FlagVerdict allHealthy = verdictFor(verdicts, FlagKey.ALL_HEALTHY);
        assertThat(allHealthy.reason()).isNotEqualTo(UnavailableReason.RECOVERY_MODE);
    }

    @Test
    void doesNotQuietTheFourRules_whenNoRecoveryPeriodIsOpen() {
        UUID owner = ownerId();

        List<FlagVerdict> verdicts = evaluator.evaluate(owner);

        for (String key : QUIETED) {
            FlagVerdict verdict = verdictFor(verdicts, key);
            assertThat(verdict.reason()).as(key).isNotEqualTo(UnavailableReason.RECOVERY_MODE);
        }
    }

    @Test
    void doesNotQuietTheFourRules_whenTheOnlyPeriodHasAlreadyEnded() {
        UUID owner = ownerId();
        recoveryPeriodPopulator.ended(owner, Reason.STOMACH, LocalDate.now().minusDays(5), LocalDate.now().minusDays(1));

        List<FlagVerdict> verdicts = evaluator.evaluate(owner);

        for (String key : QUIETED) {
            FlagVerdict verdict = verdictFor(verdicts, key);
            assertThat(verdict.reason()).as(key).isNotEqualTo(UnavailableReason.RECOVERY_MODE);
        }
    }
}
