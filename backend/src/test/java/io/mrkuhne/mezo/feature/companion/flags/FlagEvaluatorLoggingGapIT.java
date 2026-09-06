package io.mrkuhne.mezo.feature.companion.flags;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.flags.entity.FlagPayloadEnvelope;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagEvaluator;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagKey;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagOutcome;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagVerdict;
import io.mrkuhne.mezo.feature.pantry.entity.PantryItemEntity;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.CheckInPopulator;
import io.mrkuhne.mezo.support.populator.MealPopulator;
import io.mrkuhne.mezo.support.populator.PantryItemPopulator;
import io.mrkuhne.mezo.support.populator.SleepLogPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * S2 logging_gap (spec 2026-09-03 §4 row 1) plus its sleep-suspicion variant (row 5) — the
 * detector that must speak precisely WHEN the value-based rules go quiet.
 */
class FlagEvaluatorLoggingGapIT extends AbstractIntegrationTest {

    @Autowired private FlagEvaluator evaluator;
    @Autowired private CheckInPopulator checkInPopulator;
    @Autowired private SleepLogPopulator sleepLogPopulator;
    @Autowired private UserPopulator userPopulator;
    @Autowired private MealPopulator mealPopulator;
    @Autowired private PantryItemPopulator pantryItemPopulator;

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

    private Optional<FlagPayloadEnvelope.LoggingGap> gapPayload(UUID owner) {
        return evaluator.evaluate(owner).stream()
            .filter(v -> FlagKey.LOGGING_GAP.equals(v.flagKey()))
            .filter(v -> v.outcome() == FlagOutcome.RAISED)
            .map(v -> v.payload().loggingGap())
            .findFirst();
    }

    @Test
    void logging_gap_raises_for_a_user_who_has_logged_nothing_at_all() {
        UUID owner = ownerId();

        assertThat(keys(owner)).contains(FlagKey.LOGGING_GAP);
        assertThat(gapPayload(owner)).isPresent();
        assertThat(gapPayload(owner).orElseThrow().staleDomains())
            .containsExactlyInAnyOrder("meal", "checkin", "sleep");
    }

    @Test
    void logging_gap_stays_quiet_when_every_domain_is_fresh() {
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        checkInPopulator.createCheckIn(owner, today, "08:00", 6, 3, null);
        sleepLogPopulator.createSleepLog(owner, today, BigDecimal.valueOf(8.0), 4);
        freshMeal(owner, today);

        assertThat(keys(owner)).doesNotContain(FlagKey.LOGGING_GAP);
    }

    @Test
    void logging_gap_names_only_the_stale_domain_when_the_others_are_fresh() {
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        checkInPopulator.createCheckIn(owner, today, "08:00", 6, 3, null);
        freshMeal(owner, today);
        // No sleep log at all ⇒ sleep is the only stale domain.

        assertThat(gapPayload(owner).orElseThrow().staleDomains()).containsExactly("sleep");
    }

    @Test
    void logging_gap_treats_a_sleep_log_from_two_mornings_ago_as_stale() {
        // sleep-stale-mornings=2 ⇒ the newest wake morning must be within [today-1, today].
        // A row dated today-2 is exactly one morning too old: this boundary is load-bearing.
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        checkInPopulator.createCheckIn(owner, today, "08:00", 6, 3, null);
        freshMeal(owner, today);
        sleepLogPopulator.createSleepLog(owner, today.minusDays(2), BigDecimal.valueOf(8.0), 4);

        assertThat(gapPayload(owner).orElseThrow().staleDomains()).containsExactly("sleep");
    }

    @Test
    void logging_gap_accepts_a_sleep_log_from_yesterday_morning_as_fresh() {
        // The other side of the same boundary: today-1 is still inside the window.
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        checkInPopulator.createCheckIn(owner, today, "08:00", 6, 3, null);
        freshMeal(owner, today);
        sleepLogPopulator.createSleepLog(owner, today.minusDays(1), BigDecimal.valueOf(8.0), 4);

        assertThat(keys(owner)).doesNotContain(FlagKey.LOGGING_GAP);
    }

    @Test
    void logging_gap_carries_the_sleep_suspicion_when_the_few_logged_nights_are_short() {
        // sleep_debt needs min-nights=2 logged nights inside its 3-night window; one 5.5h night
        // (2.5h under the 8h default goal) leaves it silent. The gap card must carry the
        // suspicion instead — spec §4 row 5's whole point.
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        sleepLogPopulator.createSleepLog(owner, today, BigDecimal.valueOf(5.5), 3);

        FlagPayloadEnvelope.LoggingGap payload = gapPayload(owner).orElseThrow();
        assertThat(keys(owner)).doesNotContain(FlagKey.SLEEP_DEBT);
        assertThat(payload.observedDeficitPerLoggedNight()).isNotNull();
        assertThat(payload.observedDeficitPerLoggedNight()).isGreaterThanOrEqualTo(1.0);
        assertThat(payload.loggedNights()).isEqualTo(1);
    }

    @Test
    void logging_gap_omits_the_sleep_suspicion_when_sleep_debt_itself_already_raised() {
        // The suspicion clause is guarded by d.loggedNights() < sleepCfg.minNights() — it must
        // fire ONLY when sleep_debt stayed silent for want of nights, never merely because the
        // logged nights were short. Three logged nights (>= min-nights=2) of 5.5h each give a
        // 7.5h deficit over the nights=3 window, well past deficit-hours=3.0, so sleep_debt DOES
        // raise here — the gap payload must NOT also carry a suspicion for the same short nights.
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        sleepLogPopulator.createSleepLog(owner, today, BigDecimal.valueOf(5.5), 3);
        sleepLogPopulator.createSleepLog(owner, today.minusDays(1), BigDecimal.valueOf(5.5), 3);
        sleepLogPopulator.createSleepLog(owner, today.minusDays(2), BigDecimal.valueOf(5.5), 3);

        assertThat(keys(owner)).contains(FlagKey.SLEEP_DEBT);
        FlagPayloadEnvelope.LoggingGap payload = gapPayload(owner).orElseThrow();
        assertThat(payload.observedDeficitPerLoggedNight()).isNull();
    }

    @Test
    void logging_gap_omits_the_sleep_suspicion_when_the_logged_nights_are_fine() {
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        sleepLogPopulator.createSleepLog(owner, today, BigDecimal.valueOf(8.5), 4);

        FlagPayloadEnvelope.LoggingGap payload = gapPayload(owner).orElseThrow();
        assertThat(payload.observedDeficitPerLoggedNight()).isNull();
    }

    /**
     * A meal row logged just now. Note the populator's DEFAULT loggedAt is the hardcoded
     * 2026-06-24T11:30Z (see {@code MealPopulator.newMeal}), which is ancient relative to the
     * test clock — so a fresh meal MUST go through the explicit-instant overload, or the meal
     * domain silently reads as stale and these fixtures stop meaning what they say.
     */
    private void freshMeal(UUID owner, LocalDate date) {
        PantryItemEntity item = pantryItemPopulator.createFoodWithNutrients(owner, "csirke");
        mealPopulator.createPantryMeal(owner, item, date, Instant.now());
    }

    @Test
    void logging_gap_is_clear_when_every_domain_is_fresh() {
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        checkInPopulator.createCheckIn(owner, today, "08:00", 6, 3, null);
        sleepLogPopulator.createSleepLog(owner, today, BigDecimal.valueOf(8.0), 4);
        freshMeal(owner, today);

        FlagVerdict verdict = verdictFor(evaluator.evaluate(owner), FlagKey.LOGGING_GAP);

        assertThat(verdict.outcome()).isEqualTo(FlagOutcome.CLEAR);
        assertThat(verdict.clear().metric()).isEqualTo("stale_domains");
        assertThat(verdict.clear().observed()).isLessThan(verdict.clear().threshold());
    }
}
