package io.mrkuhne.mezo.feature.companion.flags;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.flags.entity.FlagPayloadEnvelope;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagEvaluator;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagKey;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagOutcome;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagVerdict;
import io.mrkuhne.mezo.feature.companion.flags.service.UnavailableReason;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.CheckInPopulator;
import io.mrkuhne.mezo.support.populator.MealPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * Round 2 S6 (mezo-d58h.7.7, spec 2026-09-05 §(15)): afternoon energy vs. meal timing — the
 * CORRELATION rule. See {@code EnergyDipMealTimingRule}'s javadoc for the four bounds this file
 * proves: the day gate (an afternoon check-in AND meal data), the degenerate-split guard, the
 * breakfast fallback, and the consistency (superiority) requirement on top of the median delta.
 */
class FlagEvaluatorEnergyDipIT extends AbstractIntegrationTest {

    @Autowired private FlagEvaluator evaluator;
    @Autowired private UserPopulator userPopulator;
    @Autowired private CheckInPopulator checkInPopulator;
    @Autowired private MealPopulator mealPopulator;

    private static final LocalDate TODAY = LocalDate.now();

    private static FlagVerdict verdictFor(List<FlagVerdict> verdicts, String flagKey) {
        return verdicts.stream().filter(v -> flagKey.equals(v.flagKey())).findFirst().orElseThrow();
    }

    private FlagVerdict verdict(UUID owner) {
        return verdictFor(evaluator.evaluate(owner), FlagKey.ENERGY_DIP_MEAL_TIMING);
    }

    private Optional<FlagPayloadEnvelope.EnergyDipMealTiming> payload(UUID owner) {
        FlagVerdict v = verdict(owner);
        return v.outcome() == FlagOutcome.RAISED
            ? Optional.of(v.payload().energyDipMealTiming()) : Optional.empty();
    }

    /** One closed day, {@code daysAgo} back: an afternoon check-in at 14:00 with {@code energy},
     *  a lunch at {@code lunch} (null ⇒ no lunch row) and optionally a breakfast at 07:30. */
    private void day(UUID owner, int daysAgo, int energy, LocalTime lunch, boolean breakfast) {
        LocalDate d = TODAY.minusDays(daysAgo);
        checkInPopulator.createCheckIn(owner, d, "14:00", energy, 3, null);
        if (breakfast) {
            mealPopulator.createBareMealAt(owner, d, "breakfast", LocalTime.of(7, 30));
        }
        if (lunch != null) {
            mealPopulator.createBareMealAt(owner, d, "lunch", lunch);
        }
    }

    /** The detection: six early-lunch days at energy 8 against six late-lunch days at energy 5. */
    @Test
    void raises_when_afternoon_energy_tracks_the_lunch_time_split() {
        UUID owner = userPopulator.createUser().getId();
        for (int i = 1; i <= 6; i++) {
            day(owner, i, 8, LocalTime.of(12, 0), true);
        }
        for (int i = 7; i <= 12; i++) {
            day(owner, i, 5, LocalTime.of(14, 30), true);
        }

        assertThat(verdict(owner).outcome()).isEqualTo(FlagOutcome.RAISED);
        assertThat(payload(owner)).hasValueSatisfying(p -> {
            assertThat(p.splitMode()).isEqualTo("lunch_time");
            assertThat(p.groupALabel()).isEqualTo("earlier_lunch");
            assertThat(p.groupADays()).isEqualTo(6);
            assertThat(p.groupBDays()).isEqualTo(6);
            assertThat(p.groupAMedianEnergy()).isEqualTo(8.0);
            assertThat(p.groupBMedianEnergy()).isEqualTo(5.0);
            assertThat(p.energyDelta()).isEqualTo(3.0);
            assertThat(p.superiority()).isEqualTo(1.0);
            assertThat(p.higherGroup()).isEqualTo("A");
            assertThat(p.groupAMedianLunchTime()).isEqualTo("12:00");
            assertThat(p.groupBMedianLunchTime()).isEqualTo("14:30");
            assertThat(p.qualifyingDays()).isEqualTo(12);
        });
    }

    /** The rule reports a correlation in EITHER direction — later lunches can be the better days,
     *  and the card must be able to say so. */
    @Test
    void raises_with_group_b_higher_when_the_later_lunch_days_are_the_better_ones() {
        UUID owner = userPopulator.createUser().getId();
        for (int i = 1; i <= 6; i++) {
            day(owner, i, 4, LocalTime.of(12, 0), true);
        }
        for (int i = 7; i <= 12; i++) {
            day(owner, i, 8, LocalTime.of(14, 30), true);
        }

        assertThat(payload(owner)).hasValueSatisfying(p -> {
            assertThat(p.higherGroup()).isEqualTo("B");
            assertThat(p.energyDelta()).isEqualTo(4.0);
            assertThat(p.superiority()).isEqualTo(1.0);
        });
    }

    /** A usable split that simply does not separate is a CLEAR, not a raise and not an
     *  unavailable: the rule genuinely looked and found the two halves the same. */
    @Test
    void stays_clear_when_the_two_groups_are_less_than_a_full_point_apart() {
        UUID owner = userPopulator.createUser().getId();
        int[] early = {7, 7, 7, 6, 6, 6};   // median 6.5
        int[] late = {6, 6, 6, 6, 6, 6};    // median 6.0 ⇒ delta 0.5 < 1.0
        for (int i = 0; i < 6; i++) {
            day(owner, i + 1, early[i], LocalTime.of(12, 0), true);
        }
        for (int i = 0; i < 6; i++) {
            day(owner, i + 7, late[i], LocalTime.of(14, 30), true);
        }

        FlagVerdict v = verdict(owner);
        assertThat(v.outcome()).isEqualTo(FlagOutcome.CLEAR);
        assertThat(v.clear().metric()).isEqualTo("energy_delta");
        assertThat(v.clear().observed()).isEqualTo(0.5);
        assertThat(v.clear().threshold()).isEqualTo(1.0);
    }

    /** The consistency gate: the medians ARE a point apart, but the groups overlap almost
     *  completely, so the superiority share never reaches 70% and the rule stays quiet. */
    @Test
    void stays_clear_when_the_medians_differ_but_the_groups_overlap() {
        UUID owner = userPopulator.createUser().getId();
        int[] early = {9, 9, 9, 2, 2, 2, 2};  // median 2 … wide spread, both directions
        int[] late = {9, 9, 9, 1, 1, 1, 1};
        for (int i = 0; i < 7; i++) {
            day(owner, i + 1, early[i], LocalTime.of(12, 0), true);
        }
        for (int i = 0; i < 7; i++) {
            day(owner, i + 8, late[i], LocalTime.of(14, 30), true);
        }

        assertThat(verdict(owner).outcome()).isEqualTo(FlagOutcome.CLEAR);
    }

    /** The honesty gate: nine qualifying days is under the ten the spec requires. */
    @Test
    void stays_unavailable_below_the_minimum_number_of_qualifying_days() {
        UUID owner = userPopulator.createUser().getId();
        for (int i = 1; i <= 5; i++) {
            day(owner, i, 8, LocalTime.of(12, 0), true);
        }
        for (int i = 6; i <= 9; i++) {
            day(owner, i, 4, LocalTime.of(14, 30), true);
        }

        FlagVerdict v = verdict(owner);
        assertThat(v.outcome()).isEqualTo(FlagOutcome.UNAVAILABLE);
        assertThat(v.reason()).isEqualTo(UnavailableReason.NOT_ENOUGH_ENERGY_MEAL_DAYS);
    }

    /** A day with an afternoon check-in but NO logged meal at all is unknown, not a data point:
     *  twelve such days still leave the sample empty. */
    @Test
    void never_counts_a_day_whose_meals_were_not_logged() {
        UUID owner = userPopulator.createUser().getId();
        for (int i = 1; i <= 12; i++) {
            checkInPopulator.createCheckIn(owner, TODAY.minusDays(i), "14:00", 8, 3, null);
        }

        assertThat(verdict(owner).reason()).isEqualTo(UnavailableReason.NOT_ENOUGH_ENERGY_MEAL_DAYS);
    }

    /** Only the 11:00–16:00 band counts: a morning and an evening check-in say nothing about the
     *  early afternoon, however many of them there are. */
    @Test
    void ignores_check_ins_outside_the_early_afternoon_band() {
        UUID owner = userPopulator.createUser().getId();
        for (int i = 1; i <= 12; i++) {
            LocalDate d = TODAY.minusDays(i);
            checkInPopulator.createCheckIn(owner, d, "09:00", 9, 3, null);
            checkInPopulator.createCheckIn(owner, d, "18:00", 2, 3, null);
            mealPopulator.createBareMealAt(owner, d, "lunch", LocalTime.of(12, 0));
        }

        assertThat(verdict(owner).reason()).isEqualTo(UnavailableReason.NOT_ENOUGH_ENERGY_MEAL_DAYS);
    }

    /** The spec's fallback: every lunch is at 13:00, so the lunch split is degenerate — and the
     *  breakfast-presence split takes over. */
    @Test
    void falls_back_to_breakfast_presence_when_the_lunch_times_do_not_vary() {
        UUID owner = userPopulator.createUser().getId();
        for (int i = 1; i <= 6; i++) {
            day(owner, i, 8, LocalTime.of(13, 0), true);
        }
        for (int i = 7; i <= 12; i++) {
            day(owner, i, 5, LocalTime.of(13, 0), false);
        }

        assertThat(payload(owner)).hasValueSatisfying(p -> {
            assertThat(p.splitMode()).isEqualTo("breakfast_presence");
            assertThat(p.groupALabel()).isEqualTo("with_breakfast");
            assertThat(p.groupBLabel()).isEqualTo("without_breakfast");
            assertThat(p.groupADays()).isEqualTo(6);
            assertThat(p.groupBDays()).isEqualTo(6);
            assertThat(p.higherGroup()).isEqualTo("A");
            assertThat(p.groupAMedianLunchTime()).isNull();
            assertThat(p.groupBMedianLunchTime()).isNull();
        });
    }

    /** Neither arm can split: one lunch time, and every day has a breakfast. Nothing was compared,
     *  which is NOT the same claim as "compared and found nothing". */
    @Test
    void stays_unavailable_when_no_split_is_usable() {
        UUID owner = userPopulator.createUser().getId();
        for (int i = 1; i <= 12; i++) {
            day(owner, i, 8, LocalTime.of(13, 0), true);
        }

        FlagVerdict v = verdict(owner);
        assertThat(v.outcome()).isEqualTo(FlagOutcome.UNAVAILABLE);
        assertThat(v.reason()).isEqualTo(UnavailableReason.NO_USABLE_SPLIT);
    }

    /** The minimum group size bites before the delta does: eleven early-lunch days against three
     *  late ones is a lopsided split, not a comparison. */
    @Test
    void stays_unavailable_when_one_side_of_the_split_is_too_small() {
        UUID owner = userPopulator.createUser().getId();
        for (int i = 1; i <= 11; i++) {
            day(owner, i, 8, LocalTime.of(12, 0), true);
        }
        for (int i = 12; i <= 14; i++) {
            day(owner, i, 3, LocalTime.of(14, 30), true);
        }

        assertThat(verdict(owner).reason()).isEqualTo(UnavailableReason.NO_USABLE_SPLIT);
    }

    /** Today is not in the window: an in-progress afternoon must not tip a verdict. */
    @Test
    void never_reads_today() {
        UUID owner = userPopulator.createUser().getId();
        for (int i = 1; i <= 5; i++) {
            day(owner, i, 8, LocalTime.of(12, 0), true);
        }
        for (int i = 6; i <= 9; i++) {
            day(owner, i, 4, LocalTime.of(14, 30), true);
        }
        day(owner, 0, 4, LocalTime.of(14, 30), true); // TODAY — must not become the 10th day

        assertThat(verdict(owner).reason()).isEqualTo(UnavailableReason.NOT_ENOUGH_ENERGY_MEAL_DAYS);
    }
}
