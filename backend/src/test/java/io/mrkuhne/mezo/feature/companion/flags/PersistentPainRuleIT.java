package io.mrkuhne.mezo.feature.companion.flags;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.biometrics.checkin.entity.PainRegion;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagKey;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagOutcome;
import io.mrkuhne.mezo.feature.companion.flags.service.FlagVerdict;
import io.mrkuhne.mezo.feature.companion.flags.service.UnavailableReason;
import io.mrkuhne.mezo.feature.companion.flags.service.rule.PersistentPainRule;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.CheckInPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/** Check-in 2.0 (mezo-ck2, spec 2026-09-27 §3.2): the same pain region on ≥ 3 of the last 5 days. */
class PersistentPainRuleIT extends AbstractIntegrationTest {

    @Autowired private PersistentPainRule rule;
    @Autowired private CheckInPopulator checkInPopulator;
    @Autowired private UserPopulator userPopulator;

    private final LocalDate today = LocalDate.now();

    private void pain(UUID owner, LocalDate day, String slot, Integer intensity, PainRegion... regions) {
        checkInPopulator.createCheckIn(owner, day, slot, c -> {
            c.setPain(true);
            c.setPainRegions(List.of(regions));
            c.setPainIntensity(intensity);
        });
    }

    private void noPain(UUID owner, LocalDate day) {
        checkInPopulator.createCheckIn(owner, day, "06:30", c -> c.setPain(false));
    }

    @Test
    void testEvaluate_shouldRaiseWithTheRegion_whenSameRegionOnThreeOfFiveDays() {
        UUID owner = userPopulator.createUser().getId();
        pain(owner, today.minusDays(4), "06:30", 4, PainRegion.TERD);
        noPain(owner, today.minusDays(3));
        pain(owner, today.minusDays(2), "20:00", 6, PainRegion.TERD, PainRegion.DEREK);
        pain(owner, today, "06:30", 5, PainRegion.TERD);

        FlagVerdict verdict = rule.evaluate(owner, today);

        assertThat(verdict.outcome()).isEqualTo(FlagOutcome.RAISED);
        assertThat(verdict.flagKey()).isEqualTo(FlagKey.PERSISTENT_PAIN);
        var p = verdict.payload().persistentPain();
        assertThat(p.region()).isEqualTo("TERD");
        assertThat(p.regionDays()).isEqualTo(3);
        assertThat(p.answeredDays()).isEqualTo(4);
        assertThat(p.maxIntensity()).isEqualTo(6);
        assertThat(p.painDays()).containsExactly(today.minusDays(4).toString(),
            today.minusDays(2).toString(), today.toString());
    }

    @Test
    void testEvaluate_shouldClear_whenRegionsDifferAcrossDays() {
        UUID owner = userPopulator.createUser().getId();
        pain(owner, today.minusDays(2), "06:30", 4, PainRegion.TERD);
        pain(owner, today.minusDays(1), "06:30", 4, PainRegion.VALL);
        pain(owner, today, "06:30", 4, PainRegion.DEREK);

        FlagVerdict verdict = rule.evaluate(owner, today);

        assertThat(verdict.outcome()).isEqualTo(FlagOutcome.CLEAR);
        assertThat(verdict.clear().metric()).isEqualTo("pain_region_days");
        assertThat(verdict.clear().observed()).isEqualTo(1.0);
    }

    @Test
    void testEvaluate_shouldIgnoreDaysOutsideTheWindow_whenTheThirdDayIsSixDaysAgo() {
        UUID owner = userPopulator.createUser().getId();
        pain(owner, today.minusDays(5), "06:30", 4, PainRegion.TERD);
        pain(owner, today.minusDays(1), "06:30", 4, PainRegion.TERD);
        pain(owner, today, "06:30", 4, PainRegion.TERD);

        assertThat(rule.evaluate(owner, today).outcome()).isNotEqualTo(FlagOutcome.RAISED);
    }

    @Test
    void testEvaluate_shouldBeUnavailable_whenFewerAnsweredDaysThanMinDays() {
        UUID owner = userPopulator.createUser().getId();
        pain(owner, today.minusDays(1), "06:30", 4, PainRegion.TERD);
        pain(owner, today, "06:30", 4, PainRegion.TERD);

        FlagVerdict verdict = rule.evaluate(owner, today);

        assertThat(verdict.outcome()).isEqualTo(FlagOutcome.UNAVAILABLE);
        assertThat(verdict.reason()).isEqualTo(UnavailableReason.NOT_ENOUGH_PAIN_ANSWERS);
    }

    /** NULL is "not answered": rows without a pain answer are neither pain days nor answered days. */
    @Test
    void testEvaluate_shouldNotCountUnansweredPain_whenPainGateIsNull() {
        UUID owner = userPopulator.createUser().getId();
        pain(owner, today.minusDays(1), "06:30", 4, PainRegion.TERD);
        pain(owner, today, "06:30", 4, PainRegion.TERD);
        checkInPopulator.createCheckIn(owner, today.minusDays(2), "06:30", c -> c.setEnergy(5));
        checkInPopulator.createCheckIn(owner, today.minusDays(3), "06:30", c -> c.setEnergy(5));

        FlagVerdict verdict = rule.evaluate(owner, today);

        assertThat(verdict.outcome()).isEqualTo(FlagOutcome.UNAVAILABLE);
    }
}
