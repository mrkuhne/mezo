package io.mrkuhne.mezo.feature.companion;

import io.mrkuhne.mezo.api.dto.MessageResponse;
import io.mrkuhne.mezo.api.dto.SendMessageRequest;
import io.mrkuhne.mezo.api.dto.StreamDelta;
import io.mrkuhne.mezo.feature.companion.advisor.AdvisorRetry;
import io.mrkuhne.mezo.feature.companion.entity.AiConversationEntity;
import io.mrkuhne.mezo.feature.companion.llm.FakeCompanionLlm;
import io.mrkuhne.mezo.feature.companion.repository.AiMessageRepository;
import io.mrkuhne.mezo.feature.companion.service.ChatStreamService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.AiConversationPopulator;
import io.mrkuhne.mezo.techcore.security.LlmActorContext;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.codec.ServerSentEvent;
import org.springframework.test.context.ActiveProfiles;

import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * V1.3 on the streamed path: deltas carry attempt-1 unchecked, the review runs before 'done',
 * and the done row is authoritative — a corrective retry replaces the streamed text silently.
 * NOT @Transactional (two-transaction turn, like ChatStreamServiceIT).
 */
@ActiveProfiles("companion-fake")
class ChatStreamAdvisorIT extends AbstractIntegrationTest {

    @Autowired private ChatStreamService chatStreamService;
    @Autowired private AiMessageRepository messageRepository;
    @Autowired private AiConversationPopulator conversationPopulator;
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private FakeCompanionLlm fakeCompanionLlm;

    // gear-audited: forwards whatever its callers pass; every call site below is the audited one.
    private SendMessageRequest request(String content) {
        return SendMessageRequest.builder().content(content).build();
    }

    private String joinDeltas(List<ServerSentEvent<Object>> events) {
        return events.stream()
                .filter(e -> "delta".equals(e.event()))
                .map(e -> ((StreamDelta) e.data()).getText())
                .collect(Collectors.joining());
    }

    private MessageResponse doneOf(List<ServerSentEvent<Object>> events) {
        ServerSentEvent<Object> done = events.getLast();
        assertThat(done.event()).isEqualTo("done");
        return (MessageResponse) done.data();
    }

    @Test
    void testStreamMessage_shouldCarryRetriedAnswerInDone_whenFirstAnswerViolates() {
        UUID userId = databasePopulator.populateUser("stream-advisor-retry@test.local");
        AiConversationEntity conversation = conversationPopulator.conversation(userId);

        // mezo-rj214.7 final fix wave: streamMessage is called directly here (no HTTP layer, no
        // JWT), so LlmActorContext.runAs stands in for the request principal — the ONE thing
        // ChatStreamService's eager LlmActorContext.capture() (on the calling thread, before the
        // Flux is even built) has to read. Without it "the actor propagated correctly" and "there
        // never was an actor to propagate" would look identical below.
        AtomicReference<List<ServerSentEvent<Object>>> seen = new AtomicReference<>();
        LlmActorContext.runAs(userId, () -> seen.set(chatStreamService
                .streamMessage(userId, conversation.getId(),
                        request("aludtam jól, kérdés " + FakeCompanionLlm.VIOLATE_ONCE))
                .collectList().block()));
        List<ServerSentEvent<Object>> events = seen.get();

        // attempt-1 streamed as-is: no retry marker in the deltas
        assertThat(joinDeltas(events)).doesNotContain(AdvisorRetry.RETRY_MARKER);
        MessageResponse done = doneOf(events);
        // done = the retried answer (echo carries the corrective block), clean
        assertThat(done.getContent()).contains(AdvisorRetry.RETRY_MARKER);
        assertThat(done.getDegraded()).isFalse();

        // mezo-rj214.7 final fix wave: the regression this pins — ChatStreamService's
        // Flux.defer(...) wraps ONLY the deferred lap's SYNCHRONOUS assembly in
        // LlmActorContext.runAsCaptured(actor, ...); it unwinds via its own finally before Reactor
        // ever actually subscribes to trailingDoneMono, so by the time the advisor's corrective
        // retry runs — on the boundedElastic worker, well after assembly — the actor binding was
        // already gone. LlmActorResolver (and so llm_log_history.created_by) reads exactly this
        // same LlmActorContext.capture() call to attribute an LLM call; companion-fake never writes
        // that row (see FakeCompanionLlm's "Call counter" javadoc), so this asserts the identical
        // resolution one level up, at its source, via the advisor's own verdict-check call.
        assertThat(fakeCompanionLlm.lastVerdictCheckActor()).isEqualTo(userId);
    }

    @Test
    void testStreamMessage_shouldFlagDoneDegraded_whenRetryStillViolates() {
        UUID userId = databasePopulator.populateUser("stream-advisor-degraded@test.local");
        AiConversationEntity conversation = conversationPopulator.conversation(userId);

        List<ServerSentEvent<Object>> events = chatStreamService
                .streamMessage(userId, conversation.getId(),
                        request("aludtam jól, kérdés " + FakeCompanionLlm.VIOLATE_ALWAYS))
                .collectList().block();

        MessageResponse done = doneOf(events);
        assertThat(done.getDegraded()).isTrue();
        assertThat(messageRepository.findById(done.getId()).orElseThrow().isDegraded()).isTrue();
    }

    @Test
    void testStreamMessage_shouldFlagDoneDegraded_whenAChatTurnSuggestsADoseChange() {
        UUID userId = databasePopulator.populateUser("stream-chat-clinical@test.local");
        AiConversationEntity conversation = conversationPopulator.conversation(userId);

        // gear-audited: CHAT on purpose — the streamed twin of the sync clinical-on-CHAT case.
        List<ServerSentEvent<Object>> events = chatStreamService
                .streamMessage(userId, conversation.getId(),
                        request("Szerinted emeljük a retatrutidot?"))
                .collectList().block();

        // the deltas prove the tool-free branch streamed; the done row carries the verdict
        assertThat(joinDeltas(events)).contains(FakeCompanionLlm.CHAT_GEAR_SENTINEL);
        MessageResponse done = doneOf(events);
        assertThat(done.getDegraded()).isTrue();
        assertThat(messageRepository.findById(done.getId()).orElseThrow().isDegraded()).isTrue();
    }
}
