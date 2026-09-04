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
 *
 * <p><b>Day-pairing correction (S3 whole-branch review, same bd id):</b> the sport half pairs
 * each evening with the morning that ACTUALLY follows it — weekday {@code (D + 1) mod 7} — not
 * with the earliest morning anywhere in the week. Weekday numbering is 0=Monday..6=Sunday on both
 * {@code gym_schedule_slot.dayOfWeek} and {@code sport_schedule_slot.dayOfWeek}. The bedtime half
 * stays day-agnostic on purpose (a habitual bedtime happens every night, so it is judged against
 * the week's tightest morning) — see {@link PlanFeasibilityCalculator}'s class javadoc.
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
        trainPopulator.createGymSlot(owner, 1, "07:00");            // Tuesday 07:00 — pairs with Monday's sport slot
        trainPopulator.createGymSlot(owner, 4, "07:00");            // Friday 07:00 — pairs with Thursday's sport slot
        // Each real gym morning gives required lights-out = 07:00 − 45' wake buffer − 8h target =
        // 22:15 the evening before — day-paired, so only the evening immediately preceding a given
        // morning is compared against it.
        trainPopulator.createScheduleSlot(owner, 0, "20:00", 120, "training"); // Mon ends 22:00, +30' = 22:30
        // Monday's following day is Tuesday (a real gym morning): 22:30 − 22:15 = 15' — inside the
        // 45' tolerance, so this slot alone must NOT fire.
        trainPopulator.createScheduleSlot(owner, 3, "21:00", 120, "training"); // Thu ends 23:00, +30' = 23:30
        // Thursday's following day is Friday (a real gym morning): 23:30 − 22:15 = 75' > 45' ⇒
        // infeasible, and THIS slot is what binds — a genuine day-paired misfit, not a comparison
        // across unrelated days.

        Optional<CompanionMessageEntity> card = setupCheckService.runFor(owner);

        assertThat(card).isPresent();
        assertThat(card.orElseThrow().getContent().setupKey())
            .isEqualTo(SetupCheckService.CHECK_PLAN_FEASIBILITY);
    }

    @Test
    void testRunFor_shouldStaySilent_whenTheScheduleFitsInsideTheTolerance() {
        UUID owner = userPopulator.createUser().getId();
        sleepGoalPopulator.goal(owner, 480, "WAKE", "06:00", 15);
        trainPopulator.createGymSlot(owner, 0, "07:00"); // Monday — keeps the global gate open
        trainPopulator.createScheduleSlot(owner, 2, "19:00", 90, "training"); // Wed ends 20:30, +30' = 21:00
        // Wednesday's following day (Thursday) has no gym slot of its own, so the WAKE-anchored
        // goal's own wake time (06:00) is the obligation there instead — a wake anchor is a daily
        // commitment, so it applies to every following morning: required lights-out =
        // 06:00 − 45' − 8h = 21:15. 21:00 is BEFORE that ⇒ feasible, no card.

        assertThat(setupCheckService.runFor(owner)).isEmpty();
    }

    @Test
    void testRunFor_shouldStaySilent_whenThereIsNoMorningObligationAndTheGoalIsBedAnchored() {
        // No morning gym slot ANYWHERE in the week and a BED-anchored goal ⇒ nothing to be early
        // FOR at all — the global gate (day-agnostic by design, see the calculator's class
        // javadoc) never opens. Inventing an obligation here would be exactly the estimate spec
        // §7 forbids.
        UUID owner = userPopulator.createUser().getId();
        sleepGoalPopulator.goal(owner, 480, "BED", "23:00", 15);
        trainPopulator.createScheduleSlot(owner, 2, "20:30", 120, "training");

        assertThat(setupCheckService.runFor(owner)).isEmpty();
    }

    @Test
    void testRunFor_shouldStaySilent_whenTheSportSlotsFollowingDayHasNoMorningObligation_andTheGoalIsBedAnchored() {
        // The bug this correction fixes: the OLD code would have measured this Wednesday evening
        // against Monday's 07:00 gym slot — a comparison across unrelated days that asserted a
        // conflict which does not exist. With day-pairing, Wednesday's sport slot is paired with
        // THURSDAY's morning, which has no gym slot of its own; the goal is BED-anchored, so
        // there is no WAKE fallback to invent an obligation from. The slot is skipped — nothing
        // follows it, so it cannot make the plan infeasible — and with no other sport slot and no
        // logged bedtimes, the check has nothing left to say.
        UUID owner = userPopulator.createUser().getId();
        sleepGoalPopulator.goal(owner, 480, "BED", "23:00", 15);
        trainPopulator.createGymSlot(owner, 0, "07:00"); // Monday only — keeps the global gate open
        trainPopulator.createScheduleSlot(owner, 2, "20:30", 120, "training"); // Wed; Thu (its +1) has no obligation

        assertThat(setupCheckService.runFor(owner)).isEmpty();
    }

    @Test
    void testRunFor_shouldEmitTheFeasibilityCard_whenASundayEveningSportSlotWrapsToMondayMorning() {
        // (D + 1) mod 7 must wrap Sunday (6) to Monday (0), not compute an out-of-range 7 or
        // silently treat Sunday as having no following day. This is the spec's own worked
        // example's infeasible variant (Sunday 21:00, not 20:30).
        UUID owner = userPopulator.createUser().getId();
        sleepGoalPopulator.goal(owner, 480, "WAKE", "06:00", 15);
        trainPopulator.createGymSlot(owner, 0, "07:00"); // Monday 07:00 — required lights-out 22:15
        trainPopulator.createScheduleSlot(owner, 6, "21:00", 120, "training"); // Sun ends 23:00, +30' = 23:30
        // Sunday's following day, wrapped, is Monday: 23:30 − 22:15 = 75' > 45' ⇒ infeasible.

        Optional<PlanFeasibilityCalculator.Verdict> verdict =
            planFeasibilityCalculator.evaluate(owner, LocalDate.now());

        assertThat(verdict).isPresent();
        assertThat(verdict.orElseThrow().feasible()).isFalse();
        assertThat(verdict.orElseThrow().constraintSource())
            .isEqualTo(PlanFeasibilityCalculator.SOURCE_SPORT);
        assertThat(verdict.orElseThrow().bindingDay()).isEqualTo(6);
        assertThat(verdict.orElseThrow().misfitMin()).isEqualTo(75);
    }

    @Test
    void testRunFor_shouldStaySilent_whenTheMisfitExactlyEqualsTheTolerance() {
        // required lights-out = 07:00 − 45' − 8h = 22:15. Sunday's sport slot day-pairs with
        // Monday's real gym morning ((6 + 1) mod 7 = 0) — exactly the spec's worked example: the
        // misfit lands EXACTLY on the 45' tolerance boundary ("infeasible only when it misses by
        // MORE than this" ⇒ a misfit equal to the tolerance is still feasible).
        UUID owner = userPopulator.createUser().getId();
        sleepGoalPopulator.goal(owner, 480, "WAKE", "06:00", 15);
        trainPopulator.createGymSlot(owner, 0, "07:00");
        trainPopulator.createScheduleSlot(owner, 6, "20:30", 120, "training"); // Sun ends 22:30, +30' = 23:00

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
        // Sport schedule alone fits (even against its day-paired obligation), but the logged
        // bedtimes push past the required lights-out — the observed-bedtime half must be able to
        // bind the verdict on its own. The bedtime half is deliberately NOT day-paired: it is
        // judged against the week's tightest morning (Monday's), exactly as before this
        // correction — see the calculator's class javadoc for why.
        UUID owner = userPopulator.createUser().getId();
        sleepGoalPopulator.goal(owner, 480, "WAKE", "06:00", 15);
        trainPopulator.createGymSlot(owner, 0, "07:00");
        // required lights-out = 07:00 − 45' − 8h = 22:15.
        trainPopulator.createScheduleSlot(owner, 2, "19:00", 90, "training"); // Wed ends 20:30, +30' = 21:00 — fits.

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
        assertThat(verdict.orElseThrow().bindingDay()).isNull();

        Optional<CompanionMessageEntity> card = setupCheckService.runFor(owner);

        assertThat(card).isPresent();
        assertThat(card.orElseThrow().getContent().setupKey())
            .isEqualTo(SetupCheckService.CHECK_PLAN_FEASIBILITY);
    }

    @Test
    void testRunFor_shouldBindOnBedtime_whenThereIsNoSportScheduleAtAll() {
        // The bedtime half must still bind against the week's tightest morning even when the
        // sport half has literally nothing to pair with (zero sport_schedule_slot rows) — the
        // day-pairing correction must not have accidentally coupled the two halves together.
        UUID owner = userPopulator.createUser().getId();
        sleepGoalPopulator.goal(owner, 480, "WAKE", "06:00", 15);
        trainPopulator.createGymSlot(owner, 0, "07:00"); // required lights-out = 22:15

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
        assertThat(verdict.orElseThrow().bindingDay()).isNull();
        assertThat(verdict.orElseThrow().misfitMin()).isEqualTo(75);
    }

    @Test
    void testRunFor_shouldIgnoreAMalformedScheduleSlot_andStillEvaluateFromTheGoodOnes() {
        // sport_schedule_slot.time is varchar(5) with no entity-level @Pattern — a malformed row
        // ("99:99") must not throw DateTimeParseException out of the calculator (the job's
        // per-user catch would otherwise swallow it and silently kill this user's setup checks
        // every day, forever). The verdict must come out exactly as if the bad slot were absent.
        UUID owner = userPopulator.createUser().getId();
        sleepGoalPopulator.goal(owner, 480, "WAKE", "06:00", 15);   // 8h target (the goal's own wake)
        trainPopulator.createGymSlot(owner, 0, "07:00");            // Monday — keeps the global gate open
        trainPopulator.createGymSlot(owner, 5, "07:00");            // Saturday — pairs with Friday's sport slot
        // required lights-out for the Saturday-paired slot = 07:00 − 45' wake buffer − 8h target = 22:15.
        trainPopulator.createScheduleSlot(owner, 1, "99:99", 60, "training"); // malformed — must not bind or throw
        trainPopulator.createScheduleSlot(owner, 4, "21:00", 120, "training"); // Fri ends 23:00, +30' = 23:30
        // Friday's following day is Saturday (a real gym morning): 23:30 − 22:15 = 75' > 45' ⇒
        // infeasible, bound by the good Friday slot alone.

        Optional<PlanFeasibilityCalculator.Verdict> verdict =
            planFeasibilityCalculator.evaluate(owner, LocalDate.now());
        assertThat(verdict).isPresent();
        assertThat(verdict.orElseThrow().feasible()).isFalse();
        assertThat(verdict.orElseThrow().constraintSource())
            .isEqualTo(PlanFeasibilityCalculator.SOURCE_SPORT);
        assertThat(verdict.orElseThrow().misfitMin()).isEqualTo(75);
        assertThat(verdict.orElseThrow().bindingDay()).isEqualTo(4);

        Optional<CompanionMessageEntity> card = setupCheckService.runFor(owner);
        assertThat(card).isPresent();
        assertThat(card.orElseThrow().getContent().setupKey())
            .isEqualTo(SetupCheckService.CHECK_PLAN_FEASIBILITY);
    }

    @Test
    void testRunFor_shouldIgnoreAMalformedGymSlot_andStillFindTheMorningObligation() {
        // gym_schedule_slot.time has the same free-form varchar(5) contract — a malformed morning
        // slot must be dropped, not crash the earliest-obligation scan, in BOTH the global scan
        // and the per-day scan the day-pairing correction added.
        UUID owner = userPopulator.createUser().getId();
        sleepGoalPopulator.goal(owner, 480, "WAKE", "06:00", 15);
        trainPopulator.createGymSlot(owner, 0, "99:99");            // malformed — must not bind or throw
        trainPopulator.createGymSlot(owner, 2, "07:00");            // Wednesday — the real morning obligation
        trainPopulator.createScheduleSlot(owner, 4, "21:00", 120, "training"); // Fri ends 23:00, +30' = 23:30
        // Friday's following day (Saturday) has no gym slot of its own, so the WAKE goal's own
        // wake time (06:00) is the obligation there: required lights-out = 06:00 − 45' − 8h =
        // 21:15. 23:30 − 21:15 = 135' > 45' ⇒ still infeasible — the card must fire regardless.

        Optional<CompanionMessageEntity> card = setupCheckService.runFor(owner);

        assertThat(card).isPresent();
        assertThat(card.orElseThrow().getContent().setupKey())
            .isEqualTo(SetupCheckService.CHECK_PLAN_FEASIBILITY);
    }
}
