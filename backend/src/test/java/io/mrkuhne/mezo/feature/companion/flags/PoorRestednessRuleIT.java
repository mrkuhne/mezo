package io.mrkuhne.mezo.feature.companion.flags;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.flags.service.FlagKey;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagOutcome;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagVerdict;
import io.mrkuhne.mezo.feature.companion.flags.service.UnavailableReason;
import io.mrkuhne.mezo.feature.companion.flags.service.rule.PoorRestednessRule;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.CheckInPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/** Check-in 2.0 (mezo-ck2, spec 2026-09-27 §3.2): rested ≤ 4 on 2 consecutive mornings. */
class PoorRestednessRuleIT extends AbstractIntegrationTest {

    @Autowired private PoorRestednessRule rule;
    @Autowired private CheckInPopulator checkInPopulator;
    @Autowired private UserPopulator userPopulator;

    private final LocalDate today = LocalDate.now();

    private void rested(UUID owner, LocalDate day, String slot, Integer value) {
        checkInPopulator.createCheckIn(owner, day, slot, c -> c.setRested(value));
    }

    @Test
    void testEvaluate_shouldRaise_whenTwoConsecutiveMorningsAreLow() {
        UUID owner = userPopulator.createUser().getId();
        rested(owner, today.minusDays(1), "06:30", 3);
        rested(owner, today, "06:30", 4);

        FlagVerdict verdict = rule.evaluate(owner, today);

        assertThat(verdict.outcome()).isEqualTo(FlagOutcome.RAISED);
        assertThat(verdict.flagKey()).isEqualTo(FlagKey.POOR_RESTEDNESS);
        assertThat(verdict.payload().poorRestedness().runDays())
            .containsExactly(today.minusDays(1).toString(), today.toString());
    }

    /** No 06:30 row: the day's first check-in is the morning. */
    @Test
    void testEvaluate_shouldUseTheFirstCheckIn_whenNoMorningSlotRow() {
        UUID owner = userPopulator.createUser().getId();
        rested(owner, today.minusDays(2), "10:00", 2);
        rested(owner, today.minusDays(1), "07:15", 4);
        rested(owner, today.minusDays(1), "20:00", 9);

        assertThat(rule.evaluate(owner, today).outcome()).isEqualTo(FlagOutcome.RAISED);
    }

    @Test
    void testEvaluate_shouldClear_whenLowMorningsAreNotConsecutive() {
        UUID owner = userPopulator.createUser().getId();
        rested(owner, today.minusDays(2), "06:30", 3);
        rested(owner, today.minusDays(1), "06:30", 7);
        rested(owner, today, "06:30", 3);

        FlagVerdict verdict = rule.evaluate(owner, today);

        assertThat(verdict.outcome()).isEqualTo(FlagOutcome.CLEAR);
        assertThat(verdict.clear().metric()).isEqualTo("low_rested_run");
        assertThat(verdict.clear().observed()).isEqualTo(1.0);
    }

    @Test
    void testEvaluate_shouldBeUnavailable_whenOnlyOneMorningAnswered() {
        UUID owner = userPopulator.createUser().getId();
        rested(owner, today, "06:30", 2);

        FlagVerdict verdict = rule.evaluate(owner, today);

        assertThat(verdict.outcome()).isEqualTo(FlagOutcome.UNAVAILABLE);
        assertThat(verdict.reason()).isEqualTo(UnavailableReason.NOT_ENOUGH_MORNING_ANSWERS);
    }

    /** NULL is "not answered": a skipped morning neither counts as low nor bridges a run. */
    @Test
    void testEvaluate_shouldNotBridgeARun_whenTheMiddleMorningIsUnanswered() {
        UUID owner = userPopulator.createUser().getId();
        rested(owner, today.minusDays(2), "06:30", 2);
        rested(owner, today.minusDays(1), "06:30", null);
        rested(owner, today, "06:30", 2);

        assertThat(rule.evaluate(owner, today).outcome()).isEqualTo(FlagOutcome.CLEAR);
    }
}
