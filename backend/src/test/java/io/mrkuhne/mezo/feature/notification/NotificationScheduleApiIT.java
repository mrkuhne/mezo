package io.mrkuhne.mezo.feature.notification;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.NotificationScheduleEntry;
import io.mrkuhne.mezo.api.dto.NotificationScheduleRequest;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.notification.entity.NotificationScheduleEntity;
import io.mrkuhne.mezo.feature.notification.repository.NotificationScheduleRepository;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

/** HTTP-level tests for /api/notification/schedule (bd mezo-h4wp.6.3). */
class NotificationScheduleApiIT extends ApiIntegrationTest {

    @Autowired private NotificationScheduleRepository scheduleRepository;
    @Autowired private AppUserRepository appUserRepository;
    @Autowired private OwnerProperties ownerProperties;

    private UUID ownerId() {
        return appUserRepository.findByEmail(ownerProperties.ownerEmail()).orElseThrow().getId();
    }

    private static NotificationScheduleEntry entry(Integer weekday, String time, String category, String title,
            String deeplink, String source) {
        NotificationScheduleEntry e = new NotificationScheduleEntry();
        e.setWeekday(weekday);
        e.setTime(time);
        e.setCategory(category);
        e.setTitle(title);
        e.setDeeplink(deeplink);
        e.setSource(source);
        return e;
    }

    private static NotificationScheduleRequest request(List<String> categories, List<NotificationScheduleEntry> entries) {
        NotificationScheduleRequest r = new NotificationScheduleRequest();
        r.setCategories(categories);
        r.setEntries(entries);
        return r;
    }

    @Test
    void testPutNotificationSchedule_shouldStoreEntries_whenCategoryIsNew() {
        NotificationScheduleRequest request = request(List.of("checkin"), List.of(
                entry(null, "08:00", "checkin", "Reggeli bejelentkezés", "/today", "checkinSlots"),
                entry(null, "20:00", "checkin", "Esti bejelentkezés", "/today", "checkinSlots")));

        putForBody("/api/notification/schedule", request, ownerAuthHeaders(), HttpStatus.NO_CONTENT, Void.class);

        assertThat(scheduleRepository.findByCreatedByAndCategory(ownerId(), "checkin")).hasSize(2);
    }

    @Test
    void testPutNotificationSchedule_shouldReplaceLiveSet_whenSameCategoryPutTwice() {
        NotificationScheduleRequest first = request(List.of("fuel_slot"), List.of(
                entry(null, "07:00", "fuel_slot", "Reggeli adag", "/fuel/stack", "buildProtocol"),
                entry(null, "12:00", "fuel_slot", "Déli adag", "/fuel/stack", "buildProtocol")));
        putForBody("/api/notification/schedule", first, ownerAuthHeaders(), HttpStatus.NO_CONTENT, Void.class);

        NotificationScheduleRequest second = request(List.of("fuel_slot"), List.of(
                entry(null, "09:00", "fuel_slot", "Délelőtti adag", "/fuel/stack", "buildProtocol")));
        putForBody("/api/notification/schedule", second, ownerAuthHeaders(), HttpStatus.NO_CONTENT, Void.class);

        List<NotificationScheduleEntity> live = scheduleRepository.findByCreatedByAndCategory(ownerId(), "fuel_slot");
        assertThat(live).hasSize(1);
        assertThat(live.getFirst().getTime()).isEqualTo("09:00");
    }

    @Test
    void testPutNotificationSchedule_shouldClearCategory_whenNamedWithNoEntries() {
        NotificationScheduleRequest seed = request(List.of("checkin"), List.of(
                entry(null, "08:00", "checkin", "Reggeli bejelentkezés", "/today", "checkinSlots")));
        putForBody("/api/notification/schedule", seed, ownerAuthHeaders(), HttpStatus.NO_CONTENT, Void.class);

        NotificationScheduleRequest clear = request(List.of("checkin"), List.of());
        putForBody("/api/notification/schedule", clear, ownerAuthHeaders(), HttpStatus.NO_CONTENT, Void.class);

        assertThat(scheduleRepository.findByCreatedByAndCategory(ownerId(), "checkin")).isEmpty();
    }

    @Test
    void testPutNotificationSchedule_shouldReturn400_whenCategoryIsBackendNative() {
        NotificationScheduleRequest request = request(List.of("gym"), List.of(
                entry(1, "17:00", "gym", "Edzés", "/train", "gym_schedule_slot")));

        ResponseEntity<String> response = exchangeForResponse(
                HttpMethod.PUT, "/api/notification/schedule", request, ownerAuthHeaders());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertHasRequestError(response.getBody(), "NOTIFICATION_UNKNOWN_CATEGORY");
        assertThat(scheduleRepository.findByCreatedByAndCategory(ownerId(), "gym")).isEmpty();
    }

    @Test
    void testPutNotificationSchedule_shouldReturn400_whenCategoryIsUnknown() {
        NotificationScheduleRequest request = request(List.of("not_a_real_category"), List.of());

        ResponseEntity<String> response = exchangeForResponse(
                HttpMethod.PUT, "/api/notification/schedule", request, ownerAuthHeaders());

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertHasRequestError(response.getBody(), "NOTIFICATION_UNKNOWN_CATEGORY");
    }

    @Test
    void testPutNotificationSchedule_shouldReturn401_whenUnauthenticated() {
        NotificationScheduleRequest request = request(List.of("checkin"), List.of());
        putForBody("/api/notification/schedule", request, new HttpHeaders(), HttpStatus.UNAUTHORIZED, String.class);
    }
}
