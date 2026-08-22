package io.mrkuhne.mezo.feature.companion.graph.service;

import io.mrkuhne.mezo.feature.companion.entity.KnowledgeFactEntity;
import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.companion.graph.entity.GraphNodeEntity;
import io.mrkuhne.mezo.feature.companion.repository.KnowledgeFactRepository;
import io.mrkuhne.mezo.feature.companion.repository.PatternRepository;
import io.mrkuhne.mezo.feature.goal.entity.GoalEntity;
import io.mrkuhne.mezo.feature.goal.repository.GoalRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.math.BigDecimal;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * W2.2 promotion pipelines (bd mezo-b3pp.7, spec §6.2): existing knowledge flows into the graph
 * idempotently. Every write goes through {@link GraphService#upsertNode}, keyed by
 * {@code (createdBy, sourceKind, sourceId)} — re-promotion updates title/meta, never duplicates.
 *
 * <p>Deliberately EXCLUDES {@code knowledge_fact} rows with {@code source='pattern'}: those are the
 * V3.3 shadow of a pattern that already becomes a PATTERN node, so promoting them too would put the
 * same sentence in the graph twice.
 *
 * <p>Callers are (from later slices) async promotion hooks and the nightly reconciler — never a
 * controller: promotion is internal, there is no REST surface for it.
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.KNOWLEDGE_GRAPH_SWITCH, havingValue = "true")
public class GraphPromotionService {

    public static final String SOURCE_PATTERN = "pattern";
    public static final String SOURCE_FACT = "knowledge_fact";
    public static final String SOURCE_GOAL = "goal";

    private final GraphService graphService;
    private final PatternRepository patternRepository;
    private final KnowledgeFactRepository knowledgeFactRepository;
    private final GoalRepository goalRepository;

    /** Confirmed pattern -> PATTERN node. Empty when the pattern is gone, not this user's, or not confirmed. */
    @Transactional
    public Optional<GraphNodeEntity> promotePattern(UUID userId, UUID patternId) {
        return patternRepository.findByIdAndCreatedByAndDeletedFalse(patternId, userId)
            .filter(p -> PatternEntity.STATUS_CONFIRMED.equals(p.getStatus()))
            .map(p -> graphService.upsertNode(userId, GraphNodeEntity.KIND_PATTERN,
                truncateTitle(p.getTitle()), p.getMechanism(), SOURCE_PATTERN, p.getId(), null, patternMeta(p)));
    }

    /** Active (non-pattern-sourced) knowledge fact -> PREFERENCE node. */
    @Transactional
    public Optional<GraphNodeEntity> promoteFact(UUID userId, UUID factId) {
        return knowledgeFactRepository.findByIdAndCreatedByAndDeletedFalse(factId, userId)
            .filter(f -> !KnowledgeFactEntity.SOURCE_PATTERN.equals(f.getSource()))
            .map(f -> graphService.upsertNode(userId, GraphNodeEntity.KIND_PREFERENCE,
                truncateTitle(f.getFactText()), f.getFactText(), SOURCE_FACT, f.getId(), null,
                Map.of("category", f.getCategory(), "source", f.getSource())));
    }

    /** Goal -> GOAL node; a goal that is no longer active archives its node (the graph shadows, never forgets). */
    @Transactional
    public Optional<GraphNodeEntity> syncGoal(UUID userId, UUID goalId) {
        Optional<GoalEntity> found = goalRepository.findByIdAndCreatedByAndDeletedFalse(goalId, userId);
        if (found.isEmpty()) {
            return Optional.empty();
        }
        GoalEntity goal = found.get();
        boolean active = "active".equals(goal.getStatus());
        if (!active && graphService.findBySource(userId, SOURCE_GOAL, goalId).isEmpty()) {
            return Optional.empty();   // never promoted, never active — nothing to shadow
        }
        GraphNodeEntity node = graphService.upsertNode(userId, GraphNodeEntity.KIND_GOAL,
            truncateTitle(goal.getTitle()), goal.getTitle(), SOURCE_GOAL, goal.getId(), null,
            Map.of("status", goal.getStatus()));
        String status = active ? GraphNodeEntity.STATUS_ACTIVE : GraphNodeEntity.STATUS_ARCHIVED;
        if (!status.equals(node.getStatus())) {
            node.setStatus(status);
        }
        return Optional.of(node);
    }

    /** {r, n, direction} — the spec's PATTERN meta envelope; direction is the sign of r, prompt-renderable. */
    private static Map<String, Object> patternMeta(PatternEntity pattern) {
        Map<String, Object> meta = new HashMap<>();
        BigDecimal r = pattern.getR();
        meta.put("r", r == null ? null : r.toPlainString());
        meta.put("n", pattern.getN());
        meta.put("direction", r == null ? null : (r.signum() < 0 ? "negative" : "positive"));
        return meta;
    }

    /** knowledge_node.title is varchar(120); pattern titles (up to 200, LLM-generated hypotheses),
     *  fact texts, and goal titles can all be longer. */
    private static String truncateTitle(String text) {
        return text.length() <= 120 ? text : text.substring(0, 117) + "…";
    }
}
