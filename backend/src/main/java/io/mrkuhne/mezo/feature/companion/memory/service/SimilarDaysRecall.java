package io.mrkuhne.mezo.feature.companion.memory.service;

import io.mrkuhne.mezo.feature.companion.memory.config.MemoryPlatformProperties;
import io.mrkuhne.mezo.feature.companion.memory.dto.ConsumerPolicy;
import io.mrkuhne.mezo.feature.companion.memory.dto.MemoryContext;
import io.mrkuhne.mezo.feature.companion.memory.dto.MemoryContextItem;
import io.mrkuhne.mezo.feature.companion.memory.dto.MemoryRequest;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

/**
 * THE "volt már ilyen napod?" read — the one place the {@link ConsumerPolicy#SIMILAR_DAYS} recall
 * is assembled (mezo-eq85.10 fix round 2, FIX C).
 *
 * <p>The chat tool ({@code MemoryTools.find_similar_past_days}) and the Kereső endpoint
 * ({@code MemoryObservatoryService.similarDays}) promise the user that they see exactly the same
 * memory. That promise used to rest on two hand-maintained copies of the same four steps — the
 * per-policy kill switch, the request, {@link MemoryContextService#retrieveOrFail}, the
 * daily-summary filter — living in two packages, with a javadoc on the tool's private copy claiming
 * it was "shared with MemoryObservatoryService". It was not. One copy is.
 *
 * <p>Each of the four steps is load-bearing and none is obvious, which is what makes duplicating
 * them dangerous:
 * <ul>
 *   <li>the kill switch does NO fan-out and writes NO {@code memory_retrieval_run} row, so the
 *       surface can be rolled back purely by config;</li>
 *   <li>the policy scopes the RETRIEVAL QUERY itself to {@code daily_summary} (see
 *       {@link ConsumerPolicy#scopedSourceKind()}) and keeps the raw-cosine relevance floor;</li>
 *   <li>{@code retrieveOrFail} — never {@code retrieve} — because on this surface an empty list
 *       claims "nincs ilyen napod"; a total outage of the retrievers that were asked must raise
 *       instead (fix round 2, FIX A);</li>
 *   <li>the source-kind filter is a belt-and-braces SECOND guard, applied AFTER retrieval and
 *       BEFORE {@code limit}, so a stray non-day item can never consume one of the k slots.</li>
 * </ul>
 * Rendering stays with each caller: the tool writes Hungarian prose and audits refs, the endpoint
 * builds ranked DTO rows. Only the read is shared.
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class SimilarDaysRecall {

    /**
     * @param days           the recalled days, newest-relevance first, at most {@code limit}.
     * @param retrievalRunId the {@code memory_retrieval_run} row, or {@code null} when the policy's
     *                       kill switch is off and no run happened at all.
     */
    public record Recall(List<MemoryContextItem> days, UUID retrievalRunId) {

        private static final Recall DISABLED = new Recall(List.of(), null);
    }

    private final MemoryContextService memoryContextService;
    private final MemoryPlatformProperties memoryPlatformProperties;

    /** @throws io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException on a total outage of
     *          the retrievers this run asked — deliberately, see the class javadoc. */
    public Recall recall(UUID userId, String query, int limit) {
        MemoryPlatformProperties.PolicyLimits limits =
                memoryPlatformProperties.limitsFor(ConsumerPolicy.SIMILAR_DAYS);
        if (!limits.enabled()) {
            return Recall.DISABLED;
        }
        MemoryRequest request = new MemoryRequest(userId, ConsumerPolicy.SIMILAR_DAYS, query,
                List.of(), LocalDate.now(), limits.maxTokens(), null, false);
        MemoryContext context = memoryContextService.retrieveOrFail(request);
        List<MemoryContextItem> days = context.items().stream()
                .filter(item -> ConsumerPolicy.SOURCE_KIND_DAILY_SUMMARY.equals(item.sourceKind()))
                .limit(limit)
                .toList();
        return new Recall(days, context.retrievalRunId());
    }
}
