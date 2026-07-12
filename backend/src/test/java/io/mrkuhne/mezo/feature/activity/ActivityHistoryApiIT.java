package io.mrkuhne.mezo.feature.activity;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.ActivityResponse;
import io.mrkuhne.mezo.feature.activity.entity.ActivityLogEntity;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.ActivityPopulator;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;

/** /api/activity/history — inclusive range, newest first, owner-scoped. */
class ActivityHistoryApiIT extends ApiIntegrationTest {

    @Autowired private ActivityPopulator activityPopulator;
    @Autowired private AppUserRepository appUserRepository;
    @Autowired private OwnerProperties ownerProperties;

    private UUID ownerId() {
        return appUserRepository.findByEmail(ownerProperties.ownerEmail()).orElseThrow().getId();
    }

    @Test
    void testGetActivityHistory_shouldListRangeNewestFirst_whenEntriesSpanRange() {
        UUID owner = ownerId();
        LocalDate to = LocalDate.now();
        activityPopulator.activity(owner, to.minusDays(1), "Olvastam", "learning", 15, ActivityLogEntity.BY_AI);
        activityPopulator.financialActivity(owner, to.minusDays(3), "Spórolás", 50000L);
        activityPopulator.activity(owner, to.minusDays(31), "Régi bejegyzés", "mindset", 10, ActivityLogEntity.BY_AI);

        ActivityResponse[] list = getForBody("/api/activity/history?from=" + to.minusDays(29) + "&to=" + to,
            ownerAuthHeaders(), HttpStatus.OK, ActivityResponse[].class);

        assertThat(list).hasSize(2);
        assertThat(list[0].getText()).isEqualTo("Olvastam");
        assertThat(list[1].getAmountHuf()).isEqualTo(50000L);
    }
}
