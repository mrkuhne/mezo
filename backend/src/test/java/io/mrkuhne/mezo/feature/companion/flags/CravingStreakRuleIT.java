package io.mrkuhne.mezo.feature.companion.flags;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.biometrics.checkin.entity.CravingKind;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagKey;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagOutcome;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagVerdict;
import io.mrkuhne.mezo.feature.companion.flags.service.UnavailableReason;
import io.mrkuhne.mezo.feature.companion.flags.service.rule.CravingStreakRule;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.CheckInPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/** Check-in 2.0 (mezo-ck2, spec 2026-09-27 §3.2): craving ≥ 7 of the same kind on ≥ 3 of 5 days. */
class CravingStreakRuleIT extends AbstractIntegrationTest {

    @Autowired private CravingStreakRule rule;
    @Autowired private CheckInPopulator checkInPopulator;
    @Autowired private UserPopulator userPopulator;

    private final LocalDate today = LocalDate.now();

    private void craving(UUID owner, LocalDate day, String slot, Integer value, CravingKind... kinds) {
        checkInPopulator.createCheckIn(owner, day, slot, c -> {
            c.setCraving(value);
            c.setCravingKinds(kinds.length == 0 ? null : List.of(kinds));
        });
    }

    @Test
    void testEvaluate_shouldRaiseWithKindAndDaypart_whenSameKindOnThreeDays() {
        UUID owner = userPopulator.createUser().getId();
        craving(owner, today.minusDays(4), "14:00", 8, CravingKind.EDES);
        craving(owner, today.minusDays(2), "14:00", 7, CravingKind.EDES, CravingKind.SOS);
        craving(owner, today.minusDays(1), "20:00", 9, CravingKind.EDES);
        craving(owner, today, "14:00", 7, CravingKind.EDES);

        FlagVerdict verdict = rule.evaluate(owner, today);

        assertThat(verdict.outcome()).isEqualTo(FlagOutcome.RAISED);
        assertThat(verdict.flagKey()).isEqualTo(FlagKey.CRAVING_STREAK);
        var p = verdict.payload().cravingStreak();
        assertThat(p.kind()).isEqualTo("EDES");
        assertThat(p.kindDays()).isEqualTo(4);
        assertThat(p.dominantDaypart()).isEqualTo("délután");
    }

    @Test
    void testEvaluate_shouldClear_whenKindsDiffer() {
        UUID owner = userPopulator.createUser().getId();
        craving(owner, today.minusDays(2), "14:00", 8, CravingKind.EDES);
        craving(owner, today.minusDays(1), "14:00", 8, CravingKind.SOS);
        craving(owner, today, "14:00", 8, CravingKind.ZSIROS);

        FlagVerdict verdict = rule.evaluate(owner, today);

        assertThat(verdict.outcome()).isEqualTo(FlagOutcome.CLEAR);
        assertThat(verdict.clear().metric()).isEqualTo("craving_kind_days");
    }

    @Test
    void testEvaluate_shouldClear_whenCravingBelowThreshold() {
        UUID owner = userPopulator.createUser().getId();
        craving(owner, today.minusDays(2), "14:00", 6, CravingKind.EDES);
        craving(owner, today.minusDays(1), "14:00", 6, CravingKind.EDES);
        craving(owner, today, "14:00", 6, CravingKind.EDES);

        assertThat(rule.evaluate(owner, today).outcome()).isEqualTo(FlagOutcome.CLEAR);
    }

    @Test
    void testEvaluate_shouldBeUnavailable_whenFewerAnsweredDaysThanMinDays() {
        UUID owner = userPopulator.createUser().getId();
        craving(owner, today.minusDays(1), "14:00", 9, CravingKind.EDES);
        craving(owner, today, "14:00", 9, CravingKind.EDES);

        FlagVerdict verdict = rule.evaluate(owner, today);

        assertThat(verdict.outcome()).isEqualTo(FlagOutcome.UNAVAILABLE);
        assertThat(verdict.reason()).isEqualTo(UnavailableReason.NOT_ENOUGH_CRAVING_ANSWERS);
    }

    /** NULL is "not answered": a strong craving with no kind answer counts for no kind. */
    @Test
    void testEvaluate_shouldNotCountAKind_whenKindsUnanswered() {
        UUID owner = userPopulator.createUser().getId();
        craving(owner, today.minusDays(2), "14:00", 9, CravingKind.EDES);
        craving(owner, today.minusDays(1), "14:00", 9);
        craving(owner, today, "14:00", 9, CravingKind.EDES);

        assertThat(rule.evaluate(owner, today).outcome()).isEqualTo(FlagOutcome.CLEAR);
    }

    @Test
    void testEvaluate_shouldNameNoDaypart_whenNoneHoldsMoreThanHalf() {
        UUID owner = userPopulator.createUser().getId();
        craving(owner, today.minusDays(3), "06:30", 8, CravingKind.SOS);
        craving(owner, today.minusDays(2), "10:00", 8, CravingKind.SOS);
        craving(owner, today.minusDays(1), "14:00", 8, CravingKind.SOS);
        craving(owner, today, "20:00", 8, CravingKind.SOS);

        FlagVerdict verdict = rule.evaluate(owner, today);

        assertThat(verdict.outcome()).isEqualTo(FlagOutcome.RAISED);
        assertThat(verdict.payload().cravingStreak().dominantDaypart()).isNull();
    }
}
