package io.mrkuhne.mezo.feature.companion.feedback;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.MessageFeedbackResponse;
import io.mrkuhne.mezo.api.dto.PutFeedbackRequest;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.companion.feedback.entity.MessageFeedbackEntity;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.FeedbackPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;

/**
 * HTTP-level contract IT for the {@code /api/companion/feedback} surface (bd mezo-b3pp.15) —
 * drives the generated {@code CompanionFeedbackApi} over the real stack: upsert (first vote,
 * overwrite, resurrect-after-retraction), the service-level reason/verdict guard, contract
 * validation, retraction (including idempotency), and batch-read (including cross-user isolation).
 *
 * <p>Deliberately NOT {@code @Transactional} — see {@code JournalApiIT} for the rationale this
 * class shares (requests run in the server's own transactions; cleanup relies on the inherited
 * per-test {@code ResetDatabase}).
 */
class CompanionFeedbackApiIT extends ApiIntegrationTest {

    @Autowired private OwnerProperties ownerProperties;
    @Autowired private FeedbackPopulator feedbackPopulator;
    @Autowired private UserPopulator userPopulator;

    private UUID ownerId() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    @Test
    void testPutFeedback_shouldReturn200AndStoreUpVerdict_whenFirstVote() {
        UUID artifactId = UUID.randomUUID();

        MessageFeedbackResponse response = putForBody("/api/companion/feedback",
            PutFeedbackRequest.builder()
                .artifactKind(MessageFeedbackEntity.KIND_CHAT_MESSAGE)
                .artifactId(artifactId)
                .verdict(MessageFeedbackEntity.VERDICT_UP)
                .build(),
            ownerAuthHeaders(), HttpStatus.OK, MessageFeedbackResponse.class);

        assertThat(response.getArtifactKind()).isEqualTo(MessageFeedbackEntity.KIND_CHAT_MESSAGE);
        assertThat(response.getArtifactId()).isEqualTo(artifactId);
        assertThat(response.getVerdict()).isEqualTo(MessageFeedbackEntity.VERDICT_UP);
        assertThat(response.getReason()).isNull();
        assertThat(response.getUpdatedAt()).isNotNull();
    }

    @Test
    void testPutFeedback_shouldOverwrite_whenOppositeVerdictSent() {
        UUID artifactId = UUID.randomUUID();
        HttpHeaders auth = ownerAuthHeaders();

        putForBody("/api/companion/feedback",
            PutFeedbackRequest.builder()
                .artifactKind(MessageFeedbackEntity.KIND_FEED_MESSAGE)
                .artifactId(artifactId)
                .verdict(MessageFeedbackEntity.VERDICT_UP)
                .build(),
            auth, HttpStatus.OK, MessageFeedbackResponse.class);

        putForBody("/api/companion/feedback",
            PutFeedbackRequest.builder()
                .artifactKind(MessageFeedbackEntity.KIND_FEED_MESSAGE)
                .artifactId(artifactId)
                .verdict(MessageFeedbackEntity.VERDICT_DOWN)
                .reason(MessageFeedbackEntity.REASON_INACCURATE)
                .build(),
            auth, HttpStatus.OK, MessageFeedbackResponse.class);

        List<MessageFeedbackResponse> found = getForList(
            "/api/companion/feedback?kind=" + MessageFeedbackEntity.KIND_FEED_MESSAGE + "&ids=" + artifactId,
            auth, HttpStatus.OK, MessageFeedbackResponse.class);

        assertThat(found).hasSize(1);
        assertThat(found.get(0).getVerdict()).isEqualTo(MessageFeedbackEntity.VERDICT_DOWN);
        assertThat(found.get(0).getReason()).isEqualTo(MessageFeedbackEntity.REASON_INACCURATE);
    }

    @Test
    void testPutFeedback_shouldReturn400_whenReasonSentWithUp() {
        String body = putForBody("/api/companion/feedback",
            PutFeedbackRequest.builder()
                .artifactKind(MessageFeedbackEntity.KIND_CHAT_MESSAGE)
                .artifactId(UUID.randomUUID())
                .verdict(MessageFeedbackEntity.VERDICT_UP)
                .reason(MessageFeedbackEntity.REASON_TOO_MUCH)
                .build(),
            ownerAuthHeaders(), HttpStatus.BAD_REQUEST, String.class);

        assertHasRequestError(body, "FEEDBACK_REASON_REQUIRES_DOWN");
    }

    @Test
    void testPutFeedback_shouldReturn400_whenArtifactKindUnknown() {
        String body = putForBody("/api/companion/feedback",
            PutFeedbackRequest.builder()
                .artifactKind("bogus")
                .artifactId(UUID.randomUUID())
                .verdict(MessageFeedbackEntity.VERDICT_UP)
                .build(),
            ownerAuthHeaders(), HttpStatus.BAD_REQUEST, String.class);

        assertHasFieldError(body, "artifactKind", "VALIDATION_INVALID_VALUE");
    }

    @Test
    void testPutFeedback_shouldReturn400_whenVerdictUnknown() {
        String body = putForBody("/api/companion/feedback",
            PutFeedbackRequest.builder()
                .artifactKind(MessageFeedbackEntity.KIND_CHAT_MESSAGE)
                .artifactId(UUID.randomUUID())
                .verdict("sideways")
                .build(),
            ownerAuthHeaders(), HttpStatus.BAD_REQUEST, String.class);

        assertHasFieldError(body, "verdict", "VALIDATION_INVALID_VALUE");
    }

    @Test
    void testPutFeedback_shouldReturn400_whenReasonUnknown() {
        // paired with DOWN (the legal verdict for a reason) so this fails on the @Pattern check,
        // not the service-level reason/verdict guard covered by testPutFeedback_shouldReturn400_whenReasonSentWithUp
        String body = putForBody("/api/companion/feedback",
            PutFeedbackRequest.builder()
                .artifactKind(MessageFeedbackEntity.KIND_CHAT_MESSAGE)
                .artifactId(UUID.randomUUID())
                .verdict(MessageFeedbackEntity.VERDICT_DOWN)
                .reason("because_i_said_so")
                .build(),
            ownerAuthHeaders(), HttpStatus.BAD_REQUEST, String.class);

        assertHasFieldError(body, "reason", "VALIDATION_INVALID_VALUE");
    }

    @Test
    void testPutFeedback_shouldAccept_whenArtifactIdDanglingAcrossTables() {
        // spec §8.1: existence deliberately unchecked — a uuid that exists in no table is fine.
        MessageFeedbackResponse response = putForBody("/api/companion/feedback",
            PutFeedbackRequest.builder()
                .artifactKind(MessageFeedbackEntity.KIND_MEMOIR)
                .artifactId(UUID.randomUUID())
                .verdict(MessageFeedbackEntity.VERDICT_UP)
                .build(),
            ownerAuthHeaders(), HttpStatus.OK, MessageFeedbackResponse.class);

        assertThat(response.getVerdict()).isEqualTo(MessageFeedbackEntity.VERDICT_UP);
    }

    @Test
    void testDeleteFeedback_shouldReturn204AndRemoveVerdict_whenVoteExists() {
        UUID owner = ownerId();
        UUID artifactId = UUID.randomUUID();
        feedbackPopulator.createVerdict(owner, MessageFeedbackEntity.KIND_PREDICTION, artifactId,
            MessageFeedbackEntity.VERDICT_UP, null);
        HttpHeaders auth = ownerAuthHeaders();

        deleteAndExpect("/api/companion/feedback/" + MessageFeedbackEntity.KIND_PREDICTION + "/" + artifactId,
            auth, HttpStatus.NO_CONTENT);

        List<MessageFeedbackResponse> found = getForList(
            "/api/companion/feedback?kind=" + MessageFeedbackEntity.KIND_PREDICTION + "&ids=" + artifactId,
            auth, HttpStatus.OK, MessageFeedbackResponse.class);
        assertThat(found).isEmpty();
    }

    @Test
    void testDeleteFeedback_shouldReturn204_whenNoVoteExists() {
        deleteAndExpect(
            "/api/companion/feedback/" + MessageFeedbackEntity.KIND_WEEKLY_SUGGESTION + "/" + UUID.randomUUID(),
            ownerAuthHeaders(), HttpStatus.NO_CONTENT);
    }

    @Test
    void testPutFeedback_shouldResurrect_whenVotedAgainAfterRetraction() {
        UUID artifactId = UUID.randomUUID();
        HttpHeaders auth = ownerAuthHeaders();

        putForBody("/api/companion/feedback",
            PutFeedbackRequest.builder()
                .artifactKind(MessageFeedbackEntity.KIND_CHAT_MESSAGE)
                .artifactId(artifactId)
                .verdict(MessageFeedbackEntity.VERDICT_UP)
                .build(),
            auth, HttpStatus.OK, MessageFeedbackResponse.class);

        deleteAndExpect("/api/companion/feedback/" + MessageFeedbackEntity.KIND_CHAT_MESSAGE + "/" + artifactId,
            auth, HttpStatus.NO_CONTENT);

        putForBody("/api/companion/feedback",
            PutFeedbackRequest.builder()
                .artifactKind(MessageFeedbackEntity.KIND_CHAT_MESSAGE)
                .artifactId(artifactId)
                .verdict(MessageFeedbackEntity.VERDICT_DOWN)
                .reason(MessageFeedbackEntity.REASON_BAD_TIMING)
                .build(),
            auth, HttpStatus.OK, MessageFeedbackResponse.class);

        List<MessageFeedbackResponse> found = getForList(
            "/api/companion/feedback?kind=" + MessageFeedbackEntity.KIND_CHAT_MESSAGE + "&ids=" + artifactId,
            auth, HttpStatus.OK, MessageFeedbackResponse.class);

        assertThat(found).hasSize(1);
        assertThat(found.get(0).getVerdict()).isEqualTo(MessageFeedbackEntity.VERDICT_DOWN);
        assertThat(found.get(0).getReason()).isEqualTo(MessageFeedbackEntity.REASON_BAD_TIMING);
    }

    @Test
    void testListFeedback_shouldReturnOnlyVotedIds_whenBatchRead() {
        UUID owner = ownerId();
        UUID votedA = UUID.randomUUID();
        UUID votedB = UUID.randomUUID();
        UUID unvoted = UUID.randomUUID();
        feedbackPopulator.createVerdict(owner, MessageFeedbackEntity.KIND_FEED_MESSAGE, votedA,
            MessageFeedbackEntity.VERDICT_UP, null);
        feedbackPopulator.createVerdict(owner, MessageFeedbackEntity.KIND_FEED_MESSAGE, votedB,
            MessageFeedbackEntity.VERDICT_DOWN, MessageFeedbackEntity.REASON_NOT_ABOUT_ME);

        List<MessageFeedbackResponse> found = getForList(
            "/api/companion/feedback?kind=" + MessageFeedbackEntity.KIND_FEED_MESSAGE
                + "&ids=" + votedA + "," + votedB + "," + unvoted,
            ownerAuthHeaders(), HttpStatus.OK, MessageFeedbackResponse.class);

        assertThat(found).hasSize(2);
        assertThat(found).extracting(MessageFeedbackResponse::getArtifactId)
            .containsExactlyInAnyOrder(votedA, votedB);
    }

    @Test
    void testListFeedback_shouldNotLeakOtherUsersVerdicts_whenSameArtifactId() {
        UUID artifactId = UUID.randomUUID();
        UUID otherUser = userPopulator.createUser().getId();
        feedbackPopulator.createVerdict(otherUser, MessageFeedbackEntity.KIND_MEMOIR, artifactId,
            MessageFeedbackEntity.VERDICT_UP, null);

        List<MessageFeedbackResponse> found = getForList(
            "/api/companion/feedback?kind=" + MessageFeedbackEntity.KIND_MEMOIR + "&ids=" + artifactId,
            ownerAuthHeaders(), HttpStatus.OK, MessageFeedbackResponse.class);

        assertThat(found).isEmpty();
    }

    @Test
    void testListFeedback_shouldReturn400_whenKindUnknown() {
        String body = getForBody("/api/companion/feedback?kind=bogus&ids=" + UUID.randomUUID(),
            ownerAuthHeaders(), HttpStatus.BAD_REQUEST, String.class);

        assertHasFieldError(body, "kind", "VALIDATION_INVALID_VALUE");
    }

    @Test
    void testListFeedback_shouldReturn400_whenMoreThanTheContractMaximumIdsRequested() {
        // Probed first: 201 uuids (~7.4 KB of query string) is close to Tomcat's default 8 KB
        // server.max-http-request-header-size, which could reject the request before bean
        // validation ever runs (bare 400, no SystemMessageList body). In practice — with this
        // harness's thin TestRestTemplate header set, not a real browser's; see companion.md §8 —
        // the request clears Tomcat fine and reaches @Size(max = 200) on the generated API interface, landing
        // on the same ConstraintViolationException -> "ids"/VALIDATION_INVALID_VALUE path as any
        // other @Size violation (confirmed via the GlobalExceptionHandler "Validation failed" log
        // line, as opposed to the "Unconvertible request parameter" line the type-mismatch handler
        // would emit).
        String ids = Stream.generate(() -> UUID.randomUUID().toString())
            .limit(201)
            .collect(Collectors.joining(","));

        String body = getForBody("/api/companion/feedback?kind=" + MessageFeedbackEntity.KIND_CHAT_MESSAGE
            + "&ids=" + ids, ownerAuthHeaders(), HttpStatus.BAD_REQUEST, String.class);

        assertHasFieldError(body, "ids", "VALIDATION_INVALID_VALUE");
    }

    @Test
    void testListFeedback_shouldReturn400_whenIdsEmpty() {
        // Point-in-time observation, not a guarantee: when this was written, Spring bound
        // `ids=` (present but empty) to an empty List<UUID>, and the request reached
        // @Size(min = 1) on the generated API interface (confirmed via the GlobalExceptionHandler
        // "Validation failed" log line -- the ConstraintViolationException handler -- rather than
        // the "Unconvertible request parameter" line a UUID-conversion failure would emit). The
        // assertion below cannot by itself tell that path from a conversion failure: both
        // handleConstraintViolation and handleTypeMismatch emit an identical SystemMessage for
        // `ids` (same fieldName, same VALIDATION_INVALID_VALUE code), so a refactor that moved
        // this rejection to the type-mismatch route would still pass this test unchanged.
        String body = getForBody("/api/companion/feedback?kind=" + MessageFeedbackEntity.KIND_CHAT_MESSAGE + "&ids=",
            ownerAuthHeaders(), HttpStatus.BAD_REQUEST, String.class);

        assertHasFieldError(body, "ids", "VALIDATION_INVALID_VALUE");
    }
}
