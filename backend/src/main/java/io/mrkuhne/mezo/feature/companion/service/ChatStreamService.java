package io.mrkuhne.mezo.feature.companion.service;

import io.mrkuhne.mezo.api.dto.SendMessageRequest;
import io.mrkuhne.mezo.api.dto.StreamDelta;
import io.mrkuhne.mezo.api.dto.StreamError;
import io.mrkuhne.mezo.api.dto.StreamToolCall;
import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.companion.advisor.AdvisedAnswer;
import io.mrkuhne.mezo.feature.companion.advisor.CompanionAdvisorChain;
import io.mrkuhne.mezo.feature.companion.entity.ToolCallsEnvelope;
import io.mrkuhne.mezo.feature.companion.tools.CompanionToolRegistry;
import io.mrkuhne.mezo.feature.companion.tools.ToolCallAudit;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContext;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContextHolder;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.codec.ServerSentEvent;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import reactor.core.publisher.Sinks;

import java.util.UUID;

/**
 * The streamed chat turn (V0.4). Orchestrates the two transactional halves of ChatService
 * around the non-transactional LLM stream: prepareTurn (persist user row) → CompanionLlm.stream
 * (each chunk re-emitted as an SSE 'delta', each executed tool call re-emitted live as an SSE
 * 'tool' — mezo-280) → completeTurn (persist assistant row) as the terminal 'done'. A mid-stream
 * failure becomes a terminal 'error' event and the assistant row is NOT persisted — partial
 * answers never enter the history.
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
    static final String EVENT_TOOL = "tool";
    static final String STREAM_FAILED_CODE = "COMPANION_STREAM_FAILED";
    /** mezo-8z79 — the round technically succeeded and produced no text; the turn is dropped. */
    static final String EMPTY_ANSWER_CODE = "COMPANION_EMPTY_ANSWER";

    private final ChatService chatService;
    private final CompanionLlm companionLlm;
    /** V1.3 — present only when the advisors switch is on (bean-boundary gating). */
    private final ObjectProvider<CompanionAdvisorChain> advisorChain;
    private final CompanionToolRegistry toolRegistry;
    private final LlmCallContextHolder llmCallContextHolder;

    public Flux<ServerSentEvent<Object>> streamMessage(
            UUID userId, UUID conversationId, SendMessageRequest request) {
        // Eager (pre-Flux) so 404/validation problems are normal HTTP errors, not SSE frames.
        ChatService.PreparedTurn turn = chatService.prepareTurn(userId, conversationId, request);
        // V0.5: per-turn audit — tool calls executed during the stream land in the done row
        ToolCallAudit audit = toolRegistry.newTurnAudit();

        StringBuilder answer = new StringBuilder();
        // mezo-280: live tool progress. The audit is the one choke point every tool passes through
        // (RecordingToolCallback), so one listener turns each executed call into an SSE frame the
        // moment it runs — instead of every chip appearing at once in the terminal 'done' row.
        // unicast().onBackpressureBuffer() BUFFERS pre-subscription emissions, which matters: some
        // CompanionLlm implementations run the tool loop while the Flux is being assembled.
        Sinks.Many<ServerSentEvent<Object>> toolSink = Sinks.many().unicast().onBackpressureBuffer();
        // Registered BEFORE companionLlm.stream(...) is called for exactly that reason.
        audit.onCall(call -> toolSink.tryEmitNext(toolEvent(call)));

        // mezo-2zyu: the adapter reads the holder EAGERLY (before the Flux is returned), so tagging
        // the stream() call itself is enough — the deferred pipeline carries the closed-over context.
        Flux<ServerSentEvent<Object>> deltas = llmCallContextHolder.runWith(
                        new LlmCallContext("companion_chat", "stream", "conversation", conversationId),
                        () -> companionLlm.stream(turn.systemPrompt(), turn.history(), turn.userContent(),
                                toolRegistry.callbacks(audit), toolRegistry.toolContext(userId, audit)))
                .doOnNext(answer::append)
                .map(chunk -> ServerSentEvent.<Object>builder(
                        StreamDelta.builder().text(chunk).build()).event(EVENT_DELTA).build())
                // Completing the sink with the deltas ends the merge. Any LATER call (an advisor
                // corrective round) emits into a terminated sink and is dropped — deliberately:
                // those calls still reach the client in the authoritative 'done' row.
                .doFinally(signal -> toolSink.tryEmitComplete());

        return Flux.merge(toolSink.asFlux(), deltas)
                .concatWith(Mono.fromCallable(() -> {
                    // V1.3: post-hoc review — deltas already delivered attempt-1; the done row is
                    // authoritative (the FE swaps it in), so a corrective retry lands silently here.
                    String finalAnswer = answer.toString();
                    boolean degraded = false;
                    CompanionAdvisorChain chain = advisorChain.getIfAvailable();
                    if (chain != null) {
                        AdvisedAnswer advised = chain.review(turn.systemPrompt(), turn.history(),
                                turn.userContent(), finalAnswer, toolRegistry.callbacks(audit),
                                toolRegistry.toolContext(userId, audit), audit);
                        finalAnswer = advised.answer();
                        degraded = advised.degraded();
                    }
                    // mezo-8z79: a blank final answer is a FAILED turn, not an empty message. Gemini
                    // can return a candidate with no text parts at all (thinking-only rounds that hit
                    // the output cap, an empty candidate), the deltas then carry nothing and the
                    // advisor happily passes "" — the 2026-08-23 incident. Persisting it produced a
                    // blank card AND an empty AssistantMessage in the next turn's history.
                    if (finalAnswer == null || finalAnswer.isBlank()) {
                        throw new SystemRuntimeErrorException(SystemMessage.error(EMPTY_ANSWER_CODE).build());
                    }
                    // W3.1: ambient Memory refs after the tool loop + review — tool refs keep cap priority
                    turn.recalledRefs().forEach(ref -> audit.addRef(ref.kind(), ref.id(), ref.label()));
                    return ServerSentEvent.<Object>builder(
                                    chatService.completeTurn(userId, conversationId, turn.userMessageId(),
                                            turn.userContent(), finalAnswer, audit, degraded, turn.recalled()))
                            .event(EVENT_DONE).build();
                }))
                .onErrorResume(e -> {
                    // An empty answer is a known, expected provider outcome — logged as its own
                    // one-liner rather than a stack trace, so it stays greppable and countable.
                    if (isEmptyAnswer(e)) {
                        log.warn("Companion answered with NO text for conversation {} — turn dropped",
                                conversationId);
                        return Mono.just(errorEvent(EMPTY_ANSWER_CODE));
                    }
                    log.warn("Companion stream failed for conversation {}", conversationId, e);
                    return Mono.just(errorEvent(STREAM_FAILED_CODE));
                });
    }

    private static boolean isEmptyAnswer(Throwable failure) {
        return failure instanceof SystemRuntimeErrorException system
                && system.getMessages().stream().anyMatch(m -> m != null && EMPTY_ANSWER_CODE.equals(m.getCode()));
    }

    private static ServerSentEvent<Object> errorEvent(String code) {
        return ServerSentEvent.<Object>builder(StreamError.builder().code(code).build())
                .event(EVENT_ERROR).build();
    }

    /** The live twin of {@code CompanionMapper.toTools}: same pre-baked "name(args)" chip label. */
    private static ServerSentEvent<Object> toolEvent(ToolCallsEnvelope.ToolCall call) {
        String label = call.args() == null || call.args().isBlank()
                ? call.name() : call.name() + "(" + call.args() + ")";
        return ServerSentEvent.<Object>builder(
                StreamToolCall.builder().type(call.type()).name(label).build())
                .event(EVENT_TOOL).build();
    }
}
