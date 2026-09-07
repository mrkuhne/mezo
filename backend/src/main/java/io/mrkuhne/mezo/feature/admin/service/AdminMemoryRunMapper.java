package io.mrkuhne.mezo.feature.admin.service;

import io.mrkuhne.mezo.api.dto.AdminMemoryCandidate;
import io.mrkuhne.mezo.api.dto.AdminMemoryFusionConfig;
import io.mrkuhne.mezo.api.dto.AdminMemoryRetrieverTrace;
import io.mrkuhne.mezo.api.dto.AdminMemoryRunSummary;
import io.mrkuhne.mezo.api.dto.AdminMemoryScoreBreakdown;
import io.mrkuhne.mezo.feature.companion.memory.config.MemoryPlatformProperties;
import io.mrkuhne.mezo.feature.companion.memory.dto.MemoryCandidate;
import io.mrkuhne.mezo.feature.companion.memory.dto.PreparedMemoryQuery;
import io.mrkuhne.mezo.feature.companion.memory.dto.QueryMode;
import io.mrkuhne.mezo.feature.companion.memory.dto.RetrievalServingMode;
import io.mrkuhne.mezo.feature.companion.memory.dto.ScoreBreakdown;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryRetrievalResultEntity;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryRetrievalRunEntity;
import io.mrkuhne.mezo.feature.companion.memory.entity.ScoreBreakdownEnvelope;
import io.mrkuhne.mezo.feature.companion.memory.service.MemoryCandidateFusion.FusedCandidate;
import io.mrkuhne.mezo.feature.companion.memory.service.MemoryContextService.RetrievalOutcome;
import io.mrkuhne.mezo.feature.companion.memory.service.MemoryRetrievalAuditWriter;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.stereotype.Service;

/**
 * Stored rows + live fusion config → the explorer's run-detail DTOs (mezo-4qyt).
 *
 * <p>{@code fusionRank} is DERIVED, not stored. The pipeline's persisted
 * {@code ScoreBreakdownEnvelope.rerankerScore} is {@code 1 / postRerankRank}
 * ({@code MemoryRetrievalAuditWriter}) — a restatement of the stored {@code rank}, not a model
 * relevance score — so the "signed rank delta" the surface promises has to come from somewhere
 * else. It comes from re-sorting the stored candidates with the EXACT comparator
 * {@code MemoryCandidateFusion} sorts with (finalScore desc, occurredOn desc nulls-last,
 * candidateRefId asc): that reconstructs the deterministic pre-rerank order from data that is
 * stored, and {@code rerankDelta = fusionRank - rank} is then real.
 *
 * <p>If the comparator in {@code MemoryCandidateFusion} ever changes, THIS must change with it;
 * {@code AdminMemoryRunMapperTest} pins the two orders against a hand-built fixture.
 */
@Service
public class AdminMemoryRunMapper {

    private static final Comparator<MemoryRetrievalResultEntity> FUSION_ORDER = Comparator
            .comparingDouble((MemoryRetrievalResultEntity r) -> finalScore(r.getScoreBreakdown()))
            .reversed()
            .thenComparing(MemoryRetrievalResultEntity::getOccurredOn,
                    Comparator.nullsLast(Comparator.reverseOrder()))
            .thenComparing(MemoryRetrievalResultEntity::getCandidateRefId);

    /** The same order over LIVE fused candidates, for the dry run (there are no stored rows). */
    private static final Comparator<FusedCandidate> LIVE_FUSION_ORDER = Comparator
            .comparingDouble((FusedCandidate item) -> item.score().finalScore())
            .reversed()
            .thenComparing(item -> item.candidate().occurredOn(),
                    Comparator.nullsLast(Comparator.reverseOrder()))
            .thenComparing(item -> item.candidate().stableId());

    /** One stored run as a list row; the two counts come from the caller's grouped count. */
    public AdminMemoryRunSummary summary(
            MemoryRetrievalRunEntity run, long candidateCount, long selectedCount) {
        return AdminMemoryRunSummary.builder()
                .id(run.getId())
                .createdAt(utc(run.getCreatedAt()))
                .consumerPolicy(run.getConsumerPolicy())
                .servingMode(run.getServingMode())
                .queryMode(run.getQueryMode())
                .rawQuery(run.getRawQuery())
                .rewrittenQuery(run.getRewrittenQuery())
                .candidateCount((int) candidateCount)
                .selectedCount((int) selectedCount)
                .durationMs(run.getDurationMs())
                .embeddingVersion(run.getEmbeddingVersion())
                .shadowEmbeddingVersion(run.getShadowEmbeddingVersion())
                .errorCode(run.getErrorCode())
                .traceId(run.getTraceId())
                .retrieverTrace(trace(run.getRetrieverTrace()))
                .build();
    }

    /**
     * The dry run's summary row (mezo-4qyt). {@code id} is null because no audit row exists (D1),
     * and {@code queryMode} is derived with the SAME rule the audit writer applies, so a replay
     * and a stored run are read the same way.
     */
    public AdminMemoryRunSummary dryRunSummary(
            RetrievalOutcome outcome,
            String consumerPolicy,
            String embeddingVersion,
            int selectedCount) {
        PreparedMemoryQuery query = outcome.query();
        String rewritten = rewrittenQuery(query);
        return AdminMemoryRunSummary.builder()
                .id(null)
                .createdAt(OffsetDateTime.now(ZoneOffset.UTC))
                .consumerPolicy(consumerPolicy)
                .servingMode(RetrievalServingMode.NEW.name())
                .queryMode(queryMode(query, rewritten))
                .rawQuery(query.rawQuery())
                .rewrittenQuery(rewritten)
                .candidateCount(outcome.ranked().size())
                .selectedCount(selectedCount)
                .durationMs(outcome.durationMs())
                .embeddingVersion(embeddingVersion)
                .shadowEmbeddingVersion(null)
                .errorCode(outcome.errorCode())
                .traceId(outcome.context().traceId())
                .retrieverTrace(trace(outcome.retrieverTrace()))
                .build();
    }

    private static String queryMode(PreparedMemoryQuery query, String rewritten) {
        if (query.mode() == QueryMode.NO_MEMORY_NEEDED) {
            return "NONE";
        }
        return rewritten == null ? "RAW" : "REWRITE";
    }

    private static String rewrittenQuery(PreparedMemoryQuery query) {
        return query.denseQuery().equals(query.rawQuery()) ? null : query.denseQuery();
    }

    /** The retriever_trace jsonb map → a stable, name-sorted list the client can render as a strip. */
    public List<AdminMemoryRetrieverTrace> trace(Map<String, Object> retrieverTrace) {
        if (retrieverTrace == null || retrieverTrace.isEmpty()) {
            return List.of();
        }
        List<AdminMemoryRetrieverTrace> rows = new ArrayList<>(retrieverTrace.size());
        retrieverTrace.entrySet().stream()
                .sorted(Map.Entry.comparingByKey())
                .forEach(entry -> {
                    // Only the per-retriever entries are objects; a legacy scalar entry (e.g. the
                    // populator's "denseCandidates": 1) is not a retriever and is skipped rather
                    // than rendered as a zero-duration retriever that never ran.
                    if (!(entry.getValue() instanceof Map<?, ?> details)) {
                        return;
                    }
                    rows.add(AdminMemoryRetrieverTrace.builder()
                            .retriever(entry.getKey())
                            .durationMs(longValue(details.get("durationMs")))
                            .candidateCount(intValue(details.get("candidateCount")))
                            .error(details.get("error") == null ? null : details.get("error").toString())
                            .build());
                });
        return List.copyOf(rows);
    }

    /** Today's live fusion config — never a copy kept under {@code mezo.admin.memory}. */
    public AdminMemoryFusionConfig fusion(MemoryPlatformProperties.Fusion config) {
        return AdminMemoryFusionConfig.builder()
                .rrfK(config.rrfConstant())
                .retrieverWeights(Map.copyOf(config.retrieverWeights()))
                .pinnedBoost(config.pinnedBoost())
                .sourceReliabilityMaxBoost(config.sourceReliabilityMaxBoost())
                .temporalMaxBoost(config.temporalMaxBoost())
                .salienceMaxAdjustment(config.salienceMaxAdjustment())
                .recencyMaxBoost(config.recencyMaxBoost())
                .build();
    }

    /** Stored candidates in stored rank order, each carrying its derived fusion rank. */
    public List<AdminMemoryCandidate> candidates(List<MemoryRetrievalResultEntity> rows) {
        List<MemoryRetrievalResultEntity> fusionOrder = rows.stream().sorted(FUSION_ORDER).toList();
        Map<UUID, Integer> fusionRankByRef = new HashMap<>();
        for (int i = 0; i < fusionOrder.size(); i++) {
            fusionRankByRef.put(fusionOrder.get(i).getCandidateRefId(), i + 1);
        }
        boolean reranked = rows.stream()
                .anyMatch(row -> row.getScoreBreakdown() != null
                        && row.getScoreBreakdown().rerankerScore() != null);
        return rows.stream().map(row -> {
            int fusionRank = fusionRankByRef.get(row.getCandidateRefId());
            return AdminMemoryCandidate.builder()
                    .resultId(row.getId())
                    .rank(row.getRank())
                    .fusionRank(fusionRank)
                    .rerankDelta(reranked ? fusionRank - row.getRank() : null)
                    .selected(row.isSelected())
                    .candidateKind(row.getCandidateKind())
                    .candidateRefId(row.getCandidateRefId())
                    .memoryItemId(row.getMemoryItemId())
                    .contentSnapshot(row.getContentSnapshot())
                    .occurredOn(row.getOccurredOn())
                    .scoreBreakdown(scoreBreakdown(row.getScoreBreakdown()))
                    .build();
        }).toList();
    }

    /**
     * The dry run's candidates, mapped from the LIVE fused list rather than from stored rows
     * (mezo-4qyt). No audit row exists (D1), so {@code resultId} is null and {@code rerankDelta}
     * is derived against the fused order the outcome itself carries. The pipeline's post-rerank
     * order IS the incoming list order, so {@code rank} is the 1-based index.
     */
    public List<AdminMemoryCandidate> dryRunCandidates(
            List<FusedCandidate> ranked, Set<MemoryRetrievalAuditWriter.CandidateIdentity> selected,
            boolean reranked) {
        List<FusedCandidate> fusionOrder = ranked.stream().sorted(LIVE_FUSION_ORDER).toList();
        Map<UUID, Integer> fusionRankByRef = new HashMap<>();
        for (int i = 0; i < fusionOrder.size(); i++) {
            fusionRankByRef.put(fusionOrder.get(i).candidate().stableId(), i + 1);
        }
        List<AdminMemoryCandidate> rows = new ArrayList<>(ranked.size());
        for (int i = 0; i < ranked.size(); i++) {
            FusedCandidate fused = ranked.get(i);
            MemoryCandidate candidate = fused.candidate();
            int rank = i + 1;
            int fusionRank = fusionRankByRef.get(candidate.stableId());
            rows.add(AdminMemoryCandidate.builder()
                    .resultId(null)
                    .rank(rank)
                    .fusionRank(fusionRank)
                    .rerankDelta(reranked ? fusionRank - rank : null)
                    .selected(selected.contains(
                            MemoryRetrievalAuditWriter.identity(candidate)))
                    .candidateKind(candidate.candidateKind())
                    .candidateRefId(candidate.stableId())
                    .memoryItemId(candidate.memoryItemId())
                    .contentSnapshot(candidate.content())
                    .occurredOn(candidate.occurredOn())
                    .scoreBreakdown(liveScoreBreakdown(fused, reranked, rank))
                    .build());
        }
        return List.copyOf(rows);
    }

    /**
     * The live equivalent of the persisted envelope. {@code rerankerScore} mirrors what the audit
     * writer WOULD have stored ({@code 1/postRerankRank}) so a dry run and a stored run render
     * identically — including the caveat that this is a rank restatement, not a model score.
     */
    private AdminMemoryScoreBreakdown liveScoreBreakdown(
            FusedCandidate fused, boolean reranked, int rank) {
        ScoreBreakdown score = fused.score();
        return AdminMemoryScoreBreakdown.builder()
                .retrieverRanks(Map.copyOf(fused.retrieverRanks()))
                .rrf(score.rrf())
                .pinnedBoost(score.pinned())
                .sourceReliabilityBoost(score.sourceReliability())
                .temporalBoost(score.temporal())
                .salienceBoost(score.salience())
                .recencyBoost(score.recency())
                .rerankerScore(reranked ? 1.0 / rank : null)
                .finalScore(score.finalScore())
                .build();
    }

    /**
     * An ABSENT retriever key stays absent: "the retriever did not return this candidate" and "it
     * ranked it 0th" are different facts, and only the first one is true.
     */
    public AdminMemoryScoreBreakdown scoreBreakdown(ScoreBreakdownEnvelope envelope) {
        ScoreBreakdownEnvelope source = envelope == null ? ScoreBreakdownEnvelope.empty() : envelope;
        return AdminMemoryScoreBreakdown.builder()
                .retrieverRanks(source.retrieverRanks() == null
                        ? Map.of() : Map.copyOf(source.retrieverRanks()))
                .rrf(source.rrf() == null ? 0.0 : source.rrf())
                .pinnedBoost(source.pinnedBoost())
                .sourceReliabilityBoost(source.sourceReliabilityBoost())
                .temporalBoost(source.temporalBoost())
                .salienceBoost(source.salienceBoost())
                .recencyBoost(source.recencyBoost())
                .rerankerScore(source.rerankerScore())
                .finalScore(finalScore(source))
                .build();
    }

    private static double finalScore(ScoreBreakdownEnvelope envelope) {
        return envelope == null || envelope.finalScore() == null ? 0.0 : envelope.finalScore();
    }

    private static long longValue(Object value) {
        return value instanceof Number number ? number.longValue() : 0L;
    }

    private static int intValue(Object value) {
        return value instanceof Number number ? number.intValue() : 0;
    }

    private static OffsetDateTime utc(Instant instant) {
        return instant == null ? null : OffsetDateTime.ofInstant(instant, ZoneOffset.UTC);
    }
}
