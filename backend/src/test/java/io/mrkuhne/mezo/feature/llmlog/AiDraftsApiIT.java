package io.mrkuhne.mezo.feature.llmlog;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.AiDraftOutcomeRequest;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.llmlog.entity.AiDraftOutcomeEntity;
import io.mrkuhne.mezo.feature.llmlog.repository.AiDraftOutcomeRepository;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;

/**
 * HTTP-level contract IT for {@code POST /api/ai-drafts/{draftId}/outcome} (Slice 8 Task 1, bd
 * mezo-76f6, plan 2026-09-09-admin-value-dashboard-slice8 Rulings) — upsert (last signal wins per
 * owner+draft), ownership isolation (proven via the repository since the resource has no GET),
 * and anonymous 401.
 *
 * <p>Deliberately NOT {@code @Transactional} — mirrors {@code CompanionFeedbackApiIT}: requests
 * run in the server's own transactions, cleanup relies on the inherited per-test
 * {@code ResetDatabase}.
 */
class AiDraftsApiIT extends ApiIntegrationTest {

    @Autowired private AiDraftOutcomeRepository repository;
    @Autowired private OwnerProperties ownerProperties;

    private UUID ownerId() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    @Test
    void testRecordOutcome_shouldReturn204AndPersistFirstSignal_whenFirstWrite() {
        UUID draftId = UUID.randomUUID();
        HttpHeaders auth = ownerAuthHeaders();

        postForBody("/api/ai-drafts/" + draftId + "/outcome",
            AiDraftOutcomeRequest.builder().feature("meal_draft").outcome("accepted").build(),
            auth, HttpStatus.NO_CONTENT, Void.class);

        AiDraftOutcomeEntity row = repository.findByCreatedByAndDraftIdAndDeletedFalse(ownerId(), draftId).orElseThrow();
        assertThat(row.getFeature()).isEqualTo("meal_draft");
        assertThat(row.getOutcome()).isEqualTo(AiDraftOutcomeEntity.OUTCOME_ACCEPTED);
    }

    @Test
    void testRecordOutcome_shouldReplaceDiscardedWithAccepted_whenComposerReopenedAndSaved() {
        UUID draftId = UUID.randomUUID();
        HttpHeaders auth = ownerAuthHeaders();

        postForBody("/api/ai-drafts/" + draftId + "/outcome",
            AiDraftOutcomeRequest.builder().feature("meal_draft").outcome("discarded").build(),
            auth, HttpStatus.NO_CONTENT, Void.class);
        postForBody("/api/ai-drafts/" + draftId + "/outcome",
            AiDraftOutcomeRequest.builder().feature("meal_draft").outcome("accepted").build(),
            auth, HttpStatus.NO_CONTENT, Void.class);

        UUID ownerId = ownerId();
        AiDraftOutcomeEntity row = repository.findByCreatedByAndDraftIdAndDeletedFalse(ownerId, draftId).orElseThrow();
        assertThat(row.getOutcome()).isEqualTo(AiDraftOutcomeEntity.OUTCOME_ACCEPTED); // last signal wins
    }

    @Test
    void testRecordOutcome_shouldReplaceAcceptedWithDiscarded_whenLaterSignalDiscards() {
        UUID draftId = UUID.randomUUID();
        HttpHeaders auth = ownerAuthHeaders();

        postForBody("/api/ai-drafts/" + draftId + "/outcome",
            AiDraftOutcomeRequest.builder().feature("meso_plan").outcome("accepted").build(),
            auth, HttpStatus.NO_CONTENT, Void.class);
        postForBody("/api/ai-drafts/" + draftId + "/outcome",
            AiDraftOutcomeRequest.builder().feature("meso_plan").outcome("discarded").build(),
            auth, HttpStatus.NO_CONTENT, Void.class);

        UUID ownerId = ownerId();
        AiDraftOutcomeEntity row = repository.findByCreatedByAndDraftIdAndDeletedFalse(ownerId, draftId).orElseThrow();
        assertThat(row.getOutcome()).isEqualTo(AiDraftOutcomeEntity.OUTCOME_DISCARDED); // last signal wins, either direction
    }

    @Test
    void testRecordOutcome_shouldOverwriteAcceptedWithEdited_whenUserThenEditedBeforeSaving() {
        UUID draftId = UUID.randomUUID();
        HttpHeaders auth = ownerAuthHeaders();

        postForBody("/api/ai-drafts/" + draftId + "/outcome",
            AiDraftOutcomeRequest.builder().feature("meal_draft").outcome("accepted").build(),
            auth, HttpStatus.NO_CONTENT, Void.class);
        postForBody("/api/ai-drafts/" + draftId + "/outcome",
            AiDraftOutcomeRequest.builder().feature("meal_draft").outcome("edited").build(),
            auth, HttpStatus.NO_CONTENT, Void.class);

        UUID ownerId = ownerId();
        AiDraftOutcomeEntity row = repository.findByCreatedByAndDraftIdAndDeletedFalse(ownerId, draftId).orElseThrow();
        assertThat(row.getOutcome()).isEqualTo(AiDraftOutcomeEntity.OUTCOME_EDITED);
    }

    @Test
    void testRecordOutcome_shouldNotAffectOtherUsersRow_whenSameDraftIdWrittenByTwoOwners() {
        // The outcome surface has no GET (admin reads via repository) — isolation is proven here
        // by a second real write from a second principal (registerUser, real invite+register
        // flow) landing in its OWN row, never colliding with or overwriting the first owner's.
        UUID draftId = UUID.randomUUID();
        HttpHeaders ownerAuth = ownerAuthHeaders();
        RegisteredUser other = registerUser("Outcome Isolation Test");

        postForBody("/api/ai-drafts/" + draftId + "/outcome",
            AiDraftOutcomeRequest.builder().feature("meal_draft").outcome("accepted").build(),
            ownerAuth, HttpStatus.NO_CONTENT, Void.class);
        postForBody("/api/ai-drafts/" + draftId + "/outcome",
            AiDraftOutcomeRequest.builder().feature("meal_draft").outcome("discarded").build(),
            other.headers(), HttpStatus.NO_CONTENT, Void.class);

        UUID ownerId = ownerId();
        AiDraftOutcomeEntity ownerRow = repository.findByCreatedByAndDraftIdAndDeletedFalse(ownerId, draftId).orElseThrow();
        AiDraftOutcomeEntity otherRow = repository.findByCreatedByAndDraftIdAndDeletedFalse(other.id(), draftId).orElseThrow();

        assertThat(ownerRow.getOutcome()).isEqualTo(AiDraftOutcomeEntity.OUTCOME_ACCEPTED);
        assertThat(otherRow.getOutcome()).isEqualTo(AiDraftOutcomeEntity.OUTCOME_DISCARDED);
    }

    @Test
    void testRecordOutcome_shouldReturn401_whenAnonymous() {
        postForBody("/api/ai-drafts/" + UUID.randomUUID() + "/outcome",
            AiDraftOutcomeRequest.builder().feature("meal_draft").outcome("accepted").build(),
            null, HttpStatus.UNAUTHORIZED, String.class);
    }

    @Test
    void testRecordOutcome_shouldReturn400_whenOutcomeUnknown() {
        String body = postForBody("/api/ai-drafts/" + UUID.randomUUID() + "/outcome",
            AiDraftOutcomeRequest.builder().feature("meal_draft").outcome("sideways").build(),
            ownerAuthHeaders(), HttpStatus.BAD_REQUEST, String.class);

        assertHasFieldError(body, "outcome", "VALIDATION_INVALID_VALUE");
    }

    @Test
    void testRecordOutcome_shouldAccept_whenFeatureIsAnUnrecognizedFreeSlug() {
        // Ruling: "Rejects unknown feature slugs? No — free slug, admin joins by slug."
        postForBody("/api/ai-drafts/" + UUID.randomUUID() + "/outcome",
            AiDraftOutcomeRequest.builder().feature("some_future_generator").outcome("accepted").build(),
            ownerAuthHeaders(), HttpStatus.NO_CONTENT, Void.class);
    }

}
