package io.mrkuhne.mezo.feature.companion.graph.repository;

import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Types;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

/**
 * The explorer's structural graph read (mezo-4qyt) — the ONE place in the graph slice that can
 * see soft-deleted rows.
 *
 * <p>Native, not JPA, for a reason that is not performance: {@code GraphNodeEntity} and
 * {@code GraphEdgeEntity} both carry {@code @SQLRestriction("is_deleted = false")}, so a Spring
 * Data finder physically cannot answer {@code includeDeleted=true} — Hibernate appends the
 * predicate to every query it generates. The precedent is
 * {@code MemoryVectorRepository#findByOwnerItemAndVersionIncludingDeleted}.
 *
 * <p>Owner-scoped on BOTH sides of every join: an owned edge can point at a foreign node (the
 * {@code GraphTraversalQuery} note), and such a row must never reach an admin response either.
 *
 * <p>{@code meta}/{@code evidence} come back as {@code ::text} and are parsed by the admin mapper,
 * never left as a driver {@code PGobject} for Jackson to serialize after the read-only transaction
 * commits (the {@code AdminRowQuery#readCell} finding).
 *
 * <p>No savepoint wrapper here, unlike {@link GraphTraversalQuery}: there is no pgvector operator
 * in these statements, and the savepoint idiom exists so an OPTIONAL read cannot poison the
 * caller's transaction — this read IS the request.
 */
@Repository
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.KNOWLEDGE_GRAPH_SWITCH, havingValue = "true")
public class GraphStructureQuery {

    /** One {@code knowledge_node} row, soft-delete flag included. */
    public record NodeRow(UUID id, String kind, String title, String summary, String status,
                          String sourceKind, UUID sourceId, LocalDate occurredOn,
                          OffsetDateTime userArchivedAt, Instant createdAt, Instant updatedAt,
                          boolean deleted, String metaJson) {}

    /** One {@code knowledge_edge} row with both endpoints and its evidence as raw JSON text. */
    public record EdgeRow(UUID id, UUID fromNodeId, UUID toNodeId, String kind, BigDecimal weight,
                          Instant lastReinforcedAt, Instant createdAt, boolean deleted,
                          String evidenceJson) {}

    private static final String NODES = """
        select n.id, n.kind, n.title, n.summary, n.status, n.source_kind, n.source_id,
               n.occurred_on, n.user_archived_at, n.created_at, n.updated_at, n.is_deleted,
               n.meta::text as meta_json
        from knowledge_node n
        where n.created_by = :userId
          and (:includeDeleted or n.is_deleted = false)
          and (:includeArchived or n.status <> 'archived')
        order by n.created_at
        """;

    /**
     * Both endpoints must be present in the SAME response, or d3-force gets a link to a node id
     * it never received and throws. So the edge read joins both endpoint nodes under the SAME
     * visibility predicates the node read used — an edge whose endpoint is filtered out is
     * dropped here rather than shipped dangling.
     */
    private static final String EDGES = """
        select e.id, e.from_node_id, e.to_node_id, e.kind, e.weight,
               e.last_reinforced_at, e.created_at, e.is_deleted,
               coalesce(e.evidence, '[]'::jsonb)::text as evidence_json
        from knowledge_edge e
        join knowledge_node nf on nf.id = e.from_node_id and nf.created_by = :userId
             and (:includeDeleted or nf.is_deleted = false)
             and (:includeArchived or nf.status <> 'archived')
        join knowledge_node nt on nt.id = e.to_node_id and nt.created_by = :userId
             and (:includeDeleted or nt.is_deleted = false)
             and (:includeArchived or nt.status <> 'archived')
        where e.created_by = :userId
          and (:includeDeleted or e.is_deleted = false)
        order by e.weight desc, e.created_at
        """;

    private static final RowMapper<NodeRow> NODE_MAPPER = (rs, rowNum) -> new NodeRow(
            rs.getObject("id", UUID.class),
            rs.getString("kind"),
            rs.getString("title"),
            rs.getString("summary"),
            rs.getString("status"),
            rs.getString("source_kind"),
            rs.getObject("source_id", UUID.class),
            rs.getObject("occurred_on", LocalDate.class),
            rs.getObject("user_archived_at", OffsetDateTime.class),
            instant(rs, "created_at"),
            // @UpdateTimestamp, and null on rows written before the column existed.
            instant(rs, "updated_at"),
            rs.getBoolean("is_deleted"),
            rs.getString("meta_json"));

    private static final RowMapper<EdgeRow> EDGE_MAPPER = (rs, rowNum) -> new EdgeRow(
            rs.getObject("id", UUID.class),
            rs.getObject("from_node_id", UUID.class),
            rs.getObject("to_node_id", UUID.class),
            rs.getString("kind"),
            rs.getBigDecimal("weight"),
            instant(rs, "last_reinforced_at"),
            instant(rs, "created_at"),
            rs.getBoolean("is_deleted"),
            rs.getString("evidence_json"));

    /**
     * {@code timestamptz} -> {@link Instant}. Read as {@link OffsetDateTime} first: this project's
     * PostgreSQL JDBC driver rejects {@code getObject(label, Instant.class)} outright
     * ("conversion to class java.time.Instant from timestamptz not supported"), so the two-step
     * conversion is required, not stylistic.
     */
    private static Instant instant(ResultSet rs, String label) throws SQLException {
        OffsetDateTime value = rs.getObject(label, OffsetDateTime.class);
        return value == null ? null : value.toInstant();
    }

    private final NamedParameterJdbcTemplate jdbc;

    public List<NodeRow> nodes(UUID userId, boolean includeArchived, boolean includeDeleted) {
        return jdbc.query(NODES, params(userId, includeArchived, includeDeleted), NODE_MAPPER);
    }

    public List<EdgeRow> edges(UUID userId, boolean includeArchived, boolean includeDeleted) {
        return jdbc.query(EDGES, params(userId, includeArchived, includeDeleted), EDGE_MAPPER);
    }

    /**
     * The two flags are bound as primitive booleans with an explicit {@link Types#BOOLEAN} hint:
     * {@code (:includeDeleted or n.is_deleted = false)} needs a real {@code boolean} on the left,
     * and a driver-inferred null would make Postgres reject the {@code or} outright.
     */
    private static MapSqlParameterSource params(
            UUID userId, boolean includeArchived, boolean includeDeleted) {
        return new MapSqlParameterSource()
                .addValue("userId", userId)
                .addValue("includeArchived", includeArchived, Types.BOOLEAN)
                .addValue("includeDeleted", includeDeleted, Types.BOOLEAN);
    }
}
