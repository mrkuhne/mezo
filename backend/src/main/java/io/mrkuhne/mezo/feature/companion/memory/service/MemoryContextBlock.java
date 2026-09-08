package io.mrkuhne.mezo.feature.companion.memory.service;

import io.mrkuhne.mezo.feature.companion.entity.RefsEnvelope;
import io.mrkuhne.mezo.feature.companion.memory.config.MemoryPlatformProperties;
import io.mrkuhne.mezo.feature.companion.memory.config.MemoryPlatformProperties.PolicyLimits;
import io.mrkuhne.mezo.feature.companion.memory.dto.ConsumerPolicy;
import io.mrkuhne.mezo.feature.companion.memory.dto.MemoryContext;
import io.mrkuhne.mezo.feature.companion.memory.dto.MemoryRequest;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContext;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContextHolder;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

/**
 * Memória mindenhol S7 (bd mezo-eq85.7, spec 2026-09-06 §Part B): the shared seam EVERY non-chat
 * companion surface uses to reach the unified long-term-memory platform — one
 * {@link ConsumerPolicy} request, one audited run, one rendered {@code [Hosszú távú memória]}
 * block. Built here, reused verbatim by every Part-B task (8-12); {@link
 * io.mrkuhne.mezo.feature.companion.reflection.service.ReflectionMemoryGateway} (Task 3) is
 * refactored into a thin caller of this same seam.
 *
 * <p>FAIL-OPEN by contract, exactly like the reflection gateway it generalises: a surface that
 * cannot reach the memory platform must still produce its message. Every failure below this
 * method is logged and turns into {@link Rendered#EMPTY} — never an exception, never a
 * half-built block.
 *
 * <p>Each {@link ConsumerPolicy} is individually switchable ({@code enabled} in {@link
 * MemoryPlatformProperties.PolicyLimits}), so one surface can be rolled back to "no memory
 * context" purely by config, without touching code or any other surface.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class MemoryContextBlock {

    private final MemoryContextService memoryContextService;
    private final MemoryPlatformProperties properties;
    private final LlmCallContextHolder llmCallContextHolder;

    /**
     * Renders the {@code [Hosszú távú memória]} block for one non-chat consumer, or {@link
     * Rendered#EMPTY} when the query is blank, the policy is disabled, or retrieval fails for any
     * reason. Wraps the retrieval in an {@link LlmCallContext} so the embedding/rewrite/rerank
     * calls this triggers are billed to the CALLING surface ({@code feature}/{@code
     * operation}_memory), not to a generic "memory" bucket.
     *
     * @param feature   the calling surface's LLM billing feature (e.g. {@code proactive_feed})
     * @param operation the calling surface's operation label — the persisted label becomes
     *                  {@code operation + "_memory"}
     * @param entityId  the domain object the call is about, or null when there is none
     */
    public Rendered render(UUID userId, ConsumerPolicy policy, String query, LocalDate asOf, boolean deep,
                           String feature, String operation, UUID entityId) {
        PolicyLimits limits = properties.limitsFor(policy);
        if (query == null || query.isBlank() || !limits.enabled()) {
            return Rendered.EMPTY;
        }
        try {
            MemoryRequest request = new MemoryRequest(
                    userId, policy, query, List.of(), asOf, limits.maxTokens(), null, deep);
            MemoryContext context = llmCallContextHolder.runWith(
                    new LlmCallContext(feature, operation + "_memory", "policy", entityId),
                    () -> memoryContextService.retrieve(request));
            return new Rendered(
                    context.promptBlock() == null ? "" : context.promptBlock(),
                    context.refs(), context.retrievalRunId());
        } catch (RuntimeException e) {
            log.warn("Memory context for {}/{} failed — surface continues without it", feature, policy, e);
            return Rendered.EMPTY;
        }
    }

    public record Rendered(String block, List<RefsEnvelope.Ref> refs, UUID retrievalRunId) {
        public static final Rendered EMPTY = new Rendered("", List.of(), null);
    }
}
