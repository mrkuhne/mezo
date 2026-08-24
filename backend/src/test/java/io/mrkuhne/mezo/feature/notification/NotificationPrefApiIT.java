package io.mrkuhne.mezo.feature.notification;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.NotificationPref;
import io.mrkuhne.mezo.api.dto.NotificationPrefListRequest;
import io.mrkuhne.mezo.api.dto.NotificationPrefListResponse;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.notification.repository.NotificationPrefRepository;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

/** HTTP-level tests for /api/notification/pref (bd mezo-h4wp.6.2). */
class NotificationPrefApiIT extends ApiIntegrationTest {

    @Autowired private NotificationPrefRepository prefRepository;
    @Autowired private AppUserRepository appUserRepository;
    @Autowired private OwnerProperties ownerProperties;

    private UUID ownerId() {
        return appUserRepository.findByEmail(ownerProperties.ownerEmail()).orElseThrow().getId();
    }

    private static NotificationPref pref(String category, boolean enabled, int leadMinutes) {
        NotificationPref p = new NotificationPref();
        p.setCategory(category);
        p.setEnabled(enabled);
        p.setLeadMinutes(leadMinutes);
        return p;
    }

    private static NotificationPrefListRequest request(NotificationPref... prefs) {
        NotificationPrefListRequest r = new NotificationPrefListRequest();
        r.setPrefs(List.of(prefs));
        return r;
    }

    @Test
    void testGetNotificationPrefs_shouldReturnAllTwentyOneWithSpecDefaults_whenFreshUser() {
        NotificationPrefListResponse response = getForBody("/api/notification/pref",
                ownerAuthHeaders(), HttpStatus.OK, NotificationPrefListResponse.class);

        assertThat(response.getPrefs()).hasSize(21);
        assertThat(response.getPrefs())
                .filteredOn(p -> p.getCategory().equals("gym"))
                .singleElement()
                .satisfies(p -> {
                    assertThat(p.getEnabled()).isTrue();
                    assertThat(p.getLeadMinutes()).isEqualTo(30);
                });
        assertThat(response.getPrefs())
                .filteredOn(p -> p.getCategory().equals("wind_down"))
                .singleElement()
                .satisfies(p -> {
                    assertThat(p.getEnabled()).isFalse();
                    assertThat(p.getLeadMinutes()).isEqualTo(0);
                });
        assertThat(response.getPrefs())
                .filteredOn(p -> p.getCategory().equals("evening"))
                .singleElement()
                .satisfies(p -> {
                    assertThat(p.getEnabled()).isTrue();
                    assertThat(p.getLeadMinutes()).isEqualTo(0);
                });
        // 7 pre-existing ON categories + the 3 companion-feed categories (evening/
        // sleep_reaction/weight_reaction) + 6 feed-anchored categories (pattern/knowledge/prediction/
        // experiment/challenge/memory), all default ON (mezo-gst9, spec 2026-08-18)
        // + decision_review, default ON (Phase 5 W1.4, bd mezo-b3pp.4).
        assertThat(response.getPrefs().stream().filter(NotificationPref::getEnabled).count()).isEqualTo(17);
    }

    @Test
    void testPutThenGetNotificationPrefs_shouldRoundTripChangedToggleAndLead_whenUpdated() {
        putForBody("/api/notification/pref", request(pref("gym", false, 45)),
                ownerAuthHeaders(), HttpStatus.NO_CONTENT, Void.class);

        NotificationPrefListResponse response = getForBody("/api/notification/pref",
                ownerAuthHeaders(), HttpStatus.OK, NotificationPrefListResponse.class);

        assertThat(response.getPrefs())
                .filteredOn(p -> p.getCategory().equals("gym"))
                .singleElement()
                .satisfies(p -> {
                    assertThat(p.getEnabled()).isFalse();
                    assertThat(p.getLeadMinutes()).isEqualTo(45);
                });
    }

    @Test
    void testPutNotificationPrefs_shouldLeaveOneRow_whenCalledTwiceForSameCategory() {
        putForBody("/api/notification/pref", request(pref("briefing", false, 0)),
                ownerAuthHeaders(), HttpStatus.NO_CONTENT, Void.class);
        putForBody("/api/notification/pref", request(pref("briefing", true, 0)),
                ownerAuthHeaders(), HttpStatus.NO_CONTENT, Void.class);

        assertThat(prefRepository.findByCreatedByAndCategory(ownerId(), "briefing")).isPresent();
        assertThat(prefRepository.findByCreatedBy(ownerId())).hasSize(1);
    }

    @Test
    void testPutNotificationPrefs_shouldReturn400WithUnknownCategoryCode_whenCategoryIsUnknown() {
        ResponseEntity<String> response = exchangeForResponse(HttpMethod.PUT, "/api/notification/pref",
                request(pref("not_a_real_category", true, 0)), ownerAuthHeaders());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertHasRequestError(response.getBody(), "NOTIFICATION_UNKNOWN_CATEGORY");
    }

    @Test
    void testGetNotificationPrefs_shouldReturn401_whenUnauthenticated() {
        getForBody("/api/notification/pref", new HttpHeaders(), HttpStatus.UNAUTHORIZED, String.class);
    }
}
