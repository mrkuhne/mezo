package io.mrkuhne.mezo.feature.admin.service;

import io.mrkuhne.mezo.api.dto.AdminMemoryReplayRequest;
import io.mrkuhne.mezo.feature.admin.config.AdminMemoryProperties;
import io.mrkuhne.mezo.feature.companion.memory.dto.ConsumerPolicy;
import io.mrkuhne.mezo.feature.companion.memory.dto.MemoryRequest;
import io.mrkuhne.mezo.feature.companion.memory.dto.RetrievalServingMode;
import io.mrkuhne.mezo.feature.companion.memory.service.MemoryContextService;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContext;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContextHolder;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.security.LlmActorContext;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
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
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.ADMIN_MEMORY_SWITCH, FeaturesConfiguration.COMPANION_SWITCH},
        havingValue = "true")
public class AdminMemoryReplayService {

    private final MemoryContextService memoryContextService;
    private final LlmCallContextHolder llmCallContextHolder;
    private final AdminMemoryProperties properties;

    /** One side-effect-free NEW-mode retrieval for {@code userId}, billed to {@code userId}. */
    public MemoryContextService.RetrievalOutcome replay(
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
                llmCallContextHolder.runWith(context, () ->
                        memoryContextService.retrieveDetailed(memoryRequest, options)));
    }
}
