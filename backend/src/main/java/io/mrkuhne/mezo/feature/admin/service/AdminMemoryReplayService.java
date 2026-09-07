package io.mrkuhne.mezo.feature.admin.service;

import io.mrkuhne.mezo.api.dto.AdminMemoryReplayRequest;
import io.mrkuhne.mezo.feature.admin.config.AdminMemoryProperties;
import io.mrkuhne.mezo.feature.companion.EmbeddingPort;
import io.mrkuhne.mezo.feature.companion.memory.config.MemoryPlatformProperties;
import io.mrkuhne.mezo.feature.companion.memory.dto.ConsumerPolicy;
import io.mrkuhne.mezo.feature.companion.memory.dto.MemoryRequest;
import io.mrkuhne.mezo.feature.companion.memory.dto.RetrievalServingMode;
import io.mrkuhne.mezo.feature.companion.memory.service.MemoryContextService;
import io.mrkuhne.mezo.feature.companion.memory.service.MemoryProjectionService;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContext;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContextHolder;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.security.LlmActorContext;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

/**
 * The dry-run replay (mezo-4qyt): what NEW mode WOULD return for this query, right now.
 *
 * <p>Honesty is the feature. Three things are deliberately true and all three are surfaced:
 * (1) it writes no audit row (D1) and touches nothing the user owns; (2) it runs NEW mode, which
 * in production is SHADOW — so it is NOT what the companion actually served; (3) its LLM spend is
 * billed to the INSPECTED user under {@code admin_replay}, which is why both scopes below exist.
 *
 * <p>NOT {@code @Transactional}: an open transaction across the embed + rewrite + rerank network
 * calls would hold a Hikari connection for the whole latency budget, and the test pool is 5.
 *
 * <p>Gated on the COMPANION switch as well as its own, so that with the companion off this bean is
 * simply absent and {@code AdminMemoryService}'s {@code ObjectProvider} answers 404
 * {@code ADMIN_MEMORY_DISABLED} instead of the context failing to start on a missing
 * {@code MemoryContextService}.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.ADMIN_MEMORY_SWITCH, FeaturesConfiguration.COMPANION_SWITCH},
        havingValue = "true")
public class AdminMemoryReplayService {

    /** The replay's honesty flag for the SECOND embed call its map placement costs. */
    static final String NOTE_PROJECTION_EMBED_EXTRA_CALL = "projection_embed_extra_call";
    /** The replay's honesty flag for a map placement that could not be produced at all. */
    static final String NOTE_PCA_UNAVAILABLE = "pca_unavailable";

    private final MemoryContextService memoryContextService;
    private final MemoryProjectionService projectionService;
    private final EmbeddingPort embeddingPort;
    private final MemoryPlatformProperties memoryPlatformProperties;
    private final LlmCallContextHolder llmCallContextHolder;
    private final AdminMemoryProperties properties;

    /**
     * One replay's full result: the retrieval outcome, the query's place in the map's PCA space
     * (null when it could not be produced), and the honesty notes those two facts earned.
     */
    public record ReplayOutcome(
            MemoryContextService.RetrievalOutcome outcome, List<Float> queryProjection,
            List<String> notes) {}

    /** One side-effect-free NEW-mode retrieval for {@code userId}, billed to {@code userId}. */
    public ReplayOutcome replay(
            UUID userId, AdminMemoryReplayRequest request, ConsumerPolicy consumerPolicy) {
        MemoryRequest memoryRequest = new MemoryRequest(
                userId,
                consumerPolicy,
                request.getQuery(),
                // No conversation history: a replay has none, and inventing one would change what
                // the rewriter sees.
                List.of(),
                request.getAsOf() == null ? LocalDate.now() : request.getAsOf(),
                // 0 ⇒ the policy's own token budget applies.
                0,
                // No conversationId ⇒ no same-conversation exclusion.
                null,
                false);
        MemoryContextService.RetrieveOptions options = new MemoryContextService.RetrieveOptions(
                false, RetrievalServingMode.NEW,
                Boolean.TRUE.equals(request.getReranker()),
                Boolean.TRUE.equals(request.getRewrite()));
        LlmCallContext context = new LlmCallContext(
                properties.replayFeatureLabel(), "memory_retrieval", null, null);
        // Order matters: runAsOverride is the OUTER scope, so the actor override is live for every
        // LLM call the retrieval makes (embed, rewrite, rerank), including ones made on pool
        // threads whose context the resolver reads on the CALLING thread before the async audit hop.
        return LlmActorContext.runAsOverride(userId, () ->
                llmCallContextHolder.runWith(context, () -> {
                    MemoryContextService.RetrievalOutcome outcome =
                            memoryContextService.retrieveDetailed(memoryRequest, options);
                    List<String> notes = new ArrayList<>();
                    List<Float> projection = queryProjection(userId, outcome, notes);
                    return new ReplayOutcome(outcome, projection, List.copyOf(notes));
                }));
    }

    /**
     * Places the replayed query into the SAME PCA space the map draws (resolved ambiguity 2).
     *
     * <p>This costs a SECOND embed call: {@code DenseMemoryRetriever} embeds inside the parallel
     * executor and the query vector never leaves it — {@code MemoryContext} carries no vector, and
     * threading one out would mean mutating the retriever contract for an admin feature. So the
     * replay embeds the prepared dense query itself, under this same {@code admin_replay} context,
     * and says so via {@link #NOTE_PROJECTION_EMBED_EXTRA_CALL}.
     *
     * <p>Failure anywhere in the chain is contained: the replay must NEVER fail because the map
     * could not place its query, so a warning is logged, {@link #NOTE_PCA_UNAVAILABLE} is added,
     * and {@code queryProjection} stays null.
     */
    private List<Float> queryProjection(
            UUID userId, MemoryContextService.RetrievalOutcome outcome, List<String> notes) {
        String denseQuery = outcome.query().denseQuery();
        if (denseQuery == null || denseQuery.isBlank()) {
            // A NO_MEMORY_NEEDED query was never embedded and has nothing to place; paying for an
            // embed call to plot a blank string would be spend with no answer behind it.
            notes.add(NOTE_PCA_UNAVAILABLE);
            return null;
        }
        try {
            float[] queryVector = embeddingPort.embedQuery(denseQuery);
            notes.add(NOTE_PROJECTION_EMBED_EXTRA_CALL);
            MemoryProjectionService.Projection projection = projectionService.project(
                    userId, projectionRequest(memoryPlatformProperties.servingEmbeddingVersion()));
            float[] placed = projectionService.transform(projection, queryVector);
            List<Float> coordinates = new ArrayList<>(placed.length);
            for (float coordinate : placed) {
                coordinates.add(coordinate);
            }
            return List.copyOf(coordinates);
        } catch (RuntimeException exception) {
            log.warn("the admin replay could not place its query in the PCA space", exception);
            notes.add(NOTE_PCA_UNAVAILABLE);
            return null;
        }
    }

    /** The admin-owned PCA knobs, handed to the companion service rather than injected into it. */
    private MemoryProjectionService.ProjectionRequest projectionRequest(String embeddingVersion) {
        return new MemoryProjectionService.ProjectionRequest(
                embeddingVersion, properties.pcaTargetDims(), properties.vectorSampleThreshold(),
                memoryPlatformProperties.serving().itemMaxChars());
    }
}
