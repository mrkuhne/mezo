package io.mrkuhne.mezo.feature.admin.controller;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.AdminFeatureDownReason;
import io.mrkuhne.mezo.api.dto.AdminFeedbackRecall;
import io.mrkuhne.mezo.api.dto.AdminUserFeedbackResponse;
import io.mrkuhne.mezo.api.dto.AdminUserFeedbackSurface;
import io.mrkuhne.mezo.feature.companion.feedback.entity.MessageFeedbackEntity;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryItemEntity;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryRetrievalResultEntity;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryRetrievalRunEntity;
import io.mrkuhne.mezo.feature.companion.memory.entity.ScoreBreakdownEnvelope;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.FeedbackPopulator;
import io.mrkuhne.mezo.support.populator.MemoryItemPopulator;
import java.time.LocalDate;
import java.util.UUID;
import org.assertj.core.groups.Tuple;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;

/**
 * GET /api/admin/users/{id}/feedback — one user's per-surface companion feedback and recall
 * totals (mezo-zde2). Surfaces group on the RAW {@code artifact_kind} (chat_message, feed_message,
 * ...), NOT a feature slug — Task 3's client-side {@code SURFACE_LABELS} maps that to a Hungarian
 * name; nothing here reads {@code mezo.admin.artifact-feature-map}.
 */
class AdminUserFeedbackIT extends ApiIntegrationTest {

    @Autowired private FeedbackPopulator feedbackPopulator;
    @Autowired private MemoryItemPopulator memoryItemPopulator;

    private static String uri(UUID id) {
        return "/api/admin/users/" + id + "/feedback";
    }

    @Test
    void testUserFeedback_shouldReturn403_whenCallerIsUser() {
        RegisteredUser anna = registerUser("Anna");
        assertHasRequestError(getForBody(uri(anna.id()), anna.headers(), HttpStatus.FORBIDDEN, String.class),
                "AUTH_FORBIDDEN");
    }

    @Test
    void testUserFeedback_shouldReturn404_whenUserDoesNotExist() {
        assertHasRequestError(
                getForBody(uri(UUID.randomUUID()), ownerAuthHeaders(), HttpStatus.NOT_FOUND, String.class),
                "ADMIN_USER_NOT_FOUND");
    }

    @Test
    void testUserFeedback_shouldReturnEmptySurfacesAndZeroRecall_whenUserCastNoVotes() {
        RegisteredUser anna = registerUser("Anna");

        AdminUserFeedbackResponse body =
                getForBody(uri(anna.id()), ownerAuthHeaders(), HttpStatus.OK, AdminUserFeedbackResponse.class);

        assertThat(body.getSurfaces()).isEmpty();
        assertThat(body.getRecall()).isEqualTo(
                new AdminFeedbackRecall().useful(0).irrelevant(0).suppress(0));
    }

    @Test
    void testUserFeedback_shouldGroupByRawArtifactKindWithReasonsHistogram_whenVotesExist() {
        RegisteredUser anna = registerUser("Anna");
        feedbackPopulator.createVerdict(anna.id(), MessageFeedbackEntity.KIND_CHAT_MESSAGE, UUID.randomUUID(), "up", null);
        feedbackPopulator.createVerdict(anna.id(), MessageFeedbackEntity.KIND_CHAT_MESSAGE, UUID.randomUUID(), "up", null);
        feedbackPopulator.createVerdict(anna.id(), MessageFeedbackEntity.KIND_CHAT_MESSAGE, UUID.randomUUID(),
                "down", MessageFeedbackEntity.REASON_INACCURATE);
        feedbackPopulator.createVerdict(anna.id(), MessageFeedbackEntity.KIND_CHAT_MESSAGE, UUID.randomUUID(),
                "down", MessageFeedbackEntity.REASON_INACCURATE);
        feedbackPopulator.createVerdict(anna.id(), MessageFeedbackEntity.KIND_CHAT_MESSAGE, UUID.randomUUID(),
                "down", MessageFeedbackEntity.REASON_TOO_MUCH);
        feedbackPopulator.createVerdict(anna.id(), MessageFeedbackEntity.KIND_FEED_MESSAGE, UUID.randomUUID(), "up", null);

        AdminUserFeedbackResponse body =
                getForBody(uri(anna.id()), ownerAuthHeaders(), HttpStatus.OK, AdminUserFeedbackResponse.class);

        assertThat(body.getSurfaces()).extracting(AdminUserFeedbackSurface::getKind)
                .containsExactly(MessageFeedbackEntity.KIND_CHAT_MESSAGE, MessageFeedbackEntity.KIND_FEED_MESSAGE);

        AdminUserFeedbackSurface chat = body.getSurfaces().stream()
                .filter(s -> MessageFeedbackEntity.KIND_CHAT_MESSAGE.equals(s.getKind())).findFirst().orElseThrow();
        assertThat(chat.getUp()).isEqualTo(2);
        assertThat(chat.getDown()).isEqualTo(3);
        assertThat(chat.getReasons()).extracting(AdminFeatureDownReason::getReason, AdminFeatureDownReason::getCount)
                .containsExactly(
                        Tuple.tuple(MessageFeedbackEntity.REASON_INACCURATE, 2),
                        Tuple.tuple(MessageFeedbackEntity.REASON_TOO_MUCH, 1));

        AdminUserFeedbackSurface feed = body.getSurfaces().stream()
                .filter(s -> MessageFeedbackEntity.KIND_FEED_MESSAGE.equals(s.getKind())).findFirst().orElseThrow();
        assertThat(feed.getUp()).isEqualTo(1);
        assertThat(feed.getDown()).isEqualTo(0);
        assertThat(feed.getReasons()).isEmpty();
    }

    @Test
    void testUserFeedback_shouldIsolateVotesPerUser_whenAnotherUserHasVotesToo() {
        RegisteredUser anna = registerUser("Anna");
        RegisteredUser bela = registerUser("Bela");
        feedbackPopulator.createVerdict(anna.id(), MessageFeedbackEntity.KIND_CHAT_MESSAGE, UUID.randomUUID(), "up", null);
        feedbackPopulator.createVerdict(bela.id(), MessageFeedbackEntity.KIND_CHAT_MESSAGE, UUID.randomUUID(),
                "down", MessageFeedbackEntity.REASON_BAD_TIMING);
        feedbackPopulator.createVerdict(bela.id(), MessageFeedbackEntity.KIND_CHAT_MESSAGE, UUID.randomUUID(),
                "down", MessageFeedbackEntity.REASON_BAD_TIMING);
        feedbackPopulator.createVerdict(bela.id(), MessageFeedbackEntity.KIND_CHAT_MESSAGE, UUID.randomUUID(),
                "down", MessageFeedbackEntity.REASON_BAD_TIMING);

        AdminUserFeedbackResponse annaBody =
                getForBody(uri(anna.id()), ownerAuthHeaders(), HttpStatus.OK, AdminUserFeedbackResponse.class);
        AdminUserFeedbackResponse belaBody =
                getForBody(uri(bela.id()), ownerAuthHeaders(), HttpStatus.OK, AdminUserFeedbackResponse.class);

        AdminUserFeedbackSurface annaChat = annaBody.getSurfaces().stream()
                .filter(s -> MessageFeedbackEntity.KIND_CHAT_MESSAGE.equals(s.getKind())).findFirst().orElseThrow();
        assertThat(annaChat.getUp()).isEqualTo(1);
        assertThat(annaChat.getDown()).isEqualTo(0);
        assertThat(annaChat.getReasons()).isEmpty();

        AdminUserFeedbackSurface belaChat = belaBody.getSurfaces().stream()
                .filter(s -> MessageFeedbackEntity.KIND_CHAT_MESSAGE.equals(s.getKind())).findFirst().orElseThrow();
        assertThat(belaChat.getUp()).isEqualTo(0);
        assertThat(belaChat.getDown()).isEqualTo(3);
        assertThat(belaChat.getReasons()).extracting(AdminFeatureDownReason::getReason, AdminFeatureDownReason::getCount)
                .containsExactly(Tuple.tuple(MessageFeedbackEntity.REASON_BAD_TIMING, 3));
    }

    @Test
    void testUserFeedback_shouldReturnThisUsersRecallTotalsOnly_whenRecallVotesExistForTwoUsers() {
        RegisteredUser anna = registerUser("Anna");
        RegisteredUser bela = registerUser("Bela");
        seedRecallVote(anna.id(), "useful");
        seedRecallVote(anna.id(), "useful");
        seedRecallVote(anna.id(), "irrelevant");
        seedRecallVote(bela.id(), "suppress");

        AdminUserFeedbackResponse body =
                getForBody(uri(anna.id()), ownerAuthHeaders(), HttpStatus.OK, AdminUserFeedbackResponse.class);

        assertThat(body.getRecall()).isEqualTo(
                new AdminFeedbackRecall().useful(2).irrelevant(1).suppress(0));
    }

    private void seedRecallVote(UUID owner, String action) {
        MemoryItemEntity item = memoryItemPopulator.item(owner, "journal_entry", UUID.randomUUID(),
                "friss", LocalDate.of(2026, 6, 3));
        MemoryRetrievalRunEntity run = memoryItemPopulator.run(owner, UUID.randomUUID());
        MemoryRetrievalResultEntity result = memoryItemPopulator.result(owner, run, item, 1, true,
                ScoreBreakdownEnvelope.empty());
        memoryItemPopulator.feedback(owner, run, result, item, action);
    }
}
