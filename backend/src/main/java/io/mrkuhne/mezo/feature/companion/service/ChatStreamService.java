package io.mrkuhne.mezo.feature.companion.service;

import io.mrkuhne.mezo.api.dto.SendMessageRequest;
import io.mrkuhne.mezo.api.dto.StreamDelta;
import io.mrkuhne.mezo.api.dto.StreamError;
import io.mrkuhne.mezo.api.dto.StreamToolCall;
import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.companion.advisor.AdvisedAnswer;
import io.mrkuhne.mezo.feature.companion.advisor.CompanionAdvisorChain;
import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
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

import java.time.LocalDate;
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
    /** mezo-rj214.7 Task 6 — the LIVE pipeline, live on this streamed path too. Planning and
     *  execution (fix round 1 finding I2) now run entirely inside {@link ChatService} — via
     *  {@link ChatService#pipelineAnswer} for ANALYSIS and {@link
     *  ChatService#planAndExecuteVolatile} for LOOKUP — so this class no longer needs its own
     *  {@code TurnPlanner}/{@code PlanExecutor} references. */
    private final CompanionProperties properties;
    private final TurnAnswerer turnAnswerer;

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
        LlmCallContext streamContext =
                new LlmCallContext("companion_chat", "stream", "conversation", conversationId);
        // mezo-rj214.7: a CHAT turn is tool-free and smart-tier — the streamed twin of sendMessage's
        // completeSmart branch. No tool callbacks are registered, so the audit stays empty.

        // Task 6 — PIPELINE (LOOKUP/ANALYSIS): plan+execute run HERE, before the Flux assembles.
        // The unicast toolSink and the audit.onCall listener are already registered above, so any
        // tool call this pre-stream execution makes is buffered and reaches the client ahead of
        // the first delta (S9.6's phase events will narrate the gap explicitly; for now the
        // ordering itself is the guarantee — ChatStreamPipelineIT pins it). LEGACY covers a CHAT
        // turn (which never reaches this branch), the switch being off, and a planner that
        // produced nothing usable — the byte-identical existing companionLlm.stream(...) call.
        PipelineResult pipe = (turn.gear() != TurnGear.CHAT && properties.turn().pipelineEnabled())
                ? llmCallContextHolder.runWith(streamContext, () -> runPipelinePreStream(turn, userId, audit))
                : PipelineResult.legacy();

        Flux<String> rawDeltas = turn.gear() == TurnGear.CHAT
                ? llmCallContextHolder.runWith(streamContext,
                        () -> companionLlm.streamSmart(turn.systemPrompt(), turn.turnContext(),
                                turn.history(), turn.userContent()))
                : switch (pipe.mode()) {
                    // LOOKUP: the answerer streams NATIVELY off the volatile half the pre-stream
                    // execution already built — no replan, LOOKUP never offers the marker at all.
                    // fix round 1 finding M1: the nested runWith tags the actual answering call
                    // as "answer" — like pipelineAnswer's own turnAnswerer.answer call — instead
                    // of leaving it under the generic "stream" tag; the outer streamContext still
                    // covers everything else this branch does (and every OTHER branch keeps it).
                    case STREAM_ANSWER -> llmCallContextHolder.runWith(streamContext,
                            () -> llmCallContextHolder.runWith(
                                    new LlmCallContext("companion_chat", "answer", "conversation",
                                            turn.conversationId()),
                                    () -> turnAnswerer.answerStream(turn.systemPrompt(), pipe.volatileHalf(),
                                            turn.history(), turn.userContent())));
                    // ANALYSIS: the full sync lap (replan included) already ran pre-stream; the
                    // client sees the resolved answer as ONE delta, not a second round-trip.
                    case SYNC_ANSWER -> Flux.just(pipe.syncAnswer());
                    case LEGACY -> llmCallContextHolder.runWith(streamContext,
                            () -> companionLlm.stream(turn.systemPrompt(), turn.turnContext(), turn.history(),
                                    turn.userContent(),
                                    toolRegistry.callbacks(audit), toolRegistry.toolContext(userId, audit)));
                };
        Flux<ServerSentEvent<Object>> deltas = rawDeltas
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
                    // mezo-rj214.7 Task 6: a pipeline mode (LOOKUP/ANALYSIS) reviews clinical-only,
                    // exactly like CHAT — the same branch sendMessage's own pipelined arm takes
                    // (ChatService#sendMessage). Skipped here is the same LLM verdict pay-twice the
                    // CHAT comment below describes: pipelineAnswer's own answering call already
                    // graded the answer against the tool digest it was grounded in.
                    if (chain != null && (turn.gear() == TurnGear.CHAT || pipe.mode() != PipelineResult.Mode.LEGACY)) {
                        // CHAT skips the LLM verdict — that check grades an answer against the
                        // context and tool outcomes it was grounded in, and a CHAT turn has
                        // neither. The deterministic clinical check still runs: the dose-change
                        // prohibition must have no branch where it does not apply (mezo-rj214.7).
                        AdvisedAnswer advised = chain.reviewChat(turn.systemPrompt(),
                                turn.turnContext(), turn.history(), turn.userContent(), finalAnswer);
                        finalAnswer = advised.answer();
                        degraded = advised.degraded();
                    } else if (chain != null) {
                        AdvisedAnswer advised = chain.review(turn.systemPrompt(), turn.turnContext(),
                                turn.history(), turn.userContent(), finalAnswer,
                                toolRegistry.callbacks(audit),
                                toolRegistry.toolContext(userId, audit), audit);
                        finalAnswer = advised.answer();
                        degraded = advised.degraded();
                    }
                    // fix round 1 finding I1: pipelineAnswer's own guard already strips a stray
                    // DATA_GAP_MARKER from a SYNC_ANSWER's finalAnswer before it ever reaches this
                    // method (ChatService#pipelineAnswer returns guardAgainstMarker(answer) itself)
                    // — but a STREAM_ANSWER's deltas already streamed to the client BEFORE this
                    // Mono runs, so this second pass only protects the PERSISTED half of the
                    // corner: a spontaneous marker in a LOOKUP answer (buildVolatile never offers
                    // the [Adathiány] escape hatch to LOOKUP, so this would be pure model noise,
                    // not a legitimate reply) still must not become the row that re-enters history
                    // on the next turn. The STREAMED half of the corner is unrecoverable by
                    // design — there is no SSE mechanism to retract a delta already sent.
                    if (pipe.mode() != PipelineResult.Mode.LEGACY) {
                        finalAnswer = ChatService.guardAgainstMarker(finalAnswer);
                    }
                    // mezo-8z79: a blank final answer is a FAILED turn, not an empty message. Gemini
                    // can return a candidate with no text parts at all (thinking-only rounds that hit
                    // the output cap, an empty candidate), the deltas then carry nothing and the
                    // advisor happily passes "" — the 2026-08-23 incident. Persisting it produced a
                    // blank card AND an empty AssistantMessage in the next turn's history. A
                    // guardAgainstMarker null (above) collapses into this same handling.
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

    /**
     * The pre-stream LIVE pipeline lap (mezo-rj214.7 Task 6): decides, BEFORE the Flux is built,
     * whether this turn's gear earns a plan+execute round and — for ANALYSIS — resolves the whole
     * turn synchronously (replan lap included) so the client never sees a mid-stream round-trip.
     *
     * <p>ANALYSIS calls the FULL sync {@link ChatService#pipelineAnswer} verbatim: the server
     * resolves a data-gap replan itself, and a {@code null} result (planner failure) falls back
     * to {@link PipelineResult#legacy()} exactly like the sync path (spec §8).
     *
     * <p>LOOKUP runs the plan -> cap-to-budget -> execute -> build-the-volatile-half mechanics
     * through the package-private {@link ChatService#planAndExecuteVolatile} (fix round 1
     * finding I2) — the SAME method {@link ChatService#pipelineAnswer}'s own first lap calls, so
     * the two call sites cannot drift. LOOKUP never offers the {@link
     * TurnAnswerer#DATA_GAP_MARKER} escape hatch at all ({@link TurnAnswerer#buildVolatile}
     * appends the [Adathiány] offer only for ANALYSIS), so a LOOKUP answer cannot physically
     * contain it — the streamed deltas below need no marker gate; the
     * ANALYSIS branch above still runs {@code guardAgainstMarker} inside {@code pipelineAnswer}
     * (and the trailing Mono in {@link #streamMessage} runs it a second time for the STREAM_ANSWER
     * corner — fix round 1 finding I1).
     *
     * <p>fix round 1 finding I3: wrapped (below) in a try/catch so a planner/answerer provider
     * failure degrades to the legacy stream instead of surfacing as a plain exception BEFORE the
     * Flux even exists to carry an SSE 'error' event — {@link PlanExecutor} already turns a
     * per-step failure into an honest {@link ToolCallAudit.ToolOutcome} and never throws, so the
     * catch only needs to guard the planner's own call and, for ANALYSIS, the answering round
     * inside {@link ChatService#pipelineAnswer}.
     *
     * @return {@link PipelineResult#legacy()} when the planner produced nothing usable, or when
     *         the pre-stream lap itself failed
     */
    private PipelineResult runPipelinePreStream(ChatService.PreparedTurn turn, UUID userId, ToolCallAudit audit) {
        try {
            return runPipelinePreStreamUnguarded(turn, userId, audit);
        } catch (RuntimeException e) {
            // spec §8's philosophy applies here too: an answer (via the legacy tool loop the
            // caller falls back to) beats an error.
            log.warn("Pre-stream pipeline lap failed for conversation {} — falling back to the legacy stream",
                    turn.conversationId(), e);
            return PipelineResult.legacy();
        }
    }

    private PipelineResult runPipelinePreStreamUnguarded(ChatService.PreparedTurn turn, UUID userId, ToolCallAudit audit) {
        // fix round 1 finding M2: turn.today() is the SAME LocalDate.now() prepareTurn already
        // resolved for this turn's context assembly, not a second, independent call — a turn
        // straddling exact midnight between the two calls could otherwise see a one-day skew
        // between the plan's "Ma:" context and the persisted turn's assembled context.
        LocalDate today = turn.today();
        if (turn.gear() == TurnGear.ANALYSIS) {
            String synced = chatService.pipelineAnswer(userId, turn.conversationId(), turn.gear(),
                    turn.systemPrompt(), turn.turnContext(), turn.history(), turn.userContent(), today, audit);
            return synced == null
                    ? PipelineResult.legacy()
                    : new PipelineResult(PipelineResult.Mode.SYNC_ANSWER, synced, null);
        }
        // fix round 1 finding I2: lap 1 — plan -> cap -> execute -> build the volatile half —
        // used to be a verbatim copy of ChatService#pipelineAnswer's own lap 1. It now lives ONCE,
        // in ChatService#planAndExecuteVolatile, which both call sites share. LOOKUP never
        // replans, so replanAllowed is always false here.
        var lap = chatService.planAndExecuteVolatile(userId, turn.conversationId(), turn.gear(),
                turn.turnContext(), turn.history(), turn.userContent(), today, audit, false);
        return lap == null
                ? PipelineResult.legacy()
                : new PipelineResult(PipelineResult.Mode.STREAM_ANSWER, null, lap.volatileHalf());
    }

    /**
     * What {@link #runPipelinePreStream} decided, for the {@code rawDeltas} switch and the
     * trailing Mono's review branch to read. {@code syncAnswer}/{@code volatileHalf} are mutually
     * exclusive with each other and with {@link Mode#LEGACY} — only the field the mode names is
     * ever non-null.
     */
    private record PipelineResult(Mode mode, String syncAnswer, String volatileHalf) {
        private enum Mode { LEGACY, STREAM_ANSWER, SYNC_ANSWER }

        private static PipelineResult legacy() {
            return new PipelineResult(Mode.LEGACY, null, null);
        }
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
