package io.mrkuhne.mezo.feature.companion.memory.service;

import io.mrkuhne.mezo.feature.companion.memory.dto.MemoryCandidate;
import io.mrkuhne.mezo.feature.companion.memory.dto.MemoryRequest;
import io.mrkuhne.mezo.feature.companion.memory.dto.PreparedMemoryQuery;
import io.mrkuhne.mezo.feature.companion.memory.dto.QueryMode;
import io.mrkuhne.mezo.feature.companion.memory.dto.RetrievalServingMode;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryRetrievalResultEntity;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryRetrievalRunEntity;
import io.mrkuhne.mezo.feature.companion.memory.entity.ScoreBreakdownEnvelope;
import io.mrkuhne.mezo.feature.companion.memory.repository.MemoryRetrievalResultRepository;
import io.mrkuhne.mezo.feature.companion.memory.repository.MemoryRetrievalRunRepository;
import io.mrkuhne.mezo.feature.companion.memory.service.MemoryCandidateFusion.FusedCandidate;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/** Persists complete retrieval traces independently from the later chat-model transaction. */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class MemoryRetrievalAuditWriter {

    private final MemoryRetrievalRunRepository runRepository;
    private final MemoryRetrievalResultRepository resultRepository;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public AuditResult write(AuditCommand command) {
        UUID traceId = UUID.randomUUID();
        MemoryRetrievalRunEntity run = new MemoryRetrievalRunEntity();
        run.setCreatedBy(command.request().userId());
        run.setConsumerPolicy(command.request().consumerPolicy().name());
        run.setQueryMode(queryMode(command.query()));
        run.setRawQuery(command.query().rawQuery());
        run.setRewrittenQuery(rewrittenQuery(command.query()));
        run.setEmbeddingVersion(command.embeddingVersion());
        run.setShadowEmbeddingVersion(command.shadowEmbeddingVersion());
        run.setServingMode(command.servingMode().name());
        run.setDurationMs(command.durationMs());
        run.setRetrieverTrace(command.retrieverTrace());
        run.setErrorCode(command.errorCode());
        run.setTraceId(traceId);
        run = runRepository.saveAndFlush(run);

        Set<CandidateIdentity> selected = new HashSet<>(command.selected());
        List<MemoryRetrievalResultEntity> rows = new ArrayList<>();
        for (int index = 0; index < command.ranked().size(); index++) {
            FusedCandidate fused = command.ranked().get(index);
            MemoryCandidate candidate = fused.candidate();
            MemoryRetrievalResultEntity row = new MemoryRetrievalResultEntity();
            row.setCreatedBy(command.request().userId());
            row.setRunId(run.getId());
            row.setCandidateKind(candidate.candidateKind());
            row.setCandidateRefId(candidate.stableId());
            row.setMemoryItemId(candidate.memoryItemId());
            row.setRank(index + 1);
            row.setSelected(selected.contains(identity(candidate)));
            row.setContentSnapshot(candidate.content());
            row.setOccurredOn(candidate.occurredOn());
            Double rerankerScore = command.reranked() ? 1.0 / (index + 1.0) : null;
            row.setScoreBreakdown(new ScoreBreakdownEnvelope(
                    fused.retrieverRanks(), fused.score().rrf(), fused.score().pinned(),
                    fused.score().sourceReliability(), fused.score().temporal(), fused.score().salience(),
                    fused.score().recency(), rerankerScore, fused.score().finalScore()));
            rows.add(row);
        }
        List<MemoryRetrievalResultEntity> persisted = resultRepository.saveAllAndFlush(rows);
        Map<CandidateIdentity, UUID> resultIds = new HashMap<>();
        persisted.forEach(row -> resultIds.put(
                new CandidateIdentity(row.getCandidateKind(), row.getCandidateRefId()), row.getId()));
        return new AuditResult(run.getId(), traceId, Map.copyOf(resultIds));
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public int hardDeleteExpired(UUID userId, Instant cutoff) {
        return runRepository.hardDeleteByCreatedByAndCreatedAtBefore(userId, cutoff);
    }

    public static CandidateIdentity identity(MemoryCandidate candidate) {
        return new CandidateIdentity(candidate.candidateKind(), candidate.stableId());
    }

    private static String queryMode(PreparedMemoryQuery query) {
        if (query.mode() == QueryMode.NO_MEMORY_NEEDED) {
            return "NONE";
        }
        return rewrittenQuery(query) == null ? "RAW" : "REWRITE";
    }

    private static String rewrittenQuery(PreparedMemoryQuery query) {
        return query.denseQuery().equals(query.rawQuery()) ? null : query.denseQuery();
    }

    public record AuditCommand(
            MemoryRequest request,
            PreparedMemoryQuery query,
            String embeddingVersion,
            String shadowEmbeddingVersion,
            RetrievalServingMode servingMode,
            long durationMs,
            Map<String, Object> retrieverTrace,
            String errorCode,
            List<FusedCandidate> ranked,
            List<CandidateIdentity> selected,
            boolean reranked) {
    }

    public record AuditResult(UUID runId, UUID traceId, Map<CandidateIdentity, UUID> resultIds) {
    }

    public record CandidateIdentity(String candidateKind, UUID stableId) {
    }
}
