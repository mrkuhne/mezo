package io.mrkuhne.mezo.feature.proactive;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.AdviceApplyRequest;
import io.mrkuhne.mezo.api.dto.FeedMessageResponse;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.proactive.entity.AdviceActionKey;
import io.mrkuhne.mezo.feature.proactive.entity.CompanionMessageEntity;
import io.mrkuhne.mezo.feature.proactive.entity.CompanionMessageEnvelope;
import io.mrkuhne.mezo.feature.proactive.repository.CompanionMessageRepository;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.CompanionMessagePopulator;
import io.mrkuhne.mezo.support.populator.SleepGoalPopulator;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.ActiveProfiles;
import tools.jackson.databind.JsonNode;

/**
 * HTTP-level apply flow (S5, bd mezo-d58h.5, task 6): {@code POST
 * /api/proactive/advice/{id}/apply}. Everything behind the endpoint (lock ordering, idempotence,
 * dispatch) is exercised by {@link AdviceApplyServiceIT} — this class drives the HTTP surface
 * itself: status codes, the mapped {@link FeedMessageResponse} body, and that the SystemMessage
 * error codes this slice introduced resolve to real human-readable text rather than a bare code
 * (the messages.properties entries this task owns).
 */
@ActiveProfiles("companion-fake")
class ProactiveApiAdviceApplyIT extends ApiIntegrationTest {

    @Autowired private CompanionMessagePopulator companionMessagePopulator;
    @Autowired private CompanionMessageRepository companionMessageRepository;
    @Autowired private SleepGoalPopulator sleepGoalPopulator;
    @Autowired private AppUserRepository appUserRepository;
    @Autowired private OwnerProperties ownerProperties;

    private UUID ownerId() {
        return appUserRepository.findByEmail(ownerProperties.ownerEmail()).orElseThrow().getId();
    }

    private CompanionMessageEntity seedShiftSleepAnchorCard(UUID owner) {
        return companionMessagePopulator.createAdviceWithActions(
                owner, LocalDate.now(), "sleep_debt", null, "Mezo · javaslat",
                "Sablon-szöveg.", List.of("tény"), List.of("javaslat"),
                List.of(new CompanionMessageEnvelope.Action(
                        AdviceActionKey.SHIFT_SLEEP_ANCHOR, "Tolja el", Map.of("minutes", -30))),
                null, Instant.now());
    }

    @Test
    void testApply_shouldStampAppliedAndReturnTheCard_whenTheActionIsOffered() {
        sleepGoalPopulator.goal(ownerId(), 480, "WAKE", "06:45", 15);
        CompanionMessageEntity card = seedShiftSleepAnchorCard(ownerId());

        FeedMessageResponse response = postForBody(
                "/api/proactive/advice/" + card.getId() + "/apply",
                new AdviceApplyRequest().actionKey(AdviceApplyRequest.ActionKeyEnum.SHIFT_SLEEP_ANCHOR),
                ownerAuthHeaders(), HttpStatus.OK, FeedMessageResponse.class);

        assertThat(response.getId()).isEqualTo(card.getId());
        assertThat(response.getApplied()).isNotNull();
        assertThat(response.getApplied().getActionKey()).isEqualTo(AdviceActionKey.SHIFT_SLEEP_ANCHOR);
        assertThat(response.getApplied().getAt()).isNotNull();
    }

    @Test
    void testApply_shouldBeIdempotent_whenTheSameActionIsAppliedTwice() {
        sleepGoalPopulator.goal(ownerId(), 480, "WAKE", "06:45", 15);
        CompanionMessageEntity card = seedShiftSleepAnchorCard(ownerId());
        AdviceApplyRequest request =
                new AdviceApplyRequest().actionKey(AdviceApplyRequest.ActionKeyEnum.SHIFT_SLEEP_ANCHOR);

        FeedMessageResponse first = postForBody(
                "/api/proactive/advice/" + card.getId() + "/apply", request, ownerAuthHeaders(),
                HttpStatus.OK, FeedMessageResponse.class);
        FeedMessageResponse second = postForBody(
                "/api/proactive/advice/" + card.getId() + "/apply", request, ownerAuthHeaders(),
                HttpStatus.OK, FeedMessageResponse.class);

        assertThat(second.getApplied().getAt()).isEqualTo(first.getApplied().getAt());
    }

    @Test
    void testApply_shouldReturn409WithAReadableMessage_whenTheActionIsNotOfferedByTheCard() {
        CompanionMessageEntity card = seedShiftSleepAnchorCard(ownerId());

        String body = postForBody(
                "/api/proactive/advice/" + card.getId() + "/apply",
                new AdviceApplyRequest().actionKey(AdviceApplyRequest.ActionKeyEnum.LIGHTEN_TOMORROW),
                ownerAuthHeaders(), HttpStatus.CONFLICT, String.class);

        assertHasRequestError(body, "PROACTIVE_ADVICE_ACTION_NOT_OFFERED");
        assertMessageIsHumanReadable(body, "PROACTIVE_ADVICE_ACTION_NOT_OFFERED");
    }

    @Test
    void testApply_shouldReturn404_whenTheCardBelongsToAnotherUser() {
        CompanionMessageEntity card = seedShiftSleepAnchorCard(ownerId());
        RegisteredUser stranger = registerUser("Stranger");

        String body = postForBody(
                "/api/proactive/advice/" + card.getId() + "/apply",
                new AdviceApplyRequest().actionKey(AdviceApplyRequest.ActionKeyEnum.SHIFT_SLEEP_ANCHOR),
                stranger.headers(), HttpStatus.NOT_FOUND, String.class);

        assertHasRequestError(body, "PROACTIVE_ADVICE_NOT_FOUND");
    }

    @Test
    void testApply_shouldReturn404_whenTheCardWasSuperseded() {
        CompanionMessageEntity card = seedShiftSleepAnchorCard(ownerId());
        UUID cardId = card.getId();
        companionMessageRepository.delete(card);
        companionMessageRepository.flush();

        postForBody(
                "/api/proactive/advice/" + cardId + "/apply",
                new AdviceApplyRequest().actionKey(AdviceApplyRequest.ActionKeyEnum.SHIFT_SLEEP_ANCHOR),
                ownerAuthHeaders(), HttpStatus.NOT_FOUND, String.class);
    }

    /** Asserts the error body's {@code message} field is real prose, not the bare code — proof
     *  the messages.properties entry this task owns actually resolves via
     *  {@code GlobalExceptionHandler.resolve}, which falls back to the CODE ITSELF as the default
     *  message when no properties entry exists. */
    private void assertMessageIsHumanReadable(String responseBody, String code) {
        JsonNode messages;
        try {
            messages = objectMapper.readTree(responseBody);
        } catch (Exception e) {
            throw new IllegalStateException("Error body is not valid JSON: " + responseBody, e);
        }
        for (JsonNode m : messages) {
            if (code.equals(m.path("code").asString())) {
                String message = m.path("message").asString();
                assertThat(message)
                        .withFailMessage("expected a resolved human-readable message for %s, got the bare code: %s",
                                code, responseBody)
                        .isNotEqualTo(code);
                return;
            }
        }
        throw new AssertionError("no message with code " + code + " found in body: " + responseBody);
    }
}
