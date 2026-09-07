package io.mrkuhne.mezo.feature.admin.service;

import io.mrkuhne.mezo.api.dto.AdminMemoryCountBucket;
import io.mrkuhne.mezo.api.dto.AdminMemoryEdgeEvidence;
import io.mrkuhne.mezo.api.dto.AdminMemoryGraphEdge;
import io.mrkuhne.mezo.api.dto.AdminMemoryGraphNode;
import io.mrkuhne.mezo.feature.companion.graph.entity.GraphEdgeEvidence;
import io.mrkuhne.mezo.feature.companion.graph.repository.GraphStructureQuery.EdgeRow;
import io.mrkuhne.mezo.feature.companion.graph.repository.GraphStructureQuery.NodeRow;
import io.mrkuhne.mezo.feature.companion.memory.repository.MemoryHealthQuery.Bucket;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import tools.jackson.core.JacksonException;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;

/**
 * Structured graph rows and health rollups → generated DTOs (mezo-4qyt).
 *
 * <p>The two jsonb columns arrive as {@code ::text} from {@code GraphStructureQuery} and are
 * parsed HERE, inside the request, rather than being left as driver objects for Jackson to
 * serialize after the read-only transaction commits (the {@code AdminRowQuery#readCell} finding).
 * A malformed payload is a data curiosity, not a reason to fail the whole graph read.
 *
 * <p>{@code degree} is computed from the edges IN THIS RESPONSE: an edge filtered out by
 * {@code includeArchived}/{@code includeDeleted} must not inflate a node radius the client cannot
 * explain by counting the links it actually received.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AdminMemoryGraphMapper {

    private static final TypeReference<List<GraphEdgeEvidence>> EVIDENCE_LIST =
            new TypeReference<>() {};
    private static final TypeReference<Map<String, Object>> META_MAP = new TypeReference<>() {};

    private final ObjectMapper objectMapper;

    /** Nodes with their in-response degree; {@code edges} must be the SAME list the response carries. */
    public List<AdminMemoryGraphNode> nodes(List<NodeRow> rows, List<EdgeRow> edges) {
        Map<UUID, Integer> degrees = new HashMap<>();
        for (EdgeRow edge : edges) {
            degrees.merge(edge.fromNodeId(), 1, Integer::sum);
            degrees.merge(edge.toNodeId(), 1, Integer::sum);
        }
        List<AdminMemoryGraphNode> nodes = new ArrayList<>(rows.size());
        for (NodeRow row : rows) {
            nodes.add(AdminMemoryGraphNode.builder()
                    .id(row.id())
                    .kind(row.kind())
                    .title(row.title())
                    .summary(row.summary())
                    .status(row.status())
                    .sourceKind(row.sourceKind())
                    .sourceId(row.sourceId())
                    .occurredOn(row.occurredOn())
                    .userArchivedAt(row.userArchivedAt())
                    .createdAt(utc(row.createdAt()))
                    .updatedAt(utc(row.updatedAt()))
                    .deleted(row.deleted())
                    .meta(parseMeta(row.metaJson()))
                    .degree(degrees.getOrDefault(row.id(), 0))
                    .build());
        }
        return nodes;
    }

    public List<AdminMemoryGraphEdge> edges(List<EdgeRow> rows) {
        List<AdminMemoryGraphEdge> edges = new ArrayList<>(rows.size());
        for (EdgeRow row : rows) {
            edges.add(AdminMemoryGraphEdge.builder()
                    .id(row.id())
                    .from(row.fromNodeId())
                    .to(row.toNodeId())
                    .kind(row.kind())
                    .weight(row.weight() == null ? 0.0 : row.weight().doubleValue())
                    .lastReinforcedAt(utc(row.lastReinforcedAt()))
                    .createdAt(utc(row.createdAt()))
                    .deleted(row.deleted())
                    .evidence(parseEvidence(row.evidenceJson()))
                    .build());
        }
        return edges;
    }

    /** Grouped counts straight through — the DB key is already human-readable. */
    public List<AdminMemoryCountBucket> buckets(List<Bucket> rows) {
        return rows.stream()
                .map(row -> AdminMemoryCountBucket.builder()
                        .key(row.key() == null ? "UNKNOWN" : row.key())
                        .count(row.count())
                        .build())
                .toList();
    }

    /**
     * The edge-weight histogram as exactly {@code buckets} labelled columns over 0..1, zero-count
     * ranges included — a histogram with holes is unreadable, and the label carries the range so
     * the client never has to reconstruct the bucket arithmetic.
     */
    public List<AdminMemoryCountBucket> histogram(Map<Integer, Long> byBucket, int buckets) {
        List<AdminMemoryCountBucket> result = new ArrayList<>(buckets);
        BigDecimal width = BigDecimal.ONE.divide(BigDecimal.valueOf(buckets), 4, RoundingMode.HALF_UP);
        for (int bucket = 1; bucket <= buckets; bucket++) {
            BigDecimal from = width.multiply(BigDecimal.valueOf(bucket - 1L));
            BigDecimal to = width.multiply(BigDecimal.valueOf(bucket));
            result.add(AdminMemoryCountBucket.builder()
                    .key(from.stripTrailingZeros().toPlainString()
                            + "–" + to.stripTrailingZeros().toPlainString())
                    .count(byBucket.getOrDefault(bucket, 0L))
                    .build());
        }
        return result;
    }

    /** Inferred job timestamps; a null stays null — "never ran" is a fact worth showing. */
    public Map<String, OffsetDateTime> jobs(Map<String, Instant> raw) {
        Map<String, OffsetDateTime> jobs = new LinkedHashMap<>();
        raw.forEach((key, value) -> jobs.put(key, utc(value)));
        return jobs;
    }

    private List<AdminMemoryEdgeEvidence> parseEvidence(String json) {
        if (json == null || json.isBlank()) {
            return List.of();
        }
        List<GraphEdgeEvidence> parsed;
        try {
            parsed = objectMapper.readValue(json, EVIDENCE_LIST);
        } catch (JacksonException exception) {
            log.warn("knowledge_edge.evidence could not be parsed for the admin explorer", exception);
            return List.of();
        }
        if (parsed == null) {
            return List.of();
        }
        return parsed.stream()
                .filter(item -> item != null && item.sourceKind() != null && item.sourceId() != null)
                .map(item -> AdminMemoryEdgeEvidence.builder()
                        .sourceKind(item.sourceKind())
                        .sourceId(item.sourceId())
                        .note(item.note())
                        .at(utc(item.at()))
                        .build())
                .toList();
    }

    private Map<String, Object> parseMeta(String json) {
        if (json == null || json.isBlank()) {
            return null;
        }
        try {
            return objectMapper.readValue(json, META_MAP);
        } catch (JacksonException exception) {
            log.warn("knowledge_node.meta could not be parsed for the admin explorer", exception);
            return null;
        }
    }

    private static OffsetDateTime utc(Instant instant) {
        return instant == null ? null : OffsetDateTime.ofInstant(instant, ZoneOffset.UTC);
    }
}
