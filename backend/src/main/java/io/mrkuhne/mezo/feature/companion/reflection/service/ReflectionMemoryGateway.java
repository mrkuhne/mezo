package io.mrkuhne.mezo.feature.companion.reflection.service;

import io.mrkuhne.mezo.feature.companion.memory.config.MemoryPlatformProperties;
import io.mrkuhne.mezo.feature.companion.memory.dto.ConsumerPolicy;
import io.mrkuhne.mezo.feature.companion.memory.dto.MemoryContext;
import io.mrkuhne.mezo.feature.companion.memory.dto.MemoryRequest;
import io.mrkuhne.mezo.feature.companion.memory.service.MemoryContextService;
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
 * Reflexió S3 (bd mezo-eq85.3, spec 2026-09-06 §4.5): the nightly reflection's ONE door into the
 * unified memory platform. It exists so the reflection pass never talks to retrievers directly:
 * one {@link ConsumerPolicy#REFLECTION} request, one audited run, one prompt block.
 *
 * <p>FAIL-OPEN by contract: a reflection that cannot reach the memory platform must still reflect
 * on what it does have. Every failure below this method is logged and turns into {@code ""} —
 * never an exception, never a half-built block. The nightly pass has no user waiting on it, so the
 * policy is deliberately deeper than chat's (its own candidate pool, token budget and reranker
 * allowance live under {@code mezo.companion.memory-platform.policies.reflection}).
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.REFLECTION_SWITCH},
        havingValue = "true")
public class ReflectionMemoryGateway {

    private final MemoryContextService memoryContextService;
    private final MemoryPlatformProperties properties;
    private final LlmCallContextHolder llmCallContextHolder;

    /** The rendered {@code [Hosszú távú memória]} block for one reflection query, or {@code ""}. */
    public String contextFor(UUID userId, String query, boolean deep) {
        if (query == null || query.isBlank()) {
            return "";
        }
        try {
            MemoryRequest request = new MemoryRequest(userId, ConsumerPolicy.REFLECTION, query,
                    List.of(), LocalDate.now(), properties.policies().reflection().maxTokens(),
                    null, deep);
            MemoryContext context = llmCallContextHolder.runWith(
                    new LlmCallContext("companion_reflection", "memory", null, null),
                    () -> memoryContextService.retrieve(request));
            return context.promptBlock() == null ? "" : context.promptBlock();
        } catch (RuntimeException e) {
            log.warn("Reflection memory retrieval failed for user {} — continuing without memories",
                    userId, e);
            return "";
        }
    }
}
