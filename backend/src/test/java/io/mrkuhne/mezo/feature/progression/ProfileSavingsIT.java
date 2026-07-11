package io.mrkuhne.mezo.feature.progression;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.ProgressionProfileResponse;
import io.mrkuhne.mezo.feature.activity.entity.ActivityLogEntity;
import io.mrkuhne.mezo.feature.progression.service.ProgressionService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.ActivityPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/** Profile savingsHuf30d: financial-entry amountHuf summed over the trailing 30 days. */
class ProfileSavingsIT extends AbstractIntegrationTest {

    @Autowired private ProgressionService progressionService;
    @Autowired private ActivityPopulator activityPopulator;
    @Autowired private UserPopulator userPopulator;

    @Test
    void testGetProfile_shouldSumFinancialAmounts_whenInsideWindow() {
        UUID owner = userPopulator.createUser("sav-a@test.hu").getId();
        LocalDate today = LocalDate.now();
        activityPopulator.financialActivity(owner, today.minusDays(2), "Átraktam 50 ezret", 50000L);
        activityPopulator.financialActivity(owner, today.minusDays(29), "Régebbi spórolás", 20000L);
        activityPopulator.financialActivity(owner, today.minusDays(31), "Ablakon kívül", 99999L);
        // non-financial entry with an amount must NOT count
        activityPopulator.activity(owner, today, "Olvastam", "learning", 10, ActivityLogEntity.BY_AI);

        ProgressionProfileResponse profile = progressionService.getProfile(owner);

        assertThat(profile.getSavingsHuf30d()).isEqualTo(70000L);
    }

    @Test
    void testGetProfile_shouldReturnZeroSavings_whenNoFinancialEntries() {
        UUID owner = userPopulator.createUser("sav-b@test.hu").getId();

        assertThat(progressionService.getProfile(owner).getSavingsHuf30d()).isZero();
    }
}
