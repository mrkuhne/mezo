package io.mrkuhne.mezo.feature.journal;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.CreateGratitudeEntryRequest;
import io.mrkuhne.mezo.api.dto.GratitudeEntryResponse;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;

/**
 * HTTP-level contract IT for the {@code /api/journal/gratitude} surface (bd mezo-b3pp.3) —
 * create (with server-side date default), validation errors, ranged listing, and soft-delete.
 */
class GratitudeApiIT extends ApiIntegrationTest {

    @Autowired private OwnerProperties ownerProperties;

    private UUID ownerId() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    @Test
    void testCreateGratitudeEntry_shouldReturn201WithDefaultedDate_whenOccurredOnAbsent() {
        var req = new CreateGratitudeEntryRequest();
        req.setText("Jó kávé");
        req.setLifeArea("cooking");

        var resp = postForBody("/api/journal/gratitude", req, ownerAuthHeaders(),
                HttpStatus.CREATED, GratitudeEntryResponse.class);

        assertThat(resp.getOccurredOn()).isEqualTo(LocalDate.now());
        assertThat(resp.getLifeArea()).isEqualTo("cooking");
        assertThat(resp.getId()).isNotNull();
        assertThat(resp.getText()).isEqualTo("Jó kávé");
    }

    @Test
    void testCreateGratitudeEntry_shouldReturn400_whenTextTooLong() {
        var req = new CreateGratitudeEntryRequest();
        req.setText("x".repeat(281));

        String body = postForBody("/api/journal/gratitude", req, ownerAuthHeaders(),
                HttpStatus.BAD_REQUEST, String.class);

        assertHasFieldError(body, "text", "VALIDATION_INVALID_VALUE");
    }

    @Test
    void testCreateGratitudeEntry_shouldReturn400_whenLifeAreaUnknown() {
        var req = new CreateGratitudeEntryRequest();
        req.setText("ok");
        req.setLifeArea("gardening");

        String body = postForBody("/api/journal/gratitude", req, ownerAuthHeaders(),
                HttpStatus.BAD_REQUEST, String.class);

        assertHasFieldError(body, "lifeArea", "VALIDATION_INVALID_VALUE");
    }

    @Test
    void testCreateGratitudeEntry_shouldReturn400_whenTextBlank() {
        var req = new CreateGratitudeEntryRequest();
        req.setText("");

        String body = postForBody("/api/journal/gratitude", req, ownerAuthHeaders(),
                HttpStatus.BAD_REQUEST, String.class);

        assertHasFieldError(body, "text", "VALIDATION_INVALID_VALUE");
    }

    @Test
    void testListGratitudeEntries_shouldReturnNewestFirst_whenEntriesExist() {
        var req1 = new CreateGratitudeEntryRequest();
        req1.setText("Régebbi");
        req1.setOccurredOn(LocalDate.parse("2026-08-10"));
        var created1 = postForBody("/api/journal/gratitude", req1, ownerAuthHeaders(),
                HttpStatus.CREATED, GratitudeEntryResponse.class);
        var req2 = new CreateGratitudeEntryRequest();
        req2.setText("Újabb");
        // pinned inside the fixed query window — an occurredOn defaulting to server-today
        // fell out of the August window the day the calendar rolled to September
        req2.setOccurredOn(LocalDate.parse("2026-08-20"));
        var created2 = postForBody("/api/journal/gratitude", req2, ownerAuthHeaders(),
                HttpStatus.CREATED, GratitudeEntryResponse.class);

        List<GratitudeEntryResponse> entries = getForList(
                "/api/journal/gratitude?from=2026-08-01&to=2026-08-31",
                ownerAuthHeaders(), HttpStatus.OK, GratitudeEntryResponse.class);

        assertThat(entries).extracting(GratitudeEntryResponse::getId)
                .containsExactly(created2.getId(), created1.getId());
    }

    @Test
    void testDeleteGratitudeEntry_shouldSoftDeleteAndVanishFromList_whenExisting() {
        var req = new CreateGratitudeEntryRequest();
        req.setText("törlendő");
        var created = postForBody("/api/journal/gratitude", req, ownerAuthHeaders(),
                HttpStatus.CREATED, GratitudeEntryResponse.class);

        deleteAndExpect("/api/journal/gratitude/" + created.getId(), ownerAuthHeaders(), HttpStatus.NO_CONTENT);

        List<GratitudeEntryResponse> entries = getForList(
                "/api/journal/gratitude?from=" + LocalDate.now().minusDays(1) + "&to=" + LocalDate.now(),
                ownerAuthHeaders(), HttpStatus.OK, GratitudeEntryResponse.class);
        assertThat(entries).extracting(GratitudeEntryResponse::getId).doesNotContain(created.getId());
    }

    @Test
    void testDeleteGratitudeEntry_shouldReturn404_whenUnknownId() {
        var response = exchangeForBody(HttpMethod.DELETE,
                "/api/journal/gratitude/00000000-0000-0000-0000-000000000000",
                null, ownerAuthHeaders(), HttpStatus.NOT_FOUND, String.class);

        assertHasRequestError(response, "GRATITUDE_ENTRY_NOT_FOUND");
    }
}
