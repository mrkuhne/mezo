package io.mrkuhne.mezo.feature.proactive;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.proactive.entity.CompanionMessageEntity;
import io.mrkuhne.mezo.feature.proactive.service.PlanFeasibilityCalculator;
import io.mrkuhne.mezo.feature.proactive.service.SetupCheckService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.SleepGoalPopulator;
import io.mrkuhne.mezo.support.populator.SleepLogPopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * S3 (bd mezo-d58h.3, spec 2026-09-03 §4 setup table, row 6): the plan-feasibility setup check —
 * {@link SetupCheckService#runFor} fires a card when the evening sport schedule or the observed
 * median bedtime push past the required lights-out (derived from the earliest MORNING obligation)
 * by more than the configured tolerance, and stays silent when the plan honestly fits or when
 * there is nothing to compare against (spec §7 — never estimate).
 */
class PlanFeasibilityIT extends AbstractIntegrationTest {

    @Autowired private SetupCheckService setupCheckService;
    @Autowired private PlanFeasibilityCalculator planFeasibilityCalculator;
    @Autowired private SleepGoalPopulator sleepGoalPopulator;
    @Autowired private TrainPopulator trainPopulator;
    @Autowired private SleepLogPopulator sleepLogPopulator;
    @Autowired private UserPopulator userPopulator;

    @Test
    void testRunFor_shouldEmitTheFeasibilityCard_whenEveningSportEndsTooLateForTheMorningSlot() {
        UUID owner = userPopulator.createUser().getId();
        sleepGoalPopulator.goal(owner, 480, "WAKE", "06:00", 15);   // 8h target (the goal's own wake)
        trainPopulator.createGymSlot(owner, 0, "07:00");            // Monday 07:00 = morning obligation
        // required lights-out = 07:00 − 45' wake buffer − 8h target = 22:15 the evening before.
        trainPopulator.createScheduleSlot(owner, 2, "20:00", 120, "training"); // ends 22:00, +30' = 22:30
        // 22:30 − 22:15 = 15' — inside the 45' tolerance, so this slot alone must NOT fire.
        trainPopulator.createScheduleSlot(owner, 4, "21:00", 120, "training"); // ends 23:00, +30' = 23:30
        // 23:30 − 22:15 = 75' > 45' ⇒ infeasible, and the Friday slot is what binds.

        Optional<CompanionMessageEntity> card = setupCheckService.runFor(owner);

        assertThat(card).isPresent();
        assertThat(card.orElseThrow().getContent().setupKey())
            .isEqualTo(SetupCheckService.CHECK_PLAN_FEASIBILITY);
    }

    @Test
    void testRunFor_shouldStaySilent_whenTheScheduleFitsInsideTheTolerance() {
        UUID owner = userPopulator.createUser().getId();
        sleepGoalPopulator.goal(owner, 480, "WAKE", "06:00", 15);
        trainPopulator.createGymSlot(owner, 0, "07:00");
        trainPopulator.createScheduleSlot(owner, 2, "19:00", 90, "training"); // ends 20:30, +30' = 21:00
        // 21:00 is BEFORE the 22:15 required lights-out ⇒ feasible, no card.

        assertThat(setupCheckService.runFor(owner)).isEmpty();
    }

    @Test
    void testRunFor_shouldStaySilent_whenThereIsNoMorningObligationAndTheGoalIsBedAnchored() {
        // No morning gym slot and a BED-anchored goal ⇒ nothing to be early FOR. Inventing an
        // obligation here would be exactly the estimate spec §7 forbids.
        UUID owner = userPopulator.createUser().getId();
        sleepGoalPopulator.goal(owner, 480, "BED", "23:00", 15);
        trainPopulator.createScheduleSlot(owner, 2, "20:30", 120, "training");

        assertThat(setupCheckService.runFor(owner)).isEmpty();
    }

    @Test
    void testRunFor_shouldPreferTheMissingGoalCard_whenThereIsNoGoalAtAll() {
        // Check ordering: no goal ⇒ the goal card, never a feasibility verdict computed against
        // a goal that does not exist.
        UUID owner = userPopulator.createUser().getId();
        trainPopulator.createGymSlot(owner, 0, "07:00");
        trainPopulator.createScheduleSlot(owner, 2, "21:00", 120, "training");

        assertThat(setupCheckService.runFor(owner).orElseThrow().getContent().setupKey())
            .isEqualTo(SetupCheckService.CHECK_MISSING_SLEEP_GOAL);
    }

    @Test
    void testRunFor_shouldEmitTheFeasibilityCard_whenTheObservedMedianBedtimeIsTooLate() {
        // Sport schedule alone fits, but the logged bedtimes push past the required lights-out —
        // the observed-bedtime half must be able to bind the verdict on its own.
        UUID owner = userPopulator.createUser().getId();
        sleepGoalPopulator.goal(owner, 480, "WAKE", "06:00", 15);
        trainPopulator.createGymSlot(owner, 0, "07:00");
        // required lights-out = 07:00 − 45' − 8h = 22:15.
        trainPopulator.createScheduleSlot(owner, 2, "19:00", 90, "training"); // ends 20:30, +30' = 21:00 — fits.

        // sleep_log.date is the WAKE morning, so a 23:30 bedtime the night before is logged on the
        // following day's row. Four nights (>= minBedtimeSamples=4) at 23:30 ⇒ median 23:30 (1410),
        // shifted. 23:30 − 22:15 = 75' > 45' tolerance ⇒ infeasible, bound by "bedtime".
        LocalDate today = LocalDate.now();
        for (int i = 1; i <= 4; i++) {
            sleepLogPopulator.createTrackerSleepLog(owner, today.minusDays(i), "23:30", "07:00",
                new java.math.BigDecimal("7.5"), 3, 0, null, null, null, null, null, null, "screenshot",
                null, null);
        }

        Optional<PlanFeasibilityCalculator.Verdict> verdict =
            planFeasibilityCalculator.evaluate(owner, today);
        assertThat(verdict).isPresent();
        assertThat(verdict.orElseThrow().feasible()).isFalse();
        assertThat(verdict.orElseThrow().constraintSource())
            .isEqualTo(PlanFeasibilityCalculator.SOURCE_BEDTIME);

        Optional<CompanionMessageEntity> card = setupCheckService.runFor(owner);

        assertThat(card).isPresent();
        assertThat(card.orElseThrow().getContent().setupKey())
            .isEqualTo(SetupCheckService.CHECK_PLAN_FEASIBILITY);
    }
}
