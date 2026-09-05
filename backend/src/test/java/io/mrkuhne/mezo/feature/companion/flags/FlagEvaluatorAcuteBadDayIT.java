package io.mrkuhne.mezo.feature.companion.flags;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.flags.service.FlagEvaluator;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagKey;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagOutcome;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagVerdict;
import io.mrkuhne.mezo.feature.companion.flags.service.UnavailableReason;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.CheckInPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/** Spec 2026-09-03 §4 row 6 (rank 1): same-day ≥2 check-ins with body or energy ≤3. */
class FlagEvaluatorAcuteBadDayIT extends AbstractIntegrationTest {

    @Autowired private FlagEvaluator evaluator;
    @Autowired private CheckInPopulator checkInPopulator;
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

    @Test
    void raises_when_two_check_ins_qualify_today() {
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        // (owner, date, slotTime, energy, stress, body, mental, note)
        checkInPopulator.createCheckIn(owner, today, "08:00", 3, 5, 5, 5, null);
        checkInPopulator.createCheckIn(owner, today, "20:00", 5, 5, 3, 5, null);

        assertThat(keys(owner)).contains(FlagKey.ACUTE_BAD_DAY);
    }

    @Test
    void stays_silent_with_only_one_check_in_today() {
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        checkInPopulator.createCheckIn(owner, today, "08:00", 2, 5, 2, 5, null);

        assertThat(keys(owner)).doesNotContain(FlagKey.ACUTE_BAD_DAY);
    }

    @Test
    void stays_silent_when_only_one_of_two_check_ins_qualifies() {
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        checkInPopulator.createCheckIn(owner, today, "08:00", 2, 5, 2, 5, null);
        checkInPopulator.createCheckIn(owner, today, "20:00", 8, 5, 8, 5, null);

        assertThat(keys(owner)).doesNotContain(FlagKey.ACUTE_BAD_DAY);
    }

    @Test
    void a_null_body_and_energy_does_not_count_as_qualifying() {
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        checkInPopulator.createCheckIn(owner, today, "08:00", 2, 5, 2, 5, null);
        checkInPopulator.createCheckIn(owner, today, "20:00", null, 5, null, 5, null);

        assertThat(keys(owner)).doesNotContain(FlagKey.ACUTE_BAD_DAY);
    }

    @Test
    void a_score_of_three_qualifies_the_boundary() {
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        checkInPopulator.createCheckIn(owner, today, "08:00", 3, 5, 5, 5, null);
        checkInPopulator.createCheckIn(owner, today, "20:00", 3, 5, 5, 5, null);

        assertThat(keys(owner)).contains(FlagKey.ACUTE_BAD_DAY);
    }

    @Test
    void a_score_of_four_does_not_qualify_the_boundary() {
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        checkInPopulator.createCheckIn(owner, today, "08:00", 4, 5, 5, 5, null);
        checkInPopulator.createCheckIn(owner, today, "20:00", 4, 5, 5, 5, null);

        assertThat(keys(owner)).doesNotContain(FlagKey.ACUTE_BAD_DAY);
    }

    @Test
    void the_payload_freezes_the_qualifying_check_ins() {
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        checkInPopulator.createCheckIn(owner, today, "08:00", 3, 5, 2, 5, null);
        checkInPopulator.createCheckIn(owner, today, "20:00", 2, 5, 8, 5, null);

        FlagVerdict verdict = verdictFor(evaluator.evaluate(owner), FlagKey.ACUTE_BAD_DAY);

        assertThat(verdict.payload().acuteBadDay().minCheckIns()).isEqualTo(2);
        assertThat(verdict.payload().acuteBadDay().bodyOrEnergyAtMost()).isEqualTo(3);
        assertThat(verdict.payload().acuteBadDay().qualifyingCount()).isEqualTo(2);
        assertThat(verdict.payload().acuteBadDay().qualifyingCheckIns())
            .extracting("slotTime", "body", "energy")
            .containsExactlyInAnyOrder(
                org.assertj.core.groups.Tuple.tuple("08:00", 2, 3),
                org.assertj.core.groups.Tuple.tuple("20:00", 8, 2));
    }

    @Test
    void is_unavailable_with_only_one_check_in_today() {
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        checkInPopulator.createCheckIn(owner, today, "08:00", 2, 5, 2, 5, null);

        FlagVerdict verdict = verdictFor(evaluator.evaluate(owner), FlagKey.ACUTE_BAD_DAY);

        assertThat(verdict.outcome()).isEqualTo(FlagOutcome.UNAVAILABLE);
        assertThat(verdict.reason()).isEqualTo(UnavailableReason.NOT_ENOUGH_CHECKINS);
    }

    @Test
    void is_clear_when_only_one_of_two_check_ins_qualifies() {
        UUID owner = ownerId();
        LocalDate today = LocalDate.now();
        checkInPopulator.createCheckIn(owner, today, "08:00", 2, 5, 2, 5, null);
        checkInPopulator.createCheckIn(owner, today, "20:00", 8, 5, 8, 5, null);

        FlagVerdict verdict = verdictFor(evaluator.evaluate(owner), FlagKey.ACUTE_BAD_DAY);

        assertThat(verdict.outcome()).isEqualTo(FlagOutcome.CLEAR);
        assertThat(verdict.clear().metric()).isEqualTo("bad_checkins");
        assertThat(verdict.clear().observed()).isLessThan(verdict.clear().threshold());
    }
}
