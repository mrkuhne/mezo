package io.mrkuhne.mezo.feature.notification;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.NotificationFeedResponse;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.AppNotificationPopulator;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;

/** HTTP-level tests for /api/notification/feed (bd mezo-gzhp.1). */
class NotificationFeedApiIT extends ApiIntegrationTest {

    @Autowired private AppNotificationPopulator populator;
    @Autowired private AppUserRepository appUserRepository;
    @Autowired private OwnerProperties ownerProperties;

    private UUID ownerId() {
        return appUserRepository.findByEmail(ownerProperties.ownerEmail()).orElseThrow().getId();
    }

    @Test
    void testGetFeed_shouldReturnOwnRowsNewestFirst_whenRowsExist() {
        populator.notification(ownerId(), "pattern_inbox", "pattern_inbox:x", Instant.parse("2026-08-18T04:40:00Z"));
        populator.notification(ownerId(), "memory_note", "memory_note:y", Instant.parse("2026-08-18T00:20:00Z"));

        NotificationFeedResponse response = getForBody("/api/notification/feed",
                ownerAuthHeaders(), HttpStatus.OK, NotificationFeedResponse.class);

        assertThat(response.getItems()).hasSize(2);
        assertThat(response.getItems().get(0).getKind()).isEqualTo("pattern_inbox");
        assertThat(response.getItems().get(0).getReadAt()).isNull();
    }

    @Test
    void testReadAll_shouldStampEveryRow_whenCalled() {
        populator.notification(ownerId(), "fact_reinforced", "fact_reinforced:f:2", Instant.now());

        postForBody("/api/notification/feed/read-all", null, ownerAuthHeaders(), HttpStatus.NO_CONTENT, Void.class);

        NotificationFeedResponse response = getForBody("/api/notification/feed",
                ownerAuthHeaders(), HttpStatus.OK, NotificationFeedResponse.class);
        assertThat(response.getItems().get(0).getReadAt()).isNotNull();
    }

    @Test
    void testGetFeed_shouldReturn401_whenUnauthenticated() {
        getForBody("/api/notification/feed", new HttpHeaders(), HttpStatus.UNAUTHORIZED, String.class);
    }
}
