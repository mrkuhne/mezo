package io.mrkuhne.mezo.feature.companion.memory.service;

import io.mrkuhne.mezo.feature.companion.EmbeddingPort;
import io.mrkuhne.mezo.feature.companion.memory.config.MemoryPlatformProperties;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryItemEntity;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryVectorEntity;
import io.mrkuhne.mezo.feature.companion.memory.repository.MemoryItemRepository;
import io.mrkuhne.mezo.feature.companion.memory.repository.MemoryVectorRepository;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContext;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContextHolder;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Resumable, generation-specific embedding backfill that never changes the serving version. */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class MemoryReembeddingService {

    public static final String FAILURE_PROVIDER = "EMBEDDING_PROVIDER_FAILURE";
    public static final String FAILURE_INVALID_RESPONSE = "EMBEDDING_INVALID_RESPONSE";

    private final MemoryItemRepository itemRepository;
    private final MemoryVectorRepository vectorRepository;
    private final MemoryPlatformProperties properties;
    private final EmbeddingPort embeddingPort;
    private final LlmCallContextHolder llmCallContextHolder;

    public record ReembeddingResult(int selected, int ready, int failed) {
    }

    @Transactional
    public ReembeddingResult reembedMissing(UUID userId, String targetVersion, int batchSize) {
        List<MemoryItemEntity> items = itemRepository.findReembeddingCandidates(
                userId, targetVersion, batchSize);
        if (items.isEmpty()) {
            return new ReembeddingResult(0, 0, 0);
        }

        List<MemoryVectorEntity> vectors = new ArrayList<>(items.size());
        for (MemoryItemEntity item : items) {
            MemoryVectorEntity vector = vectorRepository
                    .findByOwnerItemAndVersionIncludingDeleted(userId, item.getId(), targetVersion)
                    .orElseGet(MemoryVectorEntity::new);
            preparePending(vector, item, targetVersion);
            vectors.add(vector);
        }
        vectorRepository.saveAllAndFlush(vectors);

        List<float[]> embeddings;
        try {
            embeddings = llmCallContextHolder.runWith(
                    new LlmCallContext("embed_memory", "reembedding_batch", "memory_item", null),
                    () -> embeddingPort.embedDocuments(items.stream()
                            .map(MemoryItemEntity::getContent)
                            .toList()));
        } catch (RuntimeException e) {
            markFailed(vectors, FAILURE_PROVIDER);
            return new ReembeddingResult(items.size(), 0, items.size());
        }
        if (!validResponse(embeddings, items.size())) {
            markFailed(vectors, FAILURE_INVALID_RESPONSE);
            return new ReembeddingResult(items.size(), 0, items.size());
        }

        for (int i = 0; i < vectors.size(); i++) {
            MemoryVectorEntity vector = vectors.get(i);
            vector.setEmbedding(embeddings.get(i));
            vector.setStatus(MemoryVectorEntity.STATUS_READY);
            vector.setFailureCode(null);
        }
        vectorRepository.saveAllAndFlush(vectors);
        return new ReembeddingResult(items.size(), items.size(), 0);
    }

    private void preparePending(MemoryVectorEntity vector, MemoryItemEntity item, String targetVersion) {
        vector.setCreatedBy(item.getCreatedBy());
        vector.setMemoryItemId(item.getId());
        vector.setEmbeddingVersion(targetVersion);
        vector.setProvider(properties.embeddingProvider());
        vector.setModel(properties.embeddingModel());
        vector.setDimensions((short) EmbeddingPort.DIMENSIONS);
        vector.setEmbedding(null);
        vector.setEmbeddedContentHash(item.getContentHash());
        vector.setStatus(MemoryVectorEntity.STATUS_PENDING);
        vector.setFailureCode(null);
        vector.setDeleted(false);
    }

    private void markFailed(List<MemoryVectorEntity> vectors, String failureCode) {
        vectors.forEach(vector -> {
            vector.setEmbedding(null);
            vector.setStatus(MemoryVectorEntity.STATUS_FAILED);
            vector.setFailureCode(failureCode);
        });
        vectorRepository.saveAllAndFlush(vectors);
    }

    private static boolean validResponse(List<float[]> embeddings, int expectedSize) {
        return embeddings != null
                && embeddings.size() == expectedSize
                && embeddings.stream().allMatch(vector -> vector != null
                        && vector.length == EmbeddingPort.DIMENSIONS);
    }
}
