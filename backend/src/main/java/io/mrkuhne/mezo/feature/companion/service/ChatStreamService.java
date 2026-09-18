package io.mrkuhne.mezo.feature.companion.service;

import io.mrkuhne.mezo.api.dto.SendMessageRequest;
import io.mrkuhne.mezo.api.dto.StreamDelta;
import io.mrkuhne.mezo.api.dto.StreamError;
import io.mrkuhne.mezo.api.dto.StreamPhase;
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
import io.mrkuhne.mezo.techcore.security.LlmActorContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.codec.ServerSentEvent;
import org.springframework.stereotype.Service;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import reactor.core.publisher.Sinks;
import reactor.core.scheduler.Schedulers;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import java.util.function.Consumer;

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
 *
 * <p>mezo-rj214.7 S9.6 Task 3 — everything AFTER {@code prepareTurn}/sink setup (the pipeline
 * lap, the rawDeltas construction, the delta mapping, the trailing done-Mono) runs inside a
 * {@code Flux.defer(...).subscribeOn(Schedulers.boundedElastic())}. Before this restructure the
 * whole lap ran SYNCHRONOUSLY on the request thread before the Flux was even returned — Spring
 * MVC only starts writing the SSE response once it subscribes, so anything emitted into the
 * unicast sink during the lap was buffered and flushed only after the wait, narrating nothing.
 * Deferring the lap lets the HTTP response open immediately; the lap then runs on a boundedElastic
 * worker and its {@link TurnPhase} frames (see {@link #phaseEvent}) reach the client live.
 *
 * <p>fix round 1 finding M1: a client disconnect mid-lap does NOT interrupt the blocking lap
 * running on that boundedElastic worker — it runs to completion (and is billed) regardless, since
 * nothing in the pipeline/advisor/completeTurn chain polls for cancellation. This is strictly
 * better than the pre-restructure behaviour, where the identical lap ran pinned to the request
 * thread instead: a worker thread freed sooner beats a request thread held hostage for the same
 * uninterruptible work.
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
    /** mezo-rj214.7 S9.6 Task 3 — the wire name for a {@link TurnPhase} narration frame. */
    static final String EVENT_PHASE = "phase";
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
    private final ConversationTurnService conversationTurnService;
    private final io.mrkuhne.mezo.feature.companion.config.ConversationProperties conversationProperties;

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

        // mezo-2zyu: the adapter reads the holder EAGERLY (on the caller's thread, before the Flux
        // is returned) — see SpringAiCompanionLlm's "read HERE on the caller's thread" comments —
        // so the context must be BOUND on whatever thread actually makes that call. Task 3 moved
        // that call inside the deferred lap (below), so the context is re-bound there too.
        LlmCallContext streamContext =
                new LlmCallContext("companion_chat", "stream", "conversation", conversationId);
        // mezo-rj214.7 S9.6 Task 3: captured on the REQUEST thread, where SecurityContextHolder
        // still carries the JWT principal. The deferred lap below runs on a boundedElastic worker,
        // which propagates neither the security context nor this ThreadLocal — without re-binding
        // it there (LlmActorContext.runAsCaptured), llm_log_history.created_by would book against
        // nobody, the S9.4 regression class (see LlmActorContext's own javadoc).
        UUID actor = LlmActorContext.capture();
        // mezo-rj214.7: a CHAT turn is tool-free and smart-tier — the streamed twin of sendMessage's
        // completeSmart branch. No tool callbacks are registered, so the audit stays empty.
        Consumer<TurnPhase> onPhase = phase -> toolSink.tryEmitNext(phaseEvent(phase));

        // fix round 1 finding I1: preflight budget gate, EAGER on the request thread, before the
        // Flux is even built. LlmCallContextHolder#runWith throws the LLM_BUDGET_EXHAUSTED/
        // THROTTLED SystemRuntimeErrorException (429) BEFORE installing its own ThreadLocal
        // binding — so with the real runWith call living only inside Flux.defer (below), an
        // exhausted budget used to surface AFTER Spring MVC had already committed the 200 SSE
        // response, as a terminal 'error' frame instead of a normal HTTP 429. Asking the same
        // question here, synchronously, restores the 404-style contract
        // (testStreamMessage_shouldThrow404BeforeStreaming_whenConversationForeign's sibling): a
        // refusal now escapes as a plain 429 before any frame is written. The call is otherwise a
        // no-op — the body returns null and touches nothing — and the deferred runWith below still
        // asks again (harmless: same context, same actor, same thread-local save/restore dance) so
        // the ambient binding it needs for the actual LLM calls is unaffected.
        llmCallContextHolder.runWith(streamContext, () -> null);

        // mezo-rj214.7 S9.6 Task 3 — THE structural change: everything from here down used to run
        // synchronously on the request thread, BEFORE this method returned its Flux. Spring MVC
        // only starts writing the SSE response once it subscribes to that Flux, so anything pushed
        // into toolSink during the lap was buffered and flushed only after the wait — phase frames
        // emitted there would have narrated nothing. Deferring the lap (and re-subscribing on a
        // boundedElastic worker) lets the HTTP response open immediately; the lap then runs live,
        // and its phase/tool frames reach the client as they happen.
        Flux<ServerSentEvent<Object>> work = Flux.defer(() -> LlmActorContext.runAsCaptured(actor,
                () -> llmCallContextHolder.runWith(streamContext, () -> {
                    // Task 6 — PIPELINE (LOOKUP/ANALYSIS): plan+execute run HERE. The unicast
                    // toolSink and the audit.onCall listener are already registered above (on the
                    // request thread), so any tool call this lap makes is buffered in the sink and
                    // reaches the client ahead of the first delta — mezo-280's guarantee, now with
                    // an explicit PLANNING frame ahead of it too. LEGACY covers a CHAT turn (which
                    // never reaches this branch), the switch being off, and a planner that produced
                    // nothing usable — the byte-identical existing companionLlm.stream(...) call.
                    boolean pipelineAttempted =
                            !conversationProperties.enabled()
                                    && turn.gear() != TurnGear.CHAT && properties.turn().pipelineEnabled();
                    if (pipelineAttempted) {
                        toolSink.tryEmitNext(phaseEvent(TurnPhase.PLANNING));
                    }
                    PipelineResult pipe = pipelineAttempted
                            ? runPipelinePreStream(turn, userId, audit, onPhase)
                            : PipelineResult.legacy();

                    ConversationTurnService.Prepared conversational = conversationProperties.enabled()
                            ? conversationTurnService.prepare(userId, conversationId, turn.turnContext(),
                                    turn.history(), turn.userContent(), audit, onPhase) : null;
                    Flux<String> rawDeltas = conversational != null
                            ? companionLlm.streamSmart(turn.systemPrompt(), conversational.context(),
                                    turn.history(), turn.userContent())
                            : turn.gear() == TurnGear.CHAT
                            ? companionLlm.streamSmart(turn.systemPrompt(), turn.turnContext(),
                                    turn.history(), turn.userContent())
                            : switch (pipe.mode()) {
                                // LOOKUP: the answerer streams NATIVELY off the volatile half the
                                // pre-stream execution already built — no replan, LOOKUP never
                                // offers the marker at all. The seam (planAndExecuteVolatile) only
                                // narrates RETRIEVING; ANSWERING belongs here, right before the
                                // answering call it actually announces.
                                // fix round 1 finding M1: the nested runWith tags the actual
                                // answering call as "answer" — like pipelineAnswer's own
                                // turnAnswerer.answer call — instead of the generic "stream" tag;
                                // the outer streamContext (bound above) still covers every other
                                // branch.
                                case STREAM_ANSWER -> {
                                    toolSink.tryEmitNext(phaseEvent(TurnPhase.ANSWERING));
                                    yield llmCallContextHolder.runWith(
                                            new LlmCallContext("companion_chat", "answer", "conversation",
                                                    turn.conversationId()),
                                            () -> turnAnswerer.answerStream(turn.systemPrompt(), pipe.volatileHalf(),
                                                    turn.history(), turn.userContent()));
                                }
                                // ANALYSIS: the full sync lap (replan included) already ran, and its
                                // own RETRIEVING/ANSWERING frames (repeated on a replan) already
                                // narrated it via the onPhase seam — the client sees the resolved
                                // answer as ONE delta, not a second round-trip.
                                case SYNC_ANSWER -> Flux.just(pipe.syncAnswer());
                                case LEGACY -> companionLlm.stream(turn.systemPrompt(), turn.turnContext(),
                                        turn.history(), turn.userContent(),
                                        toolRegistry.callbacks(audit), toolRegistry.toolContext(userId, audit));
                            };
                    Flux<ServerSentEvent<Object>> deltasMapped = rawDeltas
                            .doOnNext(answer::append)
                            .map(chunk -> ServerSentEvent.<Object>builder(
                                    StreamDelta.builder().text(chunk).build()).event(EVENT_DELTA).build())
                            // fix round 1 finding I2: this doFinally is now ONLY the error/cancel
                            // backstop — a rawDeltas failure or a client disconnect terminates
                            // deltasMapped without ever reaching trailingDoneMono's concatWith, so
                            // the sink still needs closing on THAT path. On the happy path
                            // (deltasMapped completes normally), doFinally's callback races
                            // concatWith's own subscription to trailingDoneMono — Reactor does not
                            // guarantee doFinally runs before the downstream onComplete it reacts to
                            // is propagated — so it is NOT reliable for closing the sink before the
                            // trailing advisor review round runs. See the FIRST statement of
                            // trailingDoneMono's callable below for the deterministic close.
                            .doFinally(signal -> toolSink.tryEmitComplete());

                    Mono<ServerSentEvent<Object>> trailingDoneMono = Mono.fromCallable(() -> LlmActorContext.runAsCaptured(actor, () -> {
                        // final fix wave (mezo-rj214.7): the OUTER runAsCaptured (Flux.defer, above)
                        // only covers the SYNCHRONOUS assembly of this Flux graph — it unwinds via its
                        // own finally before Reactor ever actually subscribes to this Mono, so without
                        // re-binding the actor a second time HERE the advisor's corrective-retry LLM
                        // call runs with no actor bound at all: llm_log_history.created_by books
                        // against nobody instead of the request's user.
                        // fix round 1 finding I2: close the sink HERE, first, deterministically —
                        // not in deltasMapped's doFinally (see its comment above). This must run
                        // BEFORE the advisor review below, which — on a corrective retry — makes
                        // live tool calls through the SAME audit.onCall listener that feeds
                        // toolSink. Completing the sink first makes those retry emissions hit an
                        // already-terminated sink and drop, restoring the intended invariant: a
                        // corrective retry's tool calls surface ONLY in the terminal 'done' row,
                        // never as live frames (possibly emitted after the client already saw
                        // 'done'). tryEmitComplete is idempotent, so the doFinally above completing
                        // it a second time on this same path is harmless.
                        toolSink.tryEmitComplete();
                        // V1.3: post-hoc review — deltas already delivered attempt-1; the done row is
                        // authoritative (the FE swaps it in), so a corrective retry lands silently here.
                        String finalAnswer = answer.toString();
                        boolean degraded = conversational != null && conversational.degraded();
                        CompanionAdvisorChain chain = advisorChain.getIfAvailable();
                        // mezo-rj214.7 Task 6: a pipeline mode (LOOKUP/ANALYSIS) reviews clinical-only,
                        // exactly like CHAT — the same branch sendMessage's own pipelined arm takes
                        // (ChatService#sendMessage). Skipped here is the same LLM verdict pay-twice the
                        // CHAT comment below describes: pipelineAnswer's own answering call already
                        // graded the answer against the tool digest it was grounded in.
                        if (chain != null
                                && (turn.gear() == TurnGear.CHAT || pipe.mode() != PipelineResult.Mode.LEGACY)) {
                            // CHAT (and any non-LEGACY pipeline mode) already answered tool-free, so
                            // the retry stays tool-free too. The deterministic clinical + action-claim
                            // review still runs: the dose-change prohibition must have no branch
                            // where it does not apply (mezo-rj214.7).
                            AdvisedAnswer advised = chain.review(turn.systemPrompt(),
                                    conversational == null ? turn.turnContext() : conversational.context(),
                                    turn.history(), turn.userContent(), finalAnswer, null, null);
                            finalAnswer = advised.answer();
                            degraded = degraded || advised.degraded();
                        } else if (chain != null) {
                            AdvisedAnswer advised = chain.review(turn.systemPrompt(), turn.turnContext(),
                                    turn.history(), turn.userContent(), finalAnswer,
                                    toolRegistry.callbacks(audit),
                                    toolRegistry.toolContext(userId, audit));
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
                        // S9.7 Task 5: the streamed twin of sendMessage's own choke point — plan-truth
                        // outcomes (pipe.outcomes(), non-null only for STREAM_ANSWER/SYNC_ANSWER) when
                        // present, otherwise the legacy tool-loop's ran-truth audit list. Never mixes
                        // the two truths in one row (TurnProvenance's own contract).
                        List<ToolCallAudit.ToolOutcome> pipelineOutcomes = pipe.outcomes();
                        TurnProvenance.Built provenance = TurnProvenance.build(
                                pipelineOutcomes != null ? pipelineOutcomes : audit.toolOutcomes(),
                                conversationProperties);
                        return ServerSentEvent.<Object>builder(
                                        chatService.completeTurn(userId, conversationId, turn.userMessageId(),
                                                turn.userContent(), finalAnswer, audit, provenance.ask(),
                                                provenance.result(), degraded, turn.recalled()))
                                .event(EVENT_DONE).build();
                    }));

                    return deltasMapped.concatWith(trailingDoneMono);
                })))
                .subscribeOn(Schedulers.boundedElastic());

        return Flux.merge(toolSink.asFlux(), work)
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
     * @param onPhase mezo-rj214.7 S9.6 Task 3 — the real stream emitter (Task 2 left this null):
     *                forwarded verbatim to {@link ChatService#pipelineAnswer}/{@link
     *                ChatService#planAndExecuteVolatile}, which fire {@link TurnPhase#RETRIEVING}/
     *                {@link TurnPhase#ANSWERING} at their own seam points. {@link
     *                TurnPhase#PLANNING} is NOT fired here — the caller ({@link #streamMessage})
     *                emits it once, at pipeline-attempt start, before this method is even called.
     * @return {@link PipelineResult#legacy()} when the planner produced nothing usable, or when
     *         the pre-stream lap itself failed
     */
    private PipelineResult runPipelinePreStream(ChatService.PreparedTurn turn, UUID userId, ToolCallAudit audit,
            Consumer<TurnPhase> onPhase) {
        try {
            return runPipelinePreStreamUnguarded(turn, userId, audit, onPhase);
        } catch (RuntimeException e) {
            // spec §8's philosophy applies here too: an answer (via the legacy tool loop the
            // caller falls back to) beats an error.
            log.warn("Pre-stream pipeline lap failed for conversation {} — falling back to the legacy stream",
                    turn.conversationId(), e);
            return PipelineResult.legacy();
        }
    }

    private PipelineResult runPipelinePreStreamUnguarded(ChatService.PreparedTurn turn, UUID userId,
            ToolCallAudit audit, Consumer<TurnPhase> onPhase) {
        // fix round 1 finding M2: turn.today() is the SAME LocalDate.now() prepareTurn already
        // resolved for this turn's context assembly, not a second, independent call — a turn
        // straddling exact midnight between the two calls could otherwise see a one-day skew
        // between the plan's "Ma:" context and the persisted turn's assembled context.
        LocalDate today = turn.today();
        if (turn.gear() == TurnGear.ANALYSIS) {
            // S9.7 Task 4: pipelineAnswer now also returns the outcome list that produced the
            // answer (for the sync path's provenance persistence) — the streamed path threads the
            // outcome list through to persisted provenance on the row.
            ChatService.PipelineAnswer synced = chatService.pipelineAnswer(userId, turn.conversationId(),
                    turn.gear(), turn.systemPrompt(), turn.turnContext(), turn.history(), turn.userContent(),
                    today, audit, onPhase);
            return synced == null
                    ? PipelineResult.legacy()
                    : new PipelineResult(PipelineResult.Mode.SYNC_ANSWER, synced.answer(), null, synced.outcomes());
        }
        // fix round 1 finding I2: lap 1 — plan -> cap -> execute -> build the volatile half —
        // used to be a verbatim copy of ChatService#pipelineAnswer's own lap 1. It now lives ONCE,
        // in ChatService#planAndExecuteVolatile, which both call sites share. LOOKUP never
        // replans, so replanAllowed is always false here.
        var lap = chatService.planAndExecuteVolatile(userId, turn.conversationId(), turn.gear(),
                turn.turnContext(), turn.history(), turn.userContent(), today, audit, false, onPhase);
        return lap == null
                ? PipelineResult.legacy()
                : new PipelineResult(PipelineResult.Mode.STREAM_ANSWER, null, lap.volatileHalf(), lap.outcomes());
    }

    /**
     * What {@link #runPipelinePreStream} decided, for the {@code rawDeltas} switch and the
     * trailing Mono's review branch to read. {@code syncAnswer}/{@code volatileHalf} are mutually
     * exclusive with each other and with {@link Mode#LEGACY} — only the field the mode names is
     * ever non-null.
     *
     * <p>S9.7 Task 5: {@code outcomes} is the plan-truth list that produced the answer — {@code
     * synced.outcomes()} for {@link Mode#SYNC_ANSWER} (lap 1, or lap1+replan merged — the same
     * list {@link ChatService#pipelineAnswer} already threads out for the sync path), {@code
     * lap.outcomes()} for {@link Mode#STREAM_ANSWER}, and {@code null} for {@link Mode#LEGACY} —
     * the trailing done-Mono then falls back to {@code audit.toolOutcomes()} (ran-truth), exactly
     * mirroring {@code sendMessage}'s own {@code pipelineOutcomes != null ? pipelineOutcomes :
     * audit.toolOutcomes()} choice so the two paths cannot drift.
     */
    private record PipelineResult(Mode mode, String syncAnswer, String volatileHalf,
            List<ToolCallAudit.ToolOutcome> outcomes) {
        private enum Mode { LEGACY, STREAM_ANSWER, SYNC_ANSWER }

        private static PipelineResult legacy() {
            return new PipelineResult(Mode.LEGACY, null, null, null);
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

    /** mezo-rj214.7 S9.6 Task 3 — the twin of {@link #toolEvent}, wrapping the generated
     *  {@link StreamPhase} DTO around one {@link TurnPhase} narration marker. */
    private static ServerSentEvent<Object> phaseEvent(TurnPhase phase) {
        return ServerSentEvent.<Object>builder(
                StreamPhase.builder().phase(phase.wire()).build())
                .event(EVENT_PHASE).build();
    }
}
