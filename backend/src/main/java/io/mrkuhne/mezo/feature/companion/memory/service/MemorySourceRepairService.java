package io.mrkuhne.mezo.feature.companion.memory.service;

import io.mrkuhne.mezo.feature.companion.memory.config.MemoryPlatformProperties;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryProvenanceEnvelope;
import io.mrkuhne.mezo.feature.companion.memory.repository.MemorySourceRepairQuery;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

/** Each source repairs in its own transaction; failures retry on the next bounded nightly sweep. */
@Slf4j
@Service
@RequiredArgsConstructor
public class MemorySourceRepairService {
    private final MemorySourceRepairQuery query;
    private final MemoryProjectionWriter writer;
    private final MemoryPlatformProperties properties;

    public int repair(UUID owner, LocalDate through, int budget) {
        for (var source : query.orphaned(owner, budget)) {
            try {
                writer.suppress(owner, source.kind(), source.id());
            } catch (RuntimeException failure) {
                log.warn("Canonical source suppression failed for {} {}", source.kind(), source.id(), failure);
            }
        }
        int repaired = 0;
        for (var source : query.changed(owner, through, properties.servingEmbeddingVersion(), budget)) {
            try {
                writer.upsert(new MemoryProjectionWriter.ProjectionCommand(owner, source.kind(), source.id(),
                        null, source.content(), source.date(), List.of(), List.of(), 0.5,
                        MemoryProvenanceEnvelope.empty()), null);
                repaired++;
            } catch (RuntimeException failure) {
                log.warn("Canonical source repair failed for {} {}", source.kind(), source.id(), failure);
            }
        }
        return repaired;
    }
}
