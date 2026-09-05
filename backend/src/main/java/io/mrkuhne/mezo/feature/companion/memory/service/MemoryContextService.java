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
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CancellationException;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
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

    private final MemoryQueryPreparer queryPreparer;
    private final Map<String, MemoryRetriever> retrievers;
    private final MemoryCandidateFusion fusion;
    private final MemoryContextSelector selector;
    private final MemoryContextRenderer renderer;
    private final MemoryReranker reranker;
    private final MemoryRetrievalAuditWriter auditWriter;
    private final MemoryPlatformProperties properties;
    private final AsyncTaskExecutor applicationTaskExecutor;
    private final LlmCallContextHolder llmCallContextHolder;

    public MemoryContext retrieve(MemoryRequest request) {
        return retrieve(request, RetrievalServingMode.NEW);
    }

    public MemoryContext retrieve(MemoryRequest request, RetrievalServingMode servingMode) {
        return retrieve(request, servingMode, false);
    }

    /** NEW chat serving variant: an audited total retriever outage signals the legacy fallback. */
    public MemoryContext retrieveForServing(MemoryRequest request) {
        return retrieve(request, RetrievalServingMode.NEW, true);
    }

    private MemoryContext retrieve(
            MemoryRequest request, RetrievalServingMode servingMode, boolean fallbackOnTotalFailure) {
        long started = System.nanoTime();
        PreparedMemoryQuery query = queryPreparer.prepare(request);
        if (query.mode() == QueryMode.NO_MEMORY_NEEDED) {
            AuditResult audit = auditWriter.write(new AuditCommand(
                    request, query, properties.servingEmbeddingVersion(), null, servingMode,
                    elapsedMillis(started), Map.of(), null, List.of(), List.of(), false));
            return new MemoryContext(List.of(), "", List.of(), audit.runId(), audit.traceId());
        }

        RetrievalBatch batch = retrieveCandidates(request, query);
        List<FusedCandidate> ranked = fusion.fuse(batch.candidates(), query, request.asOf());
        int tokenBudget = boundedTokenBudget(request);
        List<FusedCandidate> selected = selector.select(ranked, tokenBudget, request.asOf());
        boolean reranked = reranker.shouldRerank(request, batch.candidates(), selected);
        if (reranked) {
            ranked = reranker.rerank(ranked);
            selected = selector.select(ranked, tokenBudget, request.asOf());
        }

        boolean totalFailure = batch.successCount() == 0 && !retrievers.isEmpty();
        String errorCode = totalFailure
                ? ALL_RETRIEVERS_FAILED + (fallbackOnTotalFailure ? "_FALLBACK_OLD" : "") : null;
        List<MemoryRetrievalAuditWriter.CandidateIdentity> selectedIds = selected.stream()
                .map(item -> MemoryRetrievalAuditWriter.identity(item.candidate()))
                .toList();
        AuditResult audit = auditWriter.write(new AuditCommand(
                request, query, properties.servingEmbeddingVersion(), null, servingMode,
                elapsedMillis(started), batch.trace(), errorCode, ranked, selectedIds, reranked));
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
        return new MemoryContext(items, promptBlock, refs, audit.runId(), audit.traceId());
    }

    private RetrievalBatch retrieveCandidates(MemoryRequest request, PreparedMemoryQuery query) {
        RetrievalInput input = new RetrievalInput(
                request, query, properties.servingEmbeddingVersion(), properties.serving().candidateLimit());
        Map<String, RetrieverTask> tasks = new LinkedHashMap<>();
        long timeoutNanos = TimeUnit.MILLISECONDS.toNanos(properties.execution().retrieverTimeoutMs());
        LlmCallContext callContext = llmCallContextHolder.get();
        retrievers.values().stream()
                .sorted(Comparator.comparing(MemoryRetriever::name))
                .forEach(retriever -> {
                    long deadline = System.nanoTime() + timeoutNanos;
                    try {
                        Future<RetrieverOutcome> future = applicationTaskExecutor.submit(
                                () -> llmCallContextHolder.runWith(
                                        callContext, () -> execute(retriever, input)));
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
        return request.consumerPolicy() == io.mrkuhne.mezo.feature.companion.memory.dto.ConsumerPolicy.CHAT_AMBIENT
                ? Math.min(requested, properties.serving().chatMaxTokens()) : requested;
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
