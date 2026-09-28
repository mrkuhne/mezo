package io.mrkuhne.mezo.feature.companion.flags;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.flags.service.FlagKey;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagOutcome;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagVerdict;
import io.mrkuhne.mezo.feature.companion.flags.service.UnavailableReason;
import io.mrkuhne.mezo.feature.companion.flags.service.rule.MotivationSlumpRule;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.CheckInPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/** Check-in 2.0 (mezo-ck2, spec 2026-09-27 §3.2): day-mean motivation ≤ 3 on ≥ 3 of the last 4 days. */
class MotivationSlumpRuleIT extends AbstractIntegrationTest {

    @Autowired private MotivationSlumpRule rule;
    @Autowired private CheckInPopulator checkInPopulator;
    @Autowired private UserPopulator userPopulator;

    private final LocalDate today = LocalDate.now();

    private void motivation(UUID owner, LocalDate day, String slot, Integer value) {
        checkInPopulator.createCheckIn(owner, day, slot, c -> c.setMotivation(value));
    }

    @Test
    void testEvaluate_shouldRaise_whenThreeOfFourDayMeansAreLow() {
        UUID owner = userPopulator.createUser().getId();
        motivation(owner, today.minusDays(3), "06:30", 2);
        motivation(owner, today.minusDays(2), "06:30", 3);
        motivation(owner, today.minusDays(1), "06:30", 8);
        motivation(owner, today, "06:30", 2);
        motivation(owner, today, "10:00", 4); // day mean 3.0 — still low

        FlagVerdict verdict = rule.evaluate(owner, today);

        assertThat(verdict.outcome()).isEqualTo(FlagOutcome.RAISED);
        assertThat(verdict.flagKey()).isEqualTo(FlagKey.MOTIVATION_SLUMP);
        assertThat(verdict.payload().motivationSlump().lowDays()).isEqualTo(3);
        assertThat(verdict.payload().motivationSlump().motivationByDay())
            .containsEntry(today.toString(), 3.0);
    }

    @Test
    void testEvaluate_shouldClear_whenTheDayMeanLiftsAboveThreshold() {
        UUID owner = userPopulator.createUser().getId();
        motivation(owner, today.minusDays(2), "06:30", 2);
        motivation(owner, today.minusDays(1), "06:30", 2);
        motivation(owner, today, "06:30", 2);
        motivation(owner, today, "10:00", 7); // day mean 4.5

        FlagVerdict verdict = rule.evaluate(owner, today);

        assertThat(verdict.outcome()).isEqualTo(FlagOutcome.CLEAR);
        assertThat(verdict.clear().metric()).isEqualTo("low_motivation_days");
        assertThat(verdict.clear().observed()).isEqualTo(2.0);
    }

    @Test
    void testEvaluate_shouldBeUnavailable_whenFewerAnsweredDaysThanMinDays() {
        UUID owner = userPopulator.createUser().getId();
        motivation(owner, today.minusDays(1), "06:30", 1);
        motivation(owner, today, "06:30", 1);

        FlagVerdict verdict = rule.evaluate(owner, today);

        assertThat(verdict.outcome()).isEqualTo(FlagOutcome.UNAVAILABLE);
        assertThat(verdict.reason()).isEqualTo(UnavailableReason.NOT_ENOUGH_MOTIVATION_ANSWERS);
    }

    /** NULL is "not answered": an unanswered slot neither lowers nor dilutes the day mean. */
    @Test
    void testEvaluate_shouldIgnoreUnansweredSlots_whenComputingTheDayMean() {
        UUID owner = userPopulator.createUser().getId();
        motivation(owner, today.minusDays(2), "06:30", 3);
        motivation(owner, today.minusDays(2), "10:00", null);
        motivation(owner, today.minusDays(1), "06:30", 3);
        motivation(owner, today, "06:30", null);

        FlagVerdict verdict = rule.evaluate(owner, today);

        assertThat(verdict.outcome()).isEqualTo(FlagOutcome.UNAVAILABLE);
    }
}
