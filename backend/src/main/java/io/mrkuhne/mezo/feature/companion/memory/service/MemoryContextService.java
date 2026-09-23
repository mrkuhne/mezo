package io.mrkuhne.mezo.feature.companion.memory.service;

import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import io.mrkuhne.mezo.feature.companion.entity.RefsEnvelope;
import io.mrkuhne.mezo.feature.companion.memory.config.MemoryPlatformProperties;
import io.mrkuhne.mezo.feature.companion.memory.dto.ConsumerPolicy;
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
import java.util.Optional;
import java.time.LocalDate;
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

    private static final String PARTIAL_NOTICE = "[Memóriakeresés: részleges eredmény; egyes keresők nem válaszoltak. A hiányzó találat nem bizonyítja, hogy nincs adat.]\n";

    private static final String ALL_RETRIEVERS_FAILED = "MEMORY_RETRIEVAL_ALL_FAILED";

    /** {@link DenseMemoryRetriever#name()} — the only retriever whose local score is raw cosine. */
    private static final String DENSE_RETRIEVER = "dense";

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
    private final MemoryQueryEmbedder queryEmbedder;
    private final Map<String, MemoryRetriever> retrievers;
    private final MemoryCandidateFusion fusion;
    private final MemoryContextSelector selector;
    private final MemoryContextRenderer renderer;
    private final MemoryReranker reranker;
    private final MemoryRetrievalAuditWriter auditWriter;
    private final MemoryPlatformProperties properties;
    private final CompanionProperties companionProperties;
    private final LlmCallContextHolder llmCallContextHolder;
    private final AsyncTaskExecutor applicationTaskExecutor;

    public MemoryContext retrieve(MemoryRequest request) {
        return retrieve(request, RetrievalServingMode.NEW);
    }

    public MemoryContext retrieve(MemoryRequest request, RetrievalServingMode servingMode) {
        return execute(request, RetrieveOptions.audited(servingMode), false).context();
    }

    /**
     * Total-outage-honest variant (mezo-eq85.10 FIX 3) for a surface where an EMPTY result is not a
     * neutral fact but a statement about the user's history. {@link #retrieve} answers a total
     * retriever outage with an empty context, which the "hasonló napok" search would render as
     * "nincs ilyen napod" — a lie. Here the outage surfaces as an exception, and the caller decides:
     * the endpoint propagates it (an honest error beats a fabricated empty), the chat tool catches
     * it and says it could not recall right now. The audit row is written either way — the trace id
     * on the error is the handle to it.
     */
    public MemoryContext retrieveOrFail(MemoryRequest request) {
        RetrievalOutcome outcome =
                execute(request, RetrieveOptions.audited(RetrievalServingMode.NEW), false);
        if (outcome.errorCode() != null && outcome.errorCode().startsWith(ALL_RETRIEVERS_FAILED)) {
            throw new SystemRuntimeErrorException(
                    SystemMessage.error("MEMORY_RETRIEVAL_UNAVAILABLE")
                            .exceptionTraceId(outcome.context().traceId().toString())
                            .build(),
                    HttpStatus.INTERNAL_SERVER_ERROR);
        }
        return outcome.context();
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
        PreparedMemoryQuery query = boundedQuery(request, queryPreparer.prepare(request, options.rewrite()));
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
        Map<String, List<MemoryCandidate>> candidates =
                aboveRelevanceFloor(withinPolicyWindow(batch.candidates(), request, query), request.consumerPolicy());
        List<FusedCandidate> ranked = fusion.fuse(candidates, query, request.asOf());
        // mezo-eq85.10 fix round 2, FIX A: the ratio is over the retrievers that were ASKED, not
        // over every registered bean. A retriever the run skipped a priori (see
        // MemoryRetriever#appliesTo) is neither a success nor a failure.
        boolean partialFailure =
                batch.successCount() > 0 && batch.successCount() < batch.attemptedCount();
        int tokenBudget = Math.max(0, boundedTokenBudget(request) - (partialFailure ? (PARTIAL_NOTICE.length() + 2) / 3 : 0));
        List<FusedCandidate> selected = selector.select(ranked, tokenBudget, request.asOf());
        boolean reranked = options.reranker()
                && reranker.shouldRerank(request, candidates, selected);
        if (reranked) {
            ranked = reranker.rerank(ranked);
            selected = selector.select(ranked, tokenBudget, request.asOf());
        }

        boolean totalFailure = batch.successCount() == 0 && batch.attemptedCount() > 0;
        String errorCode = totalFailure
                ? ALL_RETRIEVERS_FAILED + (fallbackOnTotalFailure ? "_FALLBACK_OLD" : "")
                : batch.successCount() < batch.attemptedCount()
                        ? "MEMORY_RETRIEVAL_PARTIAL_FAILURE" : null;
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
        if (partialFailure && boundedTokenBudget(request) * 3 >= PARTIAL_NOTICE.length()) {
            promptBlock = PARTIAL_NOTICE + promptBlock;
        }
        List<RefsEnvelope.Ref> refs = items.stream()
                .map(item -> new RefsEnvelope.Ref(
                        item.sourceKind(), item.sourceId().toString(), item.label()))
                .toList();
        MemoryContext context =
                new MemoryContext(items, promptBlock, refs, audit.runId(), audit.traceId());
        return new RetrievalOutcome(context, query, ranked, Set.copyOf(selectedIds), batch.trace(),
                errorCode, durationMs, reranked, audit.runId());
    }

    /** Apply the reflection window before dense/lexical SQL limits and token selection. */
    private PreparedMemoryQuery boundedQuery(MemoryRequest request, PreparedMemoryQuery query) {
        if (request.consumerPolicy() != ConsumerPolicy.REFLECTION) return query;
        LocalDate earliest = request.asOf().minusDays(properties.policies().reflection().lookbackDays() - 1L);
        LocalDate from = query.from().filter(date -> date.isAfter(earliest)).orElse(earliest);
        LocalDate to = query.to().filter(date -> date.isBefore(request.asOf())).orElse(request.asOf());
        return new PreparedMemoryQuery(query.mode(), query.rawQuery(), query.denseQuery(),
                Optional.of(from), Optional.of(to));
    }

    /** Facts/graph adapters may not implement range filtering, so enforce it before fusion too. */
    private Map<String, List<MemoryCandidate>> withinPolicyWindow(
            Map<String, List<MemoryCandidate>> candidates, MemoryRequest request, PreparedMemoryQuery query) {
        if (request.consumerPolicy() != ConsumerPolicy.REFLECTION) return candidates;
        LocalDate from = query.from().orElseThrow();
        LocalDate to = query.to().orElseThrow();
        var filtered = new LinkedHashMap<String, List<MemoryCandidate>>();
        candidates.forEach((retriever, found) -> filtered.put(retriever, found.stream()
                .filter(candidate -> candidate.occurredOn() != null
                        && !candidate.occurredOn().isBefore(from)
                        && !candidate.occurredOn().isAfter(to))
                .toList()));
        return Map.copyOf(filtered);
    }

    /**
     * The restored raw-similarity floor (mezo-eq85.10 FIX 2). The retired {@code MemoryRecallService}
     * documented it as "an honest 'nincs adat' beats a fabricated resemblance", and the swap dropped
     * it; without it a {@code SIMILAR_DAYS} search renders up to {@code k} ARBITRARY days as "hasonló
     * napok", which is exactly the dishonesty this slice exists to remove.
     *
     * <p>Applies to DENSE candidates only, and only for {@code SIMILAR_DAYS}. The dense retriever's
     * {@code localScore} IS raw cosine ({@code 1 - distance}), the one absolute signal the new engine
     * has — every other retriever's local score is a relative, retriever-private number. A LEXICALLY
     * found candidate needs no second threshold: {@code LexicalMemoryQuery} already requires
     * {@code score > 0}, i.e. the words genuinely occur, which is its own honest floor.
     */
    private Map<String, List<MemoryCandidate>> aboveRelevanceFloor(
            Map<String, List<MemoryCandidate>> candidates, ConsumerPolicy policy) {
        if (policy != ConsumerPolicy.SIMILAR_DAYS) {
            return candidates;
        }
        double floor = companionProperties.recall().minSimilarity();
        Map<String, List<MemoryCandidate>> filtered = new LinkedHashMap<>();
        candidates.forEach((retriever, found) -> filtered.put(retriever,
                DENSE_RETRIEVER.equals(retriever)
                        ? found.stream().filter(candidate -> candidate.localScore() >= floor).toList()
                        : found));
        return Map.copyOf(filtered);
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
        // mezo-iddo: the query embedding is a NETWORK hop and must be taken here, once, BEFORE the
        // fan-out — never inside a retriever, where the 200 ms database deadline would kill it.
        // Reached only past the NO_MEMORY_NEEDED early return, so a turn that needs no memory still
        // costs no embedding call.
        float[] queryEmbedding = queryEmbedder.embed(query.denseQuery()).orElse(null);
        // mezo-eq85.10 FIX 1: kind scoping is POLICY-derived and applied inside each retriever's
        // query, because the fused rank is truncated to the token budget below — a caller-side
        // filter only ever sees what survived that truncation.
        RetrievalInput input = new RetrievalInput(
                request, query, properties.servingEmbeddingVersion(), candidateLimit, queryEmbedding,
                request.consumerPolicy().scopedSourceKind());
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
        List<MemoryRetriever> ordered = retrievers.values().stream()
                .sorted(Comparator.comparing(MemoryRetriever::name))
                .toList();
        // mezo-eq85.10 fix round 2, FIX A: a retriever that cannot contribute to THIS run is not
        // submitted at all, and — the part that matters — is kept out of the success ratio below.
        // It still gets a trace entry, marked `skipped`, so the audit row's raw trace keeps its four
        // entries and a reader of THAT json can tell a skip from a zero-hit answer. The admin
        // explorer cannot: AdminMemoryRunMapper.trace projects only retriever/durationMs/
        // candidateCount/error, so a skipped retriever renders there exactly like one that was
        // asked and found nothing. Surfacing the difference needs a `skipped` flag on
        // AdminMemoryRetrieverTrace — deliberately not added here (bd mezo-eq85.10 re-review).
        List<MemoryRetriever> skipped =
                ordered.stream().filter(retriever -> !retriever.appliesTo(input)).toList();
        ordered.stream()
                .filter(retriever -> retriever.appliesTo(input))
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
        int attemptedCount = tasks.size();

        Map<String, List<MemoryCandidate>> candidates = new LinkedHashMap<>();
        Map<String, Object> trace = new LinkedHashMap<>();
        for (MemoryRetriever retriever : skipped) {
            candidates.put(retriever.name(), List.of());
            Map<String, Object> details = new LinkedHashMap<>();
            details.put("durationMs", 0L);
            details.put("candidateCount", 0);
            details.put("skipped", true);
            trace.put(retriever.name(), details);
        }
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
        return new RetrievalBatch(
                Map.copyOf(candidates), Map.copyOf(trace), successCount, attemptedCount);
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

    /**
     * @param successCount   retrievers that were asked AND answered (an honest zero-hit answer is a
     *                       success — that is the normal empty-memory case, not an outage).
     * @param attemptedCount retrievers that were ASKED. Never {@code retrievers.size()}: a run that
     *                       skips a retriever a priori ({@link MemoryRetriever#appliesTo}) must not
     *                       get a free success out of it, or a total outage of the retrievers that
     *                       CAN answer becomes invisible (mezo-eq85.10 fix round 2, FIX A).
     */
    private record RetrievalBatch(
            Map<String, List<MemoryCandidate>> candidates,
            Map<String, Object> trace,
            int successCount,
            int attemptedCount) {
    }

}
