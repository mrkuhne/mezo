package io.mrkuhne.mezo.feature.companion.reflection.service;

import io.mrkuhne.mezo.feature.companion.memory.dto.ConsumerPolicy;
import io.mrkuhne.mezo.feature.companion.memory.service.MemoryContextBlock;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

/**
 * Reflexió S3 (bd mezo-eq85.3, spec 2026-09-06 §4.5): the nightly reflection's ONE door into the
 * unified memory platform. It exists so the reflection pass never talks to retrievers directly:
 * one {@link ConsumerPolicy#REFLECTION} request, one audited run, one prompt block.
 *
 * <p>Memória mindenhol S7 (mezo-eq85.7): this class is now a THIN delegate to {@link
 * MemoryContextBlock}, the seam every other Part-B surface shares — same public {@link
 * #contextFor} signature and the same fail-open contract, so callers see no behaviour change.
 * The nightly pass has no user waiting on it, so its policy is deliberately deeper than chat's
 * (its own candidate pool, token budget and reranker allowance live under {@code
 * mezo.companion.memory-platform.policies.reflection}).
 *
 * <p>The persisted LLM-call operation label moves from the pre-S7 literal {@code "memory"} to
 * {@code "reflection_memory"} ({@link MemoryContextBlock#render} always appends {@code "_memory"}
 * to its {@code operation} argument) — {@code ReflectionMemoryGatewayIT} does not pin this label,
 * only the block content and the audited {@code consumerPolicy}, so the rename is safe.
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.REFLECTION_SWITCH},
        havingValue = "true")
public class ReflectionMemoryGateway {

    private final MemoryContextBlock memoryContextBlock;

    /** The rendered {@code [Hosszú távú memória]} block for one reflection query, or {@code ""}. */
    public String contextFor(UUID userId, String query, boolean deep) {
        return memoryContextBlock.render(userId, ConsumerPolicy.REFLECTION, query, LocalDate.now(),
                deep, "companion_reflection", "reflection", null).block();
    }
}
