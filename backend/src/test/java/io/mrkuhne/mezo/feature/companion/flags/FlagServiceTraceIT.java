package io.mrkuhne.mezo.feature.companion.flags;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.flags.entity.CompanionFlagTraceEntity;
import io.mrkuhne.mezo.feature.companion.flags.repository.CompanionFlagTraceRepository;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagKey;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.SleepGoalPopulator;
import io.mrkuhne.mezo.support.populator.SleepLogPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * The three behaviours that justify {@code companion_flag_trace}'s existence (spec 2026-09-05
 * §4.3, task 4 of mezo-6269.1): every rule is traced on the first sweep, an unchanged sweep costs
 * nothing, and cooldown suppression — today silently discarded — becomes its own visible state.
 */
class FlagServiceTraceIT extends AbstractIntegrationTest {

    @Autowired FlagService flagService;
    @Autowired CompanionFlagTraceRepository traceRepository;
    @Autowired UserPopulator userPopulator;
    @Autowired SleepGoalPopulator sleepGoalPopulator;
    @Autowired SleepLogPopulator sleepLogPopulator;

    @Test
    void testEvaluate_shouldTraceEveryRuleOnTheFirstRun() {
        UUID user = userPopulator.createUser().getId();

        flagService.evaluateAndLog(user, "sweep");

        // 13 rules, all traced — the point of the feature is that the quiet ones leave a mark.
        assertThat(traceRepository.findAll().stream()
            .filter(r -> r.getCreatedBy().equals(user))
            .map(CompanionFlagTraceEntity::getFlagKey))
            .hasSize(13).doesNotHaveDuplicates();
    }

    @Test
    void testEvaluate_shouldWriteNothingWhenNothingChanged() {
        UUID user = userPopulator.createUser().getId();
        // A brand-new account trips logging_gap immediately, so the FIRST two sweeps are not a
        // steady state: sweep 1 logs it, sweep 2 finds it still true but now inside its own
        // cooldown — LOGGED -> SUPPRESSED_BY_COOLDOWN is a genuine disposition change and is
        // expected to add a row (that transition is exactly what the table exists to record).
        // Steady state is reached from sweep 2 onward, once every rule's verdict/disposition has
        // settled.
        flagService.evaluateAndLog(user, "sweep");
        flagService.evaluateAndLog(user, "sweep");
        long afterSteadyState = countFor(user);

        flagService.evaluateAndLog(user, "sweep");

        // This is the condition for keeping the table forever: an unchanged sweep is free.
        assertThat(countFor(user)).isEqualTo(afterSteadyState);
    }

    @Test
    void testEvaluate_shouldRecordCooldownSuppressionAsItsOwnState() {
        UUID user = userPopulator.createUser().getId();
        seedSleepDebtRaise(user);          // makes sleep_debt true
        flagService.evaluateAndLog(user, "sweep");   // → raised / logged

        flagService.evaluateAndLog(user, "sweep");   // → still raised, now inside its cooldown

        List<CompanionFlagTraceEntity> sleepRows = traceRepository.findAll().stream()
            .filter(r -> r.getCreatedBy().equals(user) && FlagKey.SLEEP_DEBT.equals(r.getFlagKey()))
            .toList();
        assertThat(sleepRows).hasSize(2);
        assertThat(sleepRows.get(0).getDisposition()).isEqualTo("logged");
        // Today this transition is invisible: the raise is dropped before it is ever persisted.
        assertThat(sleepRows.get(1).getDisposition()).isEqualTo("suppressed_by_cooldown");
    }

    /** Copied from {@code FlagEvaluatorStressSleepIT#sleep_debt_raises_when_the_three_night_deficit_reaches_the_threshold}. */
    private void seedSleepDebtRaise(UUID owner) {
        LocalDate today = LocalDate.now();
        sleepGoalPopulator.goal(owner, 480, "WAKE", "06:30", 15); // 8.0 h
        sleepLogPopulator.createSleepLog(owner, today, new BigDecimal("6.5"), 3);
        sleepLogPopulator.createSleepLog(owner, today.minusDays(1), new BigDecimal("6.5"), 3);
        sleepLogPopulator.createSleepLog(owner, today.minusDays(2), new BigDecimal("6.0"), 3);
        // deficit = 1.5 + 1.5 + 2.0 = 5.0 >= 3.0
    }

    private long countFor(UUID user) {
        return traceRepository.findAll().stream().filter(r -> r.getCreatedBy().equals(user)).count();
    }
}
