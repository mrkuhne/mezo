package io.mrkuhne.mezo.feature.companion.graph.service;

import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import io.mrkuhne.mezo.feature.companion.entity.PatternEventEntity;
import io.mrkuhne.mezo.feature.companion.graph.entity.GraphEdgeEntity;
import io.mrkuhne.mezo.feature.companion.graph.entity.GraphNodeEntity;
import io.mrkuhne.mezo.feature.companion.graph.repository.GraphEdgeRepository;
import io.mrkuhne.mezo.feature.companion.graph.repository.GraphNodeRepository;
import io.mrkuhne.mezo.feature.companion.repository.PatternEventRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * W2.5 (bd mezo-b3pp.10, spec §6.5): the nightly maintenance pass over one user's graph — pure
 * arithmetic, no LLM call. {@link #runMaintenance} is one {@code @Transactional} unit of work:
 * (1) every active edge's weight decays by {@code graph.decayFactor}, and any edge that decays
 * under {@code graph.pruneFloor} is soft-deleted in the same pass; (2) candidate nodes older than
 * {@code graph.candidateMaxAgeDays} (never confirmed/rejected by the L2 inbox) are soft-deleted;
 * (3) a promoted PATTERN node with a "fresh" {@code pattern_event} snapshot (within the last day —
 * the nightly {@code PatternDetectionJob}'s own window) has every edge touching it bumped by
 * {@code graph.reinforcementBump}, capped at 1.0, with {@code lastReinforcedAt} stamped.
 *
 * <p>{@link GraphMaintenanceJob} calls this as the first of its three nightly phases, before the
 * W2.2 reconciler and W2.3 extraction — each phase is independently isolated there, so a failure
 * here never blocks the other two.
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.KNOWLEDGE_GRAPH_SWITCH, havingValue = "true")
public class GraphMaintenanceService {

    /** How far back a pattern_event snapshot still counts as "fresh evidence" — one night's
     *  worth, matching the PatternDetectionJob's own nightly cadence. */
    private static final long REINFORCEMENT_FRESHNESS_HOURS = 24;

    private final GraphNodeRepository nodeRepository;
    private final GraphEdgeRepository edgeRepository;
    private final PatternEventRepository patternEventRepository;
    private final CompanionProperties properties;

    @Transactional
    public GraphMaintenanceResult runMaintenance(UUID userId) {
        CompanionProperties.Graph cfg = properties.graph();
        EdgeDecayResult decay = decayAndPruneEdges(userId, cfg.decayFactor(), cfg.pruneFloor());
        int candidatesPruned = pruneStaleCandidates(userId, cfg.candidateMaxAgeDays());
        int edgesReinforced = reinforceFreshPatterns(userId, cfg.reinforcementBump());
        return new GraphMaintenanceResult(
            decay.decayed(), decay.pruned(), candidatesPruned, edgesReinforced);
    }

    private record EdgeDecayResult(int decayed, int pruned) {}

    /** One query loads every active edge; each is decayed and, if it falls under the floor,
     *  soft-deleted in the SAME pass instead of a second floor-prune query re-reading everything. */
    private EdgeDecayResult decayAndPruneEdges(UUID userId, double decayFactor, double pruneFloor) {
        List<GraphEdgeEntity> edges = edgeRepository.findByCreatedByAndDeletedFalse(userId);
        BigDecimal factor = BigDecimal.valueOf(decayFactor);
        BigDecimal floor = BigDecimal.valueOf(pruneFloor);
        int pruned = 0;
        for (GraphEdgeEntity edge : edges) {
            BigDecimal decayed = edge.getWeight().multiply(factor).setScale(3, RoundingMode.HALF_UP);
            if (decayed.compareTo(floor) < 0) {
                edgeRepository.delete(edge);   // @SQLDelete -> soft delete
                pruned++;
            } else {
                edge.setWeight(decayed);
            }
        }
        return new EdgeDecayResult(edges.size(), pruned);
    }

    private int pruneStaleCandidates(UUID userId, int maxAgeDays) {
        Instant cutoff = Instant.now().minus(maxAgeDays, ChronoUnit.DAYS);
        List<GraphNodeEntity> stale = nodeRepository.findByCreatedByAndStatusAndCreatedAtBeforeAndDeletedFalse(
            userId, GraphNodeEntity.STATUS_CANDIDATE, cutoff);
        stale.forEach(nodeRepository::delete);   // @SQLDelete -> soft delete
        return stale.size();
    }

    /** Fresh snapshot evidence for an already-promoted pattern bumps every edge TOUCHING that
     *  pattern's node (both directions) — the counterweight to this same run's decay. Edges that
     *  were just pruned above are gone from {@code findByCreatedByAndFromNodeIdAndDeletedFalse}/
     *  {@code ...ToNodeIdAndDeletedFalse} already (both are {@code @SQLRestriction}-filtered), so
     *  a dead relationship simply isn't reinforced — it stays gone until re-evidenced fresh.
     *
     * <p>Edges are collected into a {@code Map<UUID, GraphEdgeEntity>} keyed by edge id across ALL
     * fresh pattern ids BEFORE any bump is applied — an edge directly between two simultaneously
     * fresh, promoted PATTERN nodes (e.g. a structured {@code A --SUPPORTS--> B} edge where both A
     * and B got a fresh snapshot the same night) would otherwise surface from both pattern A's
     * {@code from}-query and pattern B's {@code to}-query and get double-bumped. */
    private int reinforceFreshPatterns(UUID userId, double bump) {
        Instant since = Instant.now().minus(REINFORCEMENT_FRESHNESS_HOURS, ChronoUnit.HOURS);
        Set<UUID> freshPatternIds = patternEventRepository
            .findByCreatedByAndKindAndOccurredAtAfterAndDeletedFalse(userId, PatternEventEntity.KIND_SNAPSHOT, since)
            .stream().map(PatternEventEntity::getPatternId).collect(Collectors.toSet());
        if (freshPatternIds.isEmpty()) {
            return 0;
        }
        Map<UUID, GraphEdgeEntity> touching = new LinkedHashMap<>();
        for (UUID patternId : freshPatternIds) {
            Optional<GraphNodeEntity> node = nodeRepository
                .findByCreatedByAndSourceKindAndSourceIdAndDeletedFalse(userId, GraphPromotionService.SOURCE_PATTERN, patternId);
            if (node.isEmpty()) {
                continue;   // pattern confirmed but never promoted — nothing to reinforce
            }
            UUID nodeId = node.get().getId();
            edgeRepository.findByCreatedByAndFromNodeIdAndDeletedFalse(userId, nodeId)
                .forEach(edge -> touching.put(edge.getId(), edge));
            edgeRepository.findByCreatedByAndToNodeIdAndDeletedFalse(userId, nodeId)
                .forEach(edge -> touching.put(edge.getId(), edge));
        }
        BigDecimal bumpAmount = BigDecimal.valueOf(bump);
        Instant now = Instant.now();
        int reinforced = 0;
        for (GraphEdgeEntity edge : touching.values()) {
            BigDecimal bumped = edge.getWeight().add(bumpAmount).min(BigDecimal.ONE).setScale(3, RoundingMode.HALF_UP);
            edge.setWeight(bumped);
            edge.setLastReinforcedAt(now);
            reinforced++;
        }
        return reinforced;
    }
}
