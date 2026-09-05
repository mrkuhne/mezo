package io.mrkuhne.mezo.feature.companion.memory.service;

import io.mrkuhne.mezo.feature.companion.memory.config.MemoryPlatformProperties;
import io.mrkuhne.mezo.feature.companion.memory.dto.MemoryCandidate;
import io.mrkuhne.mezo.feature.companion.memory.dto.PreparedMemoryQuery;
import io.mrkuhne.mezo.feature.companion.memory.dto.ScoreBreakdown;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

/** Weighted reciprocal-rank fusion with bounded, fully explainable deterministic modifiers. */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class MemoryCandidateFusion {

    private final MemoryPlatformProperties properties;

    public List<FusedCandidate> fuse(
            Map<String, List<MemoryCandidate>> rankedByRetriever,
            PreparedMemoryQuery query,
            LocalDate asOf) {
        Map<CandidateKey, MutableFused> fused = new LinkedHashMap<>();
        MemoryPlatformProperties.Fusion config = properties.fusion();

        rankedByRetriever.forEach((retriever, candidates) -> {
            double weight = config.retrieverWeights().getOrDefault(retriever, 1.0);
            for (int index = 0; index < candidates.size(); index++) {
                MemoryCandidate candidate = candidates.get(index);
                CandidateKey key = new CandidateKey(candidate.candidateKind(), candidate.stableId());
                MutableFused value = fused.computeIfAbsent(key, ignored -> new MutableFused(candidate));
                int rank = index + 1;
                value.rrf += weight / (config.rrfConstant() + rank);
                value.retrieverRanks.put(retriever, rank);
                value.mergeEvidence(candidate);
            }
        });

        List<FusedCandidate> result = new ArrayList<>(fused.size());
        for (MutableFused value : fused.values()) {
            MemoryCandidate candidate = value.candidate;
            double temporal = temporal(candidate, query, config.temporalMaxBoost());
            double salience = Math.clamp((candidate.salience() - 0.5) * 2.0
                    * config.salienceMaxAdjustment(), -config.salienceMaxAdjustment(), config.salienceMaxAdjustment());
            double sourceReliability = sourceReliability(candidate.sourceKind())
                    * config.sourceReliabilityMaxBoost();
            double pinned = candidate.pinned() ? config.pinnedBoost() : 0.0;
            double recency = recency(candidate.occurredOn(), asOf, config.recencyMaxBoost());
            double finalScore = value.rrf + temporal + salience + sourceReliability + pinned + recency;
            ScoreBreakdown score = new ScoreBreakdown(
                    value.rrf, temporal, salience, sourceReliability, pinned, recency, finalScore);
            result.add(new FusedCandidate(candidate, score, Map.copyOf(value.retrieverRanks)));
        }

        result.sort(Comparator
                .comparingDouble((FusedCandidate item) -> item.score().finalScore()).reversed()
                .thenComparing(item -> item.candidate().occurredOn(), Comparator.nullsLast(Comparator.reverseOrder()))
                .thenComparing(item -> item.candidate().stableId()));
        return List.copyOf(result);
    }

    private double recency(LocalDate occurredOn, LocalDate asOf, double maximum) {
        if (occurredOn == null || asOf == null || occurredOn.isAfter(asOf)) {
            return 0.0;
        }
        long age = ChronoUnit.DAYS.between(occurredOn, asOf);
        double fraction = 1.0 - Math.min(1.0, age / (double) properties.indicators().oldAfterDays());
        return maximum * fraction;
    }

    private static double temporal(MemoryCandidate candidate, PreparedMemoryQuery query, double maximum) {
        LocalDate occurredOn = candidate.occurredOn();
        if (occurredOn == null || query.from().isEmpty() && query.to().isEmpty()) {
            return 0.0;
        }
        boolean afterFrom = query.from().map(from -> !occurredOn.isBefore(from)).orElse(true);
        boolean beforeTo = query.to().map(to -> !occurredOn.isAfter(to)).orElse(true);
        return afterFrom && beforeTo ? maximum : 0.0;
    }

    private static double sourceReliability(String sourceKind) {
        return switch (sourceKind) {
            case "knowledge_fact" -> 1.0;
            case "journal_entry", "decision", "gratitude", "daily_summary",
                    "weekly_summary", "monthly_summary" -> 0.75;
            case "knowledge_edge" -> 0.60;
            default -> 0.50;
        };
    }

    public record FusedCandidate(
            MemoryCandidate candidate,
            ScoreBreakdown score,
            Map<String, Integer> retrieverRanks) {
    }

    private record CandidateKey(String candidateKind, UUID stableId) {
    }

    private static final class MutableFused {
        private MemoryCandidate candidate;
        private double rrf;
        private final Map<String, Integer> retrieverRanks = new LinkedHashMap<>();

        private MutableFused(MemoryCandidate candidate) {
            this.candidate = candidate;
        }

        private void mergeEvidence(MemoryCandidate other) {
            candidate = new MemoryCandidate(
                    candidate.retriever(), candidate.candidateKind(), candidate.stableId(),
                    candidate.memoryItemId(), candidate.sourceId(), candidate.sourceKind(),
                    candidate.label(), candidate.content(), candidate.occurredOn(),
                    Math.max(candidate.localScore(), other.localScore()),
                    candidate.pinned() || other.pinned(), candidate.conflicting() || other.conflicting(),
                    Math.max(candidate.salience(), other.salience()),
                    candidate.diversityGroupId() != null
                            ? candidate.diversityGroupId() : other.diversityGroupId(),
                    candidate.conflictingWithId() != null
                            ? candidate.conflictingWithId() : other.conflictingWithId());
        }
    }
}
