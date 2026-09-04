package io.mrkuhne.mezo.feature.companion.memory.service;

import io.mrkuhne.mezo.feature.companion.EmbeddingPort;
import io.mrkuhne.mezo.feature.companion.memory.config.MemoryPlatformProperties;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryItemEntity;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryProvenanceEnvelope;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryVectorEntity;
import io.mrkuhne.mezo.feature.companion.memory.repository.MemoryItemRepository;
import io.mrkuhne.mezo.feature.companion.memory.repository.MemoryVectorRepository;
import io.mrkuhne.mezo.feature.companion.tools.ToolText;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDate;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** Idempotent projection of source narratives into canonical items and vector generations. */
@Service
@RequiredArgsConstructor
public class MemoryProjectionWriter {

    private final MemoryItemRepository itemRepository;
    private final MemoryVectorRepository vectorRepository;
    private final MemoryPlatformProperties properties;

    public record ProjectionCommand(
            UUID userId,
            String sourceKind,
            UUID sourceId,
            String title,
            String content,
            LocalDate occurredOn,
            List<String> topics,
            List<String> people,
            double salience,
            MemoryProvenanceEnvelope provenance) {
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public MemoryItemEntity upsert(ProjectionCommand command, float[] embedding) {
        String contentHash = sha256(command.content());
        MemoryItemEntity item = itemRepository
                .findByCreatedByAndSourceKindAndSourceId(
                        command.userId(), command.sourceKind(), command.sourceId())
                .orElseGet(MemoryItemEntity::new);
        var currentVector = item.getId() == null ? null : vectorRepository
                .findByOwnerItemAndVersionIncludingDeleted(
                        command.userId(), item.getId(), properties.servingEmbeddingVersion())
                .orElse(null);
        if (contentHash.equals(item.getContentHash())
                && currentVector != null
                && !currentVector.isDeleted()
                && MemoryVectorEntity.STATUS_READY.equals(currentVector.getStatus())) {
            return item;
        }

        item.setCreatedBy(command.userId());
        item.setSourceKind(command.sourceKind());
        item.setSourceId(command.sourceId());
        item.setTitle(command.title());
        item.setContent(command.content());
        item.setSearchText(ToolText.fold(command.content()));
        item.setOccurredOn(command.occurredOn());
        item.setContentHash(contentHash);
        item.setSchemaVersion(properties.schemaVersion());
        item.setTopics(command.topics() == null ? List.of() : command.topics());
        item.setPeople(command.people() == null ? List.of() : command.people());
        item.setSalience(BigDecimal.valueOf(command.salience()));
        item.setProvenance(command.provenance() == null
                ? MemoryProvenanceEnvelope.empty() : command.provenance());
        item.setState(MemoryItemEntity.STATE_ACTIVE);
        item.setDeleted(false);
        item = itemRepository.saveAndFlush(item);

        MemoryVectorEntity vector = currentVector == null ? new MemoryVectorEntity() : currentVector;
        vector.setCreatedBy(command.userId());
        vector.setMemoryItemId(item.getId());
        vector.setEmbeddingVersion(properties.servingEmbeddingVersion());
        vector.setProvider(properties.embeddingProvider());
        vector.setModel(properties.embeddingModel());
        vector.setDimensions((short) EmbeddingPort.DIMENSIONS);
        vector.setEmbedding(embedding);
        vector.setEmbeddedContentHash(contentHash);
        vector.setStatus(MemoryVectorEntity.STATUS_READY);
        vector.setFailureCode(null);
        vector.setDeleted(false);
        vectorRepository.saveAndFlush(vector);
        return item;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void suppress(UUID userId, String sourceKind, UUID sourceId) {
        itemRepository.findByCreatedByAndSourceKindAndSourceId(userId, sourceKind, sourceId)
                .ifPresent(item -> {
                    vectorRepository.findByCreatedByAndMemoryItemIdOrderByEmbeddingVersion(userId, item.getId())
                            .forEach(vectorRepository::delete);
                    vectorRepository.flush();
                    item.setState(MemoryItemEntity.STATE_SUPPRESSED);
                    itemRepository.saveAndFlush(item);
                });
    }

    static String sha256(String value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException e) {
            throw new SystemRuntimeErrorException(SystemMessage.error("INTERNAL_ERROR").build());
        }
    }
}
