package io.mrkuhne.mezo.feature.companion.service;

import io.mrkuhne.mezo.feature.companion.EmbeddingPort;
import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import io.mrkuhne.mezo.feature.companion.entity.MemoryEmbeddingEntity;
import io.mrkuhne.mezo.feature.companion.repository.MemoryEmbeddingRepository;
import io.mrkuhne.mezo.feature.companion.repository.MemoryEmbeddingRepository.MemoryMatch;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

/**
 * V2.3 episodic recall: "volt már ilyen napod?" — ANN cosine search over the daily-summary
 * vectors, re-ranked in code by {@code similarity × exp(-age/τ)} (cosine alone is time-blind —
 * spec §7). Recall is DAILY-SUMMARY-scoped: the tool answers about past DAYS, and the summaries
 * are the narrative units the V2.2 pipeline fills; chat-turn vectors stay for a later always-on
 * recall layer (roadmap V2.3 out-scope). Raw-similarity floor keeps weak matches out — an
 * honest "nincs adat" beats a fabricated resemblance.
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class MemoryRecallService {

    /** One recalled episode: the day, its narrative, the raw match and the recency-decayed score. */
    public record RecalledMemory(LocalDate occurredOn, String content, double similarity, double score) {}

    private final EmbeddingPort embeddingPort;
    private final MemoryEmbeddingRepository memoryEmbeddingRepository;
    private final CompanionProperties properties;

    // No @Transactional: the native-query interface projection is fully materialized (no LAZY
    // traversal), and skipping the tx keeps the connection free during the embed network call.
    public List<RecalledMemory> recallSimilarDays(UUID userId, String query, int k) {
        CompanionProperties.Recall recall = properties.recall();
        List<MemoryMatch> candidates = memoryEmbeddingRepository.findNearest(userId,
                MemoryEmbeddingEntity.KIND_DAILY_SUMMARY,
                MemoryEmbeddingRepository.toVectorLiteral(embeddingPort.embedQuery(query)),
                recall.candidatePool());
        LocalDate today = LocalDate.now();
        return candidates.stream()
                .map(match -> toRecalled(match, today, recall.decayDays()))
                .filter(memory -> memory.similarity() >= recall.minSimilarity())
                .sorted(Comparator.comparingDouble(RecalledMemory::score).reversed())
                .limit(Math.clamp(k, 1, recall.maxK()))
                .toList();
    }

    private static RecalledMemory toRecalled(MemoryMatch match, LocalDate today, int decayDays) {
        double similarity = 1.0 - match.getDistance();
        long ageDays = Math.max(0, ChronoUnit.DAYS.between(match.getOccurredOn(), today));
        double score = similarity * Math.exp(-(double) ageDays / decayDays);
        return new RecalledMemory(match.getOccurredOn(), match.getContent(), similarity, score);
    }
}
