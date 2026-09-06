package io.mrkuhne.mezo.feature.journal;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.CreateJournalEntryRequest;
import io.mrkuhne.mezo.api.dto.JournalEntryResponse;
import io.mrkuhne.mezo.api.dto.UpdateJournalEntryRequest;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.journal.entity.JournalEntryEntity;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.JournalPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;

/**
 * HTTP-level contract IT for the {@code /api/journal} surface (bd mezo-b3pp.1) — drives the
 * generated {@code JournalApi} over the real stack: create (with the server-side date default),
 * validation errors, ranged listing newest-first, update, ownership 404, and soft-delete.
 *
 * <p>Deliberately NOT {@code @Transactional}: a later task's AFTER_COMMIT companion-embed listener
 * needs the commit to actually happen, so this class already runs against the server's own
 * transactions (cleanup relies on the inherited per-test {@code ResetDatabase}).
 */
class JournalApiIT extends ApiIntegrationTest {

    @Autowired private OwnerProperties ownerProperties;
    @Autowired private JournalPopulator journalPopulator;
    @Autowired private UserPopulator userPopulator;

    /** Find-or-create yields the demodata-seeded owner's id — the principal behind ownerAuthHeaders(). */
    private UUID ownerId() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    @Test
    void testCreateJournalEntry_shouldReturn201WithDefaultedDate_whenOccurredOnAbsent() {
        // occurredOn is stamped by the SERVER's clock: capture the day AROUND the call and accept
        // either side of it, so a midnight between the two reads cannot flip the assert.
        LocalDate dayBefore = LocalDate.now();
        JournalEntryResponse created = postForBody("/api/journal",
            CreateJournalEntryRequest.builder().text("Ma jó napom volt.").source("quickinput").build(),
            ownerAuthHeaders(), HttpStatus.CREATED, JournalEntryResponse.class);
        LocalDate dayAfter = LocalDate.now();

        assertThat(created.getId()).isNotNull();
        assertThat(created.getOccurredOn()).isIn(dayBefore, dayAfter);
        assertThat(created.getText()).isEqualTo("Ma jó napom volt.");
        assertThat(created.getSource()).isEqualTo(JournalEntryResponse.SourceEnum.QUICKINPUT);
        assertThat(created.getCreatedAt()).isNotNull();
    }

    @Test
    void testCreateJournalEntry_shouldReturn400_whenTextBlank() {
        String body = postForBody("/api/journal",
            CreateJournalEntryRequest.builder().text("").source("quickinput").build(),
            ownerAuthHeaders(), HttpStatus.BAD_REQUEST, String.class);

        assertHasFieldError(body, "text", "VALIDATION_INVALID_VALUE");
    }

    @Test
    void testCreateJournalEntry_shouldReturn400_whenSourceUnknown() {
        String body = postForBody("/api/journal",
            CreateJournalEntryRequest.builder().text("Valami.").source("bogus").build(),
            ownerAuthHeaders(), HttpStatus.BAD_REQUEST, String.class);

        assertHasFieldError(body, "source", "VALIDATION_INVALID_VALUE");
    }

    @Test
    void testListJournalEntries_shouldReturnNewestFirstWithinRange_whenEntriesExist() {
        UUID owner = ownerId();
        journalPopulator.createEntry(owner, LocalDate.parse("2026-08-10"), "Régi bejegyzés.",
            JournalEntryEntity.SOURCE_QUICKINPUT);
        journalPopulator.createEntry(owner, LocalDate.parse("2026-08-15"), "Első a tartományban.",
            JournalEntryEntity.SOURCE_QUICKINPUT);
        journalPopulator.createEntry(owner, LocalDate.parse("2026-08-17"), "Legújabb a tartományban.",
            JournalEntryEntity.SOURCE_RITUAL);

        List<JournalEntryResponse> entries = getForList(
            "/api/journal?from=2026-08-14&to=2026-08-18", ownerAuthHeaders(), HttpStatus.OK,
            JournalEntryResponse.class);

        assertThat(entries).hasSize(2);
        assertThat(entries).extracting(JournalEntryResponse::getText)
            .containsExactly("Legújabb a tartományban.", "Első a tartományban.");
    }

    @Test
    void testUpdateJournalEntry_shouldChangeTextAndKeepDate_whenOccurredOnAbsent() {
        UUID owner = ownerId();
        JournalEntryEntity entry = journalPopulator.createEntry(owner, LocalDate.parse("2026-08-12"),
            "Eredeti szöveg.", JournalEntryEntity.SOURCE_QUICKINPUT);

        JournalEntryResponse updated = putForBody("/api/journal/" + entry.getId(),
            UpdateJournalEntryRequest.builder().text("Módosított szöveg.").build(),
            ownerAuthHeaders(), HttpStatus.OK, JournalEntryResponse.class);

        assertThat(updated.getText()).isEqualTo("Módosított szöveg.");
        assertThat(updated.getOccurredOn()).isEqualTo(LocalDate.parse("2026-08-12"));
    }

    @Test
    void testUpdateJournalEntry_shouldReturn404_whenNotOwnEntry() {
        UUID otherUser = userPopulator.createUser().getId();
        JournalEntryEntity entry = journalPopulator.createEntry(otherUser, LocalDate.now(),
            "Nem az enyém.", JournalEntryEntity.SOURCE_QUICKINPUT); // single read — never re-derived

        String body = putForBody("/api/journal/" + entry.getId(),
            UpdateJournalEntryRequest.builder().text("Próbálkozás.").build(),
            ownerAuthHeaders(), HttpStatus.NOT_FOUND, String.class);

        assertHasRequestError(body, "JOURNAL_ENTRY_NOT_FOUND");
    }

    @Test
    void testDeleteJournalEntry_shouldSoftDeleteAndVanishFromList_whenExisting() {
        UUID owner = ownerId();
        // both the seeded row's day and the window bounds are test-owned: read the day ONCE so a
        // midnight in the middle of the test cannot move the window off the row it was seeded on
        LocalDate today = LocalDate.now();
        JournalEntryEntity entry = journalPopulator.createEntry(owner, today,
            "Törlendő bejegyzés.", JournalEntryEntity.SOURCE_QUICKINPUT);
        HttpHeaders auth = ownerAuthHeaders();

        deleteAndExpect("/api/journal/" + entry.getId(), auth, HttpStatus.NO_CONTENT);

        List<JournalEntryResponse> entries = getForList(
            "/api/journal?from=" + today + "&to=" + today, auth, HttpStatus.OK,
            JournalEntryResponse.class);
        assertThat(entries).extracting(JournalEntryResponse::getId).doesNotContain(entry.getId());
    }
}
