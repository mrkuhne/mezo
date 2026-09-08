package io.mrkuhne.mezo.feature.companion.memory.service;

import io.mrkuhne.mezo.feature.companion.entity.RefsEnvelope;
import io.mrkuhne.mezo.feature.companion.memory.config.MemoryPlatformProperties;
import io.mrkuhne.mezo.feature.companion.memory.dto.MemoryCandidate;
import io.mrkuhne.mezo.feature.companion.memory.dto.MemoryContext;
import io.mrkuhne.mezo.feature.companion.memory.dto.MemoryContextItem;
import io.mrkuhne.mezo.feature.companion.memory.dto.MemoryRequest;
import io.mrkuhne.mezo.feature.companion.memory.dto.PreparedMemoryQuery;
import io.mrkuhne.mezo.feature.companion.memory.dto.QueryMode;
import io.mrkuhne.mezo.feature.companion.memory.dto.RetrievalInput;
import io.mrkuhne.mezo.feature.companion.memory.dto.RetrievalServingMode;
import io.mrkuhne.mezo.feature.companion.memory.service.MemoryCandidateFusion.FusedCandidate;
import io.mrkuhne.mezo.feature.companion.memory.service.MemoryRetrievalAuditWriter.AuditCommand;
import io.mrkuhne.mezo.feature.companion.memory.service.MemoryRetrievalAuditWriter.AuditResult;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContext;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContextHolder;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import io.mrkuhne.mezo.techcore.security.LlmActorContext;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CancellationException;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.function.Supplier;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.task.AsyncTaskExecutor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

/** Coordinates query preparation, isolated retrievers, fusion, selection, rendering and audit. */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class MemoryContextService {

    private static final String ALL_RETRIEVERS_FAILED = "MEMORY_RETRIEVAL_ALL_FAILED";

    /**
     * How ONE retrieval should behave (mezo-4qyt). The four pre-existing entry points pass
     * {@link #audited}; only the admin explorer's dry run passes anything else.
     *
     * @param audit      false ⇒ {@link MemoryRetrievalAuditWriter} is skipped and NO
     *                   {@code memory_retrieval_*} row is written. Deliberately a skip rather than
     *                   a new {@code serving_mode}/{@code consumer_policy} value: both columns carry
     *                   CHECK constraints, and a dry run has no business widening them (D1).
     * @param servingMode the mode the audit row would record; a dry run passes NEW explicitly.
     * @param reranker   ALLOW the LLM reranker. False short-circuits {@code shouldRerank}; true
     *                   restores production behaviour — it does not FORCE a rerank.
     * @param rewrite    ALLOW the LLM query rewrite (same allowance semantics).
     */
    public record RetrieveOptions(
            boolean audit, RetrievalServingMode servingMode, boolean reranker, boolean rewrite) {

        public static RetrieveOptions audited(RetrievalServingMode servingMode) {
            return new RetrieveOptions(true, servingMode, true, true);
        }
    }

    /**
     * Everything one retrieval produced, including what {@link MemoryContext} does not carry
     * (mezo-4qyt): the full ranked candidate list with its score breakdowns, the retriever trace
     * and the prepared query. The explorer's run detail and its dry run are the same rendering of
     * this record — one read for a stored run, one live for a replay.
     */
    public record RetrievalOutcome(
            MemoryContext context,
            PreparedMemoryQuery query,
            List<FusedCandidate> ranked,
            Set<MemoryRetrievalAuditWriter.CandidateIdentity> selected,
            Map<String, Object> retrieverTrace,
            String errorCode,
            long durationMs,
            boolean reranked,
            UUID runId) {
    }

    private final MemoryQueryPreparer queryPreparer;
    private final Map<String, MemoryRetriever> retrievers;
    private final MemoryCandidateFusion fusion;
    private final MemoryContextSelector selector;
    private final MemoryContextRenderer renderer;
    private final MemoryReranker reranker;
    private final MemoryRetrievalAuditWriter auditWriter;
    private final MemoryPlatformProperties properties;
    private final LlmCallContextHolder llmCallContextHolder;
    private final AsyncTaskExecutor applicationTaskExecutor;

    public MemoryContext retrieve(MemoryRequest request) {
        return retrieve(request, RetrievalServingMode.NEW);
    }

    public MemoryContext retrieve(MemoryRequest request, RetrievalServingMode servingMode) {
        return execute(request, RetrieveOptions.audited(servingMode), false).context();
    }

    /** NEW chat serving variant: an audited total retriever outage signals the legacy fallback. */
    public MemoryContext retrieveForServing(MemoryRequest request) {
        return execute(request, RetrieveOptions.audited(RetrievalServingMode.NEW), true).context();
    }

    /** mezo-4qyt: the full-trace variant every other entry point now delegates to. */
    public RetrievalOutcome retrieveDetailed(MemoryRequest request, RetrieveOptions options) {
        return execute(request, options, false);
    }

    private RetrievalOutcome execute(
            MemoryRequest request, RetrieveOptions options, boolean fallbackOnTotalFailure) {
        RetrievalServingMode servingMode = options.servingMode();
        long started = System.nanoTime();
        PreparedMemoryQuery query = queryPreparer.prepare(request, options.rewrite());
        if (query.mode() == QueryMode.NO_MEMORY_NEEDED) {
            AuditResult audit = writeAudit(options, new AuditCommand(
                    request, query, properties.servingEmbeddingVersion(), null, servingMode,
                    elapsedMillis(started), Map.of(), null, List.of(), List.of(), false));
            MemoryContext empty =
                    new MemoryContext(List.of(), "", List.of(), audit.runId(), audit.traceId());
            return new RetrievalOutcome(empty, query, List.of(), Set.of(), Map.of(), null,
                    elapsedMillis(started), false, audit.runId());
        }

        RetrievalBatch batch = retrieveCandidates(request, query);
        List<FusedCandidate> ranked = fusion.fuse(batch.candidates(), query, request.asOf());
        int tokenBudget = boundedTokenBudget(request);
        List<FusedCandidate> selected = selector.select(ranked, tokenBudget, request.asOf());
        boolean reranked = options.reranker()
                && reranker.shouldRerank(request, batch.candidates(), selected);
        if (reranked) {
            ranked = reranker.rerank(ranked);
            selected = selector.select(ranked, tokenBudget, request.asOf());
        }

        boolean totalFailure = batch.successCount() == 0 && !retrievers.isEmpty();
        String errorCode = totalFailure
                ? ALL_RETRIEVERS_FAILED + (fallbackOnTotalFailure ? "_FALLBACK_OLD" : "") : null;
        // One source for both shapes: the audit command wants a List, the outcome a Set, and a
        // candidate must never be "selected" in one and not the other (mezo-4qyt).
        List<MemoryRetrievalAuditWriter.CandidateIdentity> selectedIds = selected.stream()
                .map(item -> MemoryRetrievalAuditWriter.identity(item.candidate()))
                .toList();
        long durationMs = elapsedMillis(started);
        AuditResult audit = writeAudit(options, new AuditCommand(
                request, query, properties.servingEmbeddingVersion(), null, servingMode,
                durationMs, batch.trace(), errorCode, ranked, selectedIds, reranked));
        if (totalFailure && fallbackOnTotalFailure) {
            throw new SystemRuntimeErrorException(
                    SystemMessage.error("INTERNAL_ERROR")
                            .exceptionTraceId(audit.traceId().toString())
                            .build(),
                    HttpStatus.INTERNAL_SERVER_ERROR);
        }
        List<MemoryContextItem> items = selected.stream()
                .map(item -> contextItem(item, audit, request))
                .toList();
        String promptBlock = renderer.render(items, tokenBudget);
        List<RefsEnvelope.Ref> refs = items.stream()
                .map(item -> new RefsEnvelope.Ref(
                        item.sourceKind(), item.sourceId().toString(), item.label()))
                .toList();
        MemoryContext context =
                new MemoryContext(items, promptBlock, refs, audit.runId(), audit.traceId());
        return new RetrievalOutcome(context, query, ranked, Set.copyOf(selectedIds), batch.trace(),
                errorCode, durationMs, reranked, audit.runId());
    }

    /**
     * D1: {@code audit = false} writes nothing. The stand-in still carries a trace id (the surface
     * shows one so a support conversation has a handle) and an EMPTY {@code resultIds} map, so the
     * {@link MemoryContextItem#retrievalResultId()} of a dry-run item is null — there is no row to
     * point at, and inventing one would make the map's "open the audit row" link a dead end.
     */
    private AuditResult writeAudit(RetrieveOptions options, AuditCommand command) {
        return options.audit()
                ? auditWriter.write(command)
                : new AuditResult(null, UUID.randomUUID(), Map.of());
    }

    private RetrievalBatch retrieveCandidates(MemoryRequest request, PreparedMemoryQuery query) {
        // mezo-eq85.7: every consumer's candidate pool comes from its own policy limits now —
        // REFLECTION and CHAT_AMBIENT are adapted from their pre-existing config shapes so their
        // numbers stay byte-identical to before this shared seam existed.
        int candidateLimit = properties.limitsFor(request.consumerPolicy()).candidateLimit();
        RetrievalInput input = new RetrievalInput(
                request, query, properties.servingEmbeddingVersion(), candidateLimit);
        Map<String, RetrieverTask> tasks = new LinkedHashMap<>();
        long timeoutNanos = TimeUnit.MILLISECONDS.toNanos(properties.execution().retrieverTimeoutMs());
        // mezo-4qyt: both LLM breadcrumb ThreadLocals are plain, so a retriever's embed call on a
        // pool thread sees neither the actor nor the feature — capture them HERE, on the calling
        // thread, and re-bind them inside the task. The two are deliberately NOT symmetric:
        // mezo-ozri.7 widens the ACTOR to every caller (an embed made for a user must book against
        // that user, or the per-user cap cannot see it), while the CONTEXT label stays replay-only,
        // because widening the label would retroactively re-file all existing embed traffic under a
        // different feature and corrupt the shipped cost matrix.
        UUID actor = LlmActorContext.capture();
        LlmCallContext ambient = llmCallContextHolder.get();
        LlmCallContext propagated = ambient.isAdminReplay() ? ambient : null;
        retrievers.values().stream()
                .sorted(Comparator.comparing(MemoryRetriever::name))
                .forEach(retriever -> {
                    long deadline = System.nanoTime() + timeoutNanos;
                    try {
                        Future<RetrieverOutcome> future = applicationTaskExecutor.submit(
                                () -> executeInScope(retriever, input, actor, propagated));
                        tasks.put(retriever.name(), new RetrieverTask(future, deadline, null));
                    } catch (RuntimeException exception) {
                        tasks.put(retriever.name(), new RetrieverTask(null, deadline,
                                exception.getClass().getSimpleName()));
                        log.warn("Memory retriever {} could not be submitted", retriever.name(), exception);
                    }
                });

        Map<String, List<MemoryCandidate>> candidates = new LinkedHashMap<>();
        Map<String, Object> trace = new LinkedHashMap<>();
        int successCount = 0;
        for (Map.Entry<String, RetrieverTask> entry : tasks.entrySet()) {
            RetrieverOutcome outcome;
            RetrieverTask task = entry.getValue();
            try {
                if (task.future() == null) {
                    outcome = new RetrieverOutcome(List.of(), 0L, task.submissionError(), 0L);
                } else if (task.future().isDone()) {
                    outcome = task.future().get();
                } else {
                    long remaining = task.deadlineNanos() - System.nanoTime();
                    if (remaining <= 0) {
                        throw new TimeoutException("retriever deadline elapsed");
                    }
                    outcome = task.future().get(remaining, TimeUnit.NANOSECONDS);
                }
                if (outcome.error() == null && outcome.completedNanos() > task.deadlineNanos()) {
                    throw new TimeoutException("retriever completed after deadline");
                }
                if (outcome.error() == null) {
                    successCount++;
                }
            } catch (TimeoutException exception) {
                task.future().cancel(true);
                outcome = new RetrieverOutcome(
                        List.of(), properties.execution().retrieverTimeoutMs(), "TIMEOUT", 0L);
                log.warn("Memory retriever {} timed out; successful peers will still be used", entry.getKey());
            } catch (InterruptedException exception) {
                task.future().cancel(true);
                Thread.currentThread().interrupt();
                outcome = new RetrieverOutcome(List.of(), elapsedToDeadline(task), "INTERRUPTED", 0L);
                log.warn("Memory retriever {} wait was interrupted", entry.getKey());
            } catch (ExecutionException | CancellationException exception) {
                Throwable cause = exception instanceof ExecutionException && exception.getCause() != null
                        ? exception.getCause() : exception;
                String code = cause.getClass().getSimpleName();
                outcome = new RetrieverOutcome(
                        List.of(), properties.execution().retrieverTimeoutMs(), code, 0L);
                log.warn("Memory retriever {} failed; successful peers will still be used", entry.getKey(), cause);
            }
            candidates.put(entry.getKey(), outcome.candidates());
            Map<String, Object> details = new LinkedHashMap<>();
            details.put("durationMs", outcome.durationMs());
            details.put("candidateCount", outcome.candidates().size());
            if (outcome.error() != null) {
                details.put("error", outcome.error());
            }
            trace.put(entry.getKey(), details);
        }
        return new RetrievalBatch(Map.copyOf(candidates), Map.copyOf(trace), successCount);
    }

    /** Re-binds the captured breadcrumbs (if any) around one retriever's work on the pool thread. */
    private RetrieverOutcome executeInScope(MemoryRetriever retriever, RetrievalInput input,
            UUID actor, LlmCallContext context) {
        Supplier<RetrieverOutcome> work = () -> execute(retriever, input);
        Supplier<RetrieverOutcome> labelled = context == null
                ? work
                : () -> llmCallContextHolder.runWith(context, work);
        return LlmActorContext.runAsCaptured(actor, labelled);
    }

    private static RetrieverOutcome execute(MemoryRetriever retriever, RetrievalInput input) {
        long started = System.nanoTime();
        List<MemoryCandidate> candidates = retriever.retrieve(input);
        long completed = System.nanoTime();
        return new RetrieverOutcome(
                candidates, TimeUnit.NANOSECONDS.toMillis(completed - started), null, completed);
    }

    private MemoryContextItem contextItem(FusedCandidate fused, AuditResult audit, MemoryRequest request) {
        MemoryCandidate candidate = fused.candidate();
        return new MemoryContextItem(
                audit.resultIds().get(MemoryRetrievalAuditWriter.identity(candidate)),
                candidate.memoryItemId(), candidate.sourceId(), candidate.sourceKind(), candidate.label(),
                candidate.content(), candidate.occurredOn(), renderer.indicator(candidate, request.asOf()),
                fused.score());
    }

    private int boundedTokenBudget(MemoryRequest request) {
        int requested = request.maxTokenBudget() > 0
                ? request.maxTokenBudget() : properties.serving().chatMaxTokens();
        // mezo-eq85.7: REFLECTION and CHAT_AMBIENT keep exactly today's numbers (adapted from
        // their pre-existing config shapes by limitsFor); every other policy is now bounded the
        // same way, by its own configured maxTokens.
        return Math.min(requested, properties.limitsFor(request.consumerPolicy()).maxTokens());
    }

    private static long elapsedMillis(long startedNanos) {
        return Math.max(0L, TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - startedNanos));
    }

    private long elapsedToDeadline(RetrieverTask task) {
        long timeoutNanos = TimeUnit.MILLISECONDS.toNanos(properties.execution().retrieverTimeoutMs());
        long submittedNanos = task.deadlineNanos() - timeoutNanos;
        return elapsedMillis(submittedNanos);
    }

    private record RetrieverOutcome(
            List<MemoryCandidate> candidates, long durationMs, String error, long completedNanos) {
    }

    private record RetrieverTask(Future<RetrieverOutcome> future, long deadlineNanos, String submissionError) {
    }

    private record RetrievalBatch(
            Map<String, List<MemoryCandidate>> candidates,
            Map<String, Object> trace,
            int successCount) {
    }

}
