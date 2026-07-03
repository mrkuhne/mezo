package io.mrkuhne.mezo.feature.companion.service;

import io.mrkuhne.mezo.api.dto.SendMessageRequest;
import io.mrkuhne.mezo.api.dto.StreamDelta;
import io.mrkuhne.mezo.api.dto.StreamError;
import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.companion.tools.CompanionToolRegistry;
import io.mrkuhne.mezo.feature.companion.tools.ToolCallAudit;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.codec.ServerSentEvent;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;

import java.util.UUID;

/**
 * The streamed chat turn (V0.4). Orchestrates the two transactional halves of ChatService
 * around the non-transactional LLM stream: prepareTurn (persist user row) → CompanionLlm.stream
 * (each chunk re-emitted as an SSE 'delta') → completeTurn (persist assistant row) as the
 * terminal 'done'. A mid-stream failure becomes a terminal 'error' event and the assistant
 * row is NOT persisted — partial answers never enter the history.
 *
 * <p>Ownership/validation failures inside prepareTurn throw BEFORE the Flux is returned, so
 * they surface as regular JSON error responses (the FE sends "Accept: text/event-stream,
 * application/json" accordingly).
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class ChatStreamService {

    static final String EVENT_DELTA = "delta";
    static final String EVENT_DONE = "done";
    static final String EVENT_ERROR = "error";
    static final String STREAM_FAILED_CODE = "COMPANION_STREAM_FAILED";

    private final ChatService chatService;
    private final CompanionLlm companionLlm;
    private final CompanionToolRegistry toolRegistry;

    public Flux<ServerSentEvent<Object>> streamMessage(
            UUID userId, UUID conversationId, SendMessageRequest request) {
        // Eager (pre-Flux) so 404/validation problems are normal HTTP errors, not SSE frames.
        ChatService.PreparedTurn turn = chatService.prepareTurn(userId, conversationId, request);
        // V0.5: per-turn audit — tool calls executed during the stream land in the done row
        ToolCallAudit audit = toolRegistry.newTurnAudit();

        StringBuilder answer = new StringBuilder();
        return companionLlm.stream(turn.systemPrompt(), turn.userContent(),
                        toolRegistry.callbacks(audit), toolRegistry.toolContext(userId, audit))
                .doOnNext(answer::append)
                .map(chunk -> ServerSentEvent.<Object>builder(
                        StreamDelta.builder().text(chunk).build()).event(EVENT_DELTA).build())
                .concatWith(Mono.fromCallable(() -> ServerSentEvent.<Object>builder(
                                chatService.completeTurn(userId, conversationId, answer.toString(), audit))
                        .event(EVENT_DONE).build()))
                .onErrorResume(e -> {
                    log.warn("Companion stream failed for conversation {}", conversationId, e);
                    return Mono.just(ServerSentEvent.<Object>builder(
                                    StreamError.builder().code(STREAM_FAILED_CODE).build())
                            .event(EVENT_ERROR).build());
                });
    }
}
