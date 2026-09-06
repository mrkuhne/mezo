package io.mrkuhne.mezo.feature.journal;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.CreateDecisionEntryRequest;
import io.mrkuhne.mezo.api.dto.DecisionEntryResponse;
import io.mrkuhne.mezo.api.dto.ReviewDecisionRequest;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.journal.config.JournalProperties;
import io.mrkuhne.mezo.feature.journal.repository.DecisionEntryRepository;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.JournalPopulator;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;

/**
 * HTTP-level contract IT for {@code /api/journal/decision} (bd mezo-b3pp.4, spec §5.4): the
 * server-side snapshot capture (including that a client-supplied one is ignored), the review-due
 * default, listing order, the review write, and ownership 404.
 *
 * <p>Not {@code @Transactional} — the create/review commits must really happen so Task 3's
 * AFTER_COMMIT embed listener fires on the same path a user would take.
 */
class DecisionApiIT extends ApiIntegrationTest {

    @Autowired private OwnerProperties ownerProperties;
    @Autowired private DecisionEntryRepository decisionEntryRepository;
    @Autowired private JournalPopulator journalPopulator;
    @Autowired private JournalProperties journalProperties;

    private UUID ownerId() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    @Test
    void testCreateDecisionEntry_shouldDefaultDayAndReviewDue_whenDecidedOnAbsent() {
        ownerId();

        // decidedOn (and the reviewDue derived from it) come from the SERVER's clock: capture the
        // day AROUND the call and accept either side, so a midnight between the two reads cannot
        // flip the assert. Both must land on the SAME side — reviewDue is decidedOn + N days.
        LocalDate dayBefore = LocalDate.now();
        DecisionEntryResponse created = postForBody("/api/journal/decision",
            CreateDecisionEntryRequest.builder().decisionText("Váltok esti edzésre.").build(),
            ownerAuthHeaders(), HttpStatus.CREATED, DecisionEntryResponse.class);
        LocalDate dayAfter = LocalDate.now();

        assertThat(created.getDecidedOn()).isIn(dayBefore, dayAfter);
        assertThat(created.getReviewDue())
            .isEqualTo(created.getDecidedOn().plusDays(journalProperties.decisionReviewDays()));
        assertThat(created.getReviewedAt()).isNull();
        assertThat(created.getOutcomeRating()).isNull();
    }

    @Test
    void testCreateDecisionEntry_shouldCaptureTheServersOwnSnapshot_whenTheClientSuppliesOne() {
        UUID owner = ownerId();

        // The contract has no contextSnapshot field; Boot's Jackson ignores unknown properties, so
        // this is exactly what a malicious/confused client could send. It must not reach the row.
        String rawBody = """
            {"decisionText":"Hamis kontextussal.","contextSnapshot":{"snapshotText":"HAZUGSÁG","capturedAt":"2020-01-01T00:00:00Z"}}
            """;
        HttpHeaders headers = ownerAuthHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        ResponseEntity<String> response = exchangeForResponse(HttpMethod.POST, "/api/journal/decision", rawBody, headers);
        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CREATED);

        var stored = decisionEntryRepository
            .findByCreatedByAndDeletedFalseOrderByDecidedOnDescCreatedAtDesc(owner);
        assertThat(stored).hasSize(1);
        assertThat(stored.getFirst().getContextSnapshot().snapshotText()).doesNotContain("HAZUGSÁG");
        assertThat(stored.getFirst().getContextSnapshot().snapshotText()).contains("[Profil]");
        assertThat(stored.getFirst().getContextSnapshot().capturedAt()).isAfter(java.time.Instant.parse("2026-01-01T00:00:00Z"));
    }

    @Test
    void testCreateDecisionEntry_shouldReturn400_whenTextBlank() {
        String body = postForBody("/api/journal/decision",
            CreateDecisionEntryRequest.builder().decisionText("").build(),
            ownerAuthHeaders(), HttpStatus.BAD_REQUEST, String.class);

        assertHasFieldError(body, "decisionText", "VALIDATION_INVALID_VALUE");
    }

    @Test
    void testListDecisionEntries_shouldReturnNewestFirst_whenSeveralExist() {
        UUID owner = ownerId();
        journalPopulator.createDecision(owner, LocalDate.parse("2026-06-01"), "Régi döntés.",
            LocalDate.parse("2026-07-01"), "ctx");
        journalPopulator.createDecision(owner, LocalDate.parse("2026-08-01"), "Új döntés.",
            LocalDate.parse("2026-08-31"), "ctx");

        List<DecisionEntryResponse> rows = getForList("/api/journal/decision", ownerAuthHeaders(),
            HttpStatus.OK, DecisionEntryResponse.class);

        assertThat(rows).extracting(DecisionEntryResponse::getDecisionText)
            .containsExactly("Új döntés.", "Régi döntés.");
    }

    @Test
    void testReviewDecisionEntry_shouldStampRatingAndReviewedAt_whenCalled() {
        UUID owner = ownerId();
        var decision = journalPopulator.createDecision(owner, LocalDate.parse("2026-07-21"),
            "Esti edzésre váltok.", LocalDate.parse("2026-08-20"), "ctx");

        DecisionEntryResponse reviewed = putForBody(
            "/api/journal/decision/" + decision.getId() + "/review",
            ReviewDecisionRequest.builder().outcomeRating(4).outcomeText("Jobban aludtam tőle.").build(),
            ownerAuthHeaders(), HttpStatus.OK, DecisionEntryResponse.class);

        assertThat(reviewed.getOutcomeRating()).isEqualTo(4);
        assertThat(reviewed.getOutcomeText()).isEqualTo("Jobban aludtam tőle.");
        assertThat(reviewed.getReviewedAt()).isNotNull();
    }

    @Test
    void testReviewDecisionEntry_shouldReturn400_whenRatingOutOfRange() {
        UUID owner = ownerId();
        var decision = journalPopulator.createDecision(owner, LocalDate.parse("2026-07-21"),
            "Rossz értékelés.", LocalDate.parse("2026-08-20"), "ctx");

        String body = putForBody("/api/journal/decision/" + decision.getId() + "/review",
            ReviewDecisionRequest.builder().outcomeRating(9).build(),
            ownerAuthHeaders(), HttpStatus.BAD_REQUEST, String.class);

        assertHasFieldError(body, "outcomeRating", "VALIDATION_INVALID_VALUE");
    }

    @Test
    void testReviewDecisionEntry_shouldReturn404_whenTheDecisionBelongsToSomeoneElse() {
        UUID stranger = databasePopulator.populateUser("decision-stranger@test.local");
        var foreign = journalPopulator.createDecision(stranger, LocalDate.parse("2026-07-21"),
            "Idegen döntés.", LocalDate.parse("2026-08-20"), "ctx");

        String body = putForBody("/api/journal/decision/" + foreign.getId() + "/review",
            ReviewDecisionRequest.builder().outcomeRating(3).build(),
            ownerAuthHeaders(), HttpStatus.NOT_FOUND, String.class);

        assertThat(body).contains("DECISION_ENTRY_NOT_FOUND");
    }
}
