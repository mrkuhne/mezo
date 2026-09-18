package io.mrkuhne.mezo.feature.companion.memory.service;

import io.mrkuhne.mezo.feature.companion.EmbeddingPort;
import io.mrkuhne.mezo.feature.companion.memory.config.MemoryPlatformProperties;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContext;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContextHolder;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.security.LlmActorContext;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Supplier;
import java.util.concurrent.CancellationException;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.task.AsyncTaskExecutor;
import org.springframework.stereotype.Service;

/**
 * The ONE query-embedding hop of a retrieval, taken before the retriever fan-out (bd mezo-iddo).
 *
 * <p>It used to live inside {@link DenseMemoryRetriever}, and therefore inside the per-retriever
 * deadline. That deadline ({@code execution.retriever-timeout-ms}) is 200 ms because every
 * retriever under it does one indexed database query — but embedding is a call to the provider,
 * measured in production at p50 ~270 ms and p95 ~675 ms. The deadline consequently expired first
 * essentially every time: on the live database, 55 of 55 runs over 14 days recorded
 * {@code dense = TIMEOUT}. Worse, it was invisible — a run only gets an {@code error_code} when
 * ALL FOUR retrievers fail, and the other three kept succeeding, so the audit showed zero errors
 * while semantic recall had never once worked.
 *
 * <p>Hoisting it here fixes both halves. The embedding gets a budget sized for a network call, and
 * the 200 ms stays what it was designed to be: a database budget. The cancel that used to interrupt
 * the in-flight HTTP request — surfacing as the {@code GenAiIOException} rows this ticket was
 * originally filed for — no longer fires on a normal call.
 *
 * <p>FAIL-OPEN by contract: a query we cannot embed yields {@link Optional#empty()}, never an
 * exception. Dense recall is then skipped for that run while the lexical, fact and graph retrievers
 * still answer — degraded, not dead.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class MemoryQueryEmbedder {

    private static final String FEATURE_COMPANION_RECALL = "companion_recall";
    private static final String OPERATION = "recall_embed";

    private static final LlmCallContext CALL_CONTEXT =
            new LlmCallContext(FEATURE_COMPANION_RECALL, OPERATION, null, null);

    private final EmbeddingPort embeddingPort;
    private final MemoryPlatformProperties properties;
    private final LlmCallContextHolder llmCallContextHolder;
    @Qualifier("applicationTaskExecutor")
    private final AsyncTaskExecutor applicationTaskExecutor;

    /**
     * The dense-search vector for {@code denseQuery}, or empty when it could not be produced within
     * {@code execution.query-embedding-timeout-ms}.
     *
     * <p>Runs on the shared executor rather than the calling thread purely so the budget can be
     * enforced: {@link EmbeddingPort} is a blocking call with no timeout of its own, and an
     * unbounded hop here would stall a chat turn or a nightly job indefinitely.
     */
    public Optional<float[]> embed(String denseQuery) {
        if (denseQuery == null || denseQuery.isBlank()) {
            return Optional.empty();
        }
        long budgetMs = properties.execution().queryEmbeddingTimeoutMs();
        // Both LLM breadcrumb ThreadLocals are plain, so the pool thread would see neither the
        // actor nor the feature. Capture them HERE and re-bind them inside the task, exactly as
        // MemoryContextService does for the retrievers (mezo-4qyt / mezo-ozri.7). The ACTOR widens
        // to every caller so the embed books against the right user and its per-user cap can see
        // it; the LABEL is this class's own, never the ambient one — see callContext().
        UUID actor = LlmActorContext.capture();
        LlmCallContext label = callContext();
        Supplier<float[]> work = () -> embeddingPort.embedQuery(denseQuery);
        Supplier<float[]> labelled = () -> llmCallContextHolder.runWith(label, work);
        Future<float[]> future;
        try {
            future = applicationTaskExecutor.submit(() -> LlmActorContext.runAsCaptured(actor, labelled));
        } catch (RuntimeException exception) {
            log.warn("Query embedding could not be submitted; dense recall is skipped", exception);
            return Optional.empty();
        }
        try {
            return Optional.ofNullable(future.get(budgetMs, TimeUnit.MILLISECONDS));
        } catch (TimeoutException exception) {
            future.cancel(true);
            log.warn("Query embedding exceeded its {} ms budget; dense recall is skipped", budgetMs);
        } catch (InterruptedException exception) {
            future.cancel(true);
            Thread.currentThread().interrupt();
            log.warn("Query embedding was interrupted; dense recall is skipped");
        } catch (ExecutionException | CancellationException exception) {
            Throwable cause = exception instanceof ExecutionException && exception.getCause() != null
                    ? exception.getCause() : exception;
            log.warn("Query embedding failed; dense recall is skipped", cause);
        }
        return Optional.empty();
    }

    /**
     * {@code companion_recall/recall_embed} for every caller EXCEPT the admin explorer's dry-run
     * replay (mezo-4qyt), which re-labels this call to its own feature so one replay's total cost
     * is priceable in the admin cost matrix. Deliberately the SAME shape as
     * {@link LlmMemoryQueryRewriter}'s, and deliberately the same label the legacy recall path
     * already used, so the OLD → NEW serving-mode cutover does not split this traffic across two
     * feature buckets.
     *
     * <p>Why not simply inherit the ambient feature: {@code LlmCallContextHolder.runWith}
     * save-and-restores, so a chat turn's ambient {@code companion_chat} is live on this thread
     * too — inheriting it would silently move EVERY chat recall embed out of
     * {@code companion_recall} and corrupt the shipped cost matrix. This call site shipped
     * unlabelled (bd mezo-1qfzu: it logged as {@code unknown}, which is how a paid provider call
     * stayed invisible in the cost report); giving it its own label creates attribution where
     * there was none rather than re-filing anything that already exists.
     *
     * <p>Consequence worth knowing: a Part-B surface reaching retrieval through
     * {@link MemoryContextBlock} books its embed here, not under the calling surface. Per-surface
     * retrieval cost is a separate question from per-surface answer cost.
     */
    private LlmCallContext callContext() {
        LlmCallContext ambient = llmCallContextHolder.get();
        return ambient.isAdminReplay()
                ? new LlmCallContext(ambient.feature(), OPERATION, null, null)
                : CALL_CONTEXT;
    }
}
