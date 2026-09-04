package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryItemEntity;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryProvenanceEnvelope;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryRetrievalFeedbackEntity;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryRetrievalResultEntity;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryRetrievalRunEntity;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryVectorEntity;
import io.mrkuhne.mezo.feature.companion.memory.entity.ScoreBreakdownEnvelope;
import io.mrkuhne.mezo.feature.companion.memory.repository.MemoryItemRepository;
import io.mrkuhne.mezo.feature.companion.memory.repository.MemoryRetrievalFeedbackRepository;
import io.mrkuhne.mezo.feature.companion.memory.repository.MemoryRetrievalResultRepository;
import io.mrkuhne.mezo.feature.companion.memory.repository.MemoryRetrievalRunRepository;
import io.mrkuhne.mezo.feature.companion.memory.repository.MemoryVectorRepository;
import io.mrkuhne.mezo.feature.companion.tools.ToolText;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDate;
import java.util.Arrays;
import java.util.HexFormat;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;

@TestComponent
@RequiredArgsConstructor
public class MemoryItemPopulator {

    private final MemoryItemRepository itemRepository;
    private final MemoryVectorRepository vectorRepository;
    private final MemoryRetrievalRunRepository runRepository;
    private final MemoryRetrievalResultRepository resultRepository;
    private final MemoryRetrievalFeedbackRepository feedbackRepository;

    public MemoryItemEntity item(UUID createdBy, String sourceKind, UUID sourceId,
                                 String content, LocalDate occurredOn) {
        return item(createdBy, sourceKind, sourceId, null, content, occurredOn,
                new String[0], new String[0], MemoryProvenanceEnvelope.empty());
    }

    public MemoryItemEntity item(UUID createdBy, String sourceKind, UUID sourceId,
                                 String title, String content, LocalDate occurredOn,
                                 String[] topics, String[] people,
                                 MemoryProvenanceEnvelope provenance) {
        MemoryItemEntity entity = new MemoryItemEntity();
        entity.setCreatedBy(createdBy);
        entity.setSourceKind(sourceKind);
        entity.setSourceId(sourceId);
        entity.setTitle(title);
        entity.setContent(content);
        entity.setSearchText(ToolText.fold(content));
        entity.setOccurredOn(occurredOn);
        entity.setContentHash(sha256(content));
        entity.setSchemaVersion(1);
        entity.setTopics(Arrays.asList(topics));
        entity.setPeople(Arrays.asList(people));
        entity.setProvenance(provenance);
        return itemRepository.saveAndFlush(entity);
    }

    public MemoryVectorEntity vector(MemoryItemEntity item, String embeddingVersion, float[] embedding) {
        MemoryVectorEntity entity = new MemoryVectorEntity();
        entity.setCreatedBy(item.getCreatedBy());
        entity.setMemoryItemId(item.getId());
        entity.setEmbeddingVersion(embeddingVersion);
        entity.setProvider("google");
        entity.setModel("gemini-embedding-001");
        entity.setEmbedding(embedding);
        entity.setEmbeddedContentHash(item.getContentHash());
        entity.setStatus(MemoryVectorEntity.STATUS_READY);
        return vectorRepository.saveAndFlush(entity);
    }

    public MemoryRetrievalRunEntity run(UUID createdBy, UUID traceId) {
        MemoryRetrievalRunEntity entity = new MemoryRetrievalRunEntity();
        entity.setCreatedBy(createdBy);
        entity.setConsumerPolicy("CHAT_AMBIENT");
        entity.setQueryMode("RAW");
        entity.setRawQuery("Hogyan aludtam futás után?");
        entity.setEmbeddingVersion("gemini-embedding-001-768-v1");
        entity.setServingMode("NEW");
        entity.setDurationMs(12L);
        entity.setRetrieverTrace(Map.of("denseCandidates", 1));
        entity.setTraceId(traceId);
        return runRepository.saveAndFlush(entity);
    }

    public MemoryRetrievalResultEntity result(UUID createdBy, MemoryRetrievalRunEntity run,
                                               MemoryItemEntity item, int rank, boolean selected,
                                               ScoreBreakdownEnvelope scoreBreakdown) {
        MemoryRetrievalResultEntity entity = new MemoryRetrievalResultEntity();
        entity.setCreatedBy(createdBy);
        entity.setRunId(run.getId());
        entity.setCandidateKind("memory_item");
        entity.setCandidateRefId(item.getSourceId());
        entity.setMemoryItemId(item.getId());
        entity.setRank(rank);
        entity.setSelected(selected);
        entity.setContentSnapshot(item.getContent());
        entity.setOccurredOn(item.getOccurredOn());
        entity.setScoreBreakdown(scoreBreakdown);
        return resultRepository.saveAndFlush(entity);
    }

    public MemoryRetrievalFeedbackEntity feedback(UUID createdBy, MemoryRetrievalRunEntity run,
                                                   MemoryRetrievalResultEntity result,
                                                   MemoryItemEntity item, String action) {
        MemoryRetrievalFeedbackEntity entity = new MemoryRetrievalFeedbackEntity();
        entity.setCreatedBy(createdBy);
        entity.setRunId(run.getId());
        entity.setResultId(result.getId());
        entity.setMemoryItemId(item.getId());
        entity.setAction(action);
        return feedbackRepository.saveAndFlush(entity);
    }

    private static String sha256(String value) {
        try {
            return HexFormat.of().formatHex(
                    MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 must be available", e);
        }
    }
}
