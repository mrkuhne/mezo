package io.mrkuhne.mezo.feature.companion.graph.repository;

import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.math.BigDecimal;
import java.sql.SQLException;
import java.sql.Savepoint;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import java.util.function.Function;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.jdbc.core.ConnectionCallback;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.datasource.SingleConnectionDataSource;
import org.springframework.stereotype.Repository;

/**
 * W2.4 (mezo-b3pp.9, spec §6.4): the knowledge-graph READ side of the chat turn — BOTH statements
 * the {@code [Összefüggések]} block needs, and both under the same savepoint guard.
 *
 * <ul>
 *   <li>{@link #activeNodes} — the seed candidates: every active, non-deleted node of one owner.</li>
 *   <li>{@link #neighborhood} — ONE recursive CTE that walks {@code knowledge_edge} UNDIRECTED from
 *       the seed nodes, at most {@code maxHops} deep, cycle-safe (a path array; a node is never
 *       re-entered), over ACTIVE, non-deleted, OWNER-SCOPED nodes and non-deleted edges. Each edge
 *       is reported once with the smallest hop count it was reached at; the result is ordered by
 *       {@code weight desc, hops asc} and cut at {@code topK}.</li>
 * </ul>
 *
 * <p>Raw JDBC under a savepoint — the {@code MemoryEmbeddingAnnQuery} idiom, for the same reason:
 * the block this feeds is optional, the chat turn is not (IDENT-3). A failed statement rolls back
 * to the savepoint so the surrounding turn transaction is neither aborted nor rollback-only. Same
 * connection by construction ({@code DataSourceUtils} hands the transaction-bound one), savepoint
 * only when not in auto-commit. This is exactly why the seed read is HERE and not a JPA finder on
 * {@code GraphNodeRepository}: a Hibernate query failure would mark the turn's transaction
 * rollback-only, and {@code GraphPromptAssembler}'s catch → EMPTY could then no longer save the
 * turn. {@code seedNodeIds} must be non-empty ({@code in ()} is a SQL error) — the caller returns
 * early on no seeds.
 */
@Repository
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.KNOWLEDGE_GRAPH_SWITCH, havingValue = "true")
public class GraphTraversalQuery {

    /** One neighborhood edge with both endpoints' titles resolved — what the renderer needs. */
    public record NeighborEdge(UUID edgeId, UUID fromNodeId, String fromTitle,
                               UUID toNodeId, String toTitle,
                               String kind, BigDecimal weight, int hops) {}

    /** One seed candidate — the folded matching in {@code GraphTraversalService} runs over these. */
    public record ActiveNode(UUID id, String title, String summary) {}

    private static final String SAVEPOINT_NAME = "graph_traversal";

    /** The frontier ends at the far end of the last edge; {@code path} is the cycle guard. The
     *  recursive term only extends FROM an active, non-deleted, owner-owned frontier — an inactive
     *  node may still be reported as an edge's endpoint (the final join below drops those), but the
     *  walk never uses it as a hub to reach further edges. The base term is exempt: a seed's own
     *  incident edges surface at hop 1 regardless of the seed's own status. Every {@code
     *  knowledge_node} join is owner-scoped too — an owned edge may still point at a foreign node,
     *  and that row must never reach the prompt. */
    private static final String SQL = """
        with recursive walk as (
            select e.id as edge_id, e.from_node_id, e.to_node_id, e.kind, e.weight, 1 as hops,
                   case when e.from_node_id in (:seeds) then e.to_node_id else e.from_node_id end as frontier,
                   array[e.from_node_id, e.to_node_id] as path
            from knowledge_edge e
            where e.created_by = :userId and e.is_deleted = false
              and (e.from_node_id in (:seeds) or e.to_node_id in (:seeds))
            union all
            select e.id, e.from_node_id, e.to_node_id, e.kind, e.weight, w.hops + 1,
                   case when e.from_node_id = w.frontier then e.to_node_id else e.from_node_id end,
                   w.path || case when e.from_node_id = w.frontier then e.to_node_id else e.from_node_id end
            from walk w
            join knowledge_node n on n.id = w.frontier and n.created_by = :userId
                 and n.is_deleted = false and n.status = 'active'
                 and (:applyAsOf = false or n.occurred_on is null or n.occurred_on <= :asOf)
            join knowledge_edge e on e.created_by = :userId and e.is_deleted = false
                 and (e.from_node_id = w.frontier or e.to_node_id = w.frontier)
                 and not (case when e.from_node_id = w.frontier then e.to_node_id else e.from_node_id end = any(w.path))
            where w.hops < :maxHops
        ),
        best as (
            select distinct on (edge_id) edge_id, from_node_id, to_node_id, kind, weight, hops
            from walk
            order by edge_id, hops
        )
        select b.edge_id, b.from_node_id, f.title as from_title,
               b.to_node_id, t.title as to_title, b.kind, b.weight, b.hops
        from best b
        join knowledge_node f on f.id = b.from_node_id and f.created_by = :userId
             and f.is_deleted = false and f.status = 'active'
             and (:applyAsOf = false or f.occurred_on is null or f.occurred_on <= :asOf)
        join knowledge_node t on t.id = b.to_node_id and t.created_by = :userId
             and t.is_deleted = false and t.status = 'active'
             and (:applyAsOf = false or t.occurred_on is null or t.occurred_on <= :asOf)
        order by b.weight desc, b.hops asc, b.edge_id
        limit :topK
        """;

    /** Newest-first so a truncated graph still seeds from the most recent knowledge (the same order
     *  {@code GraphNodeRepository.findByCreatedByAndStatusAndDeletedFalseOrderByCreatedAtDesc} gives).
     *  {@code id} is a secondary sort key so the order is TOTAL — Postgres does not guarantee any
     *  particular order among exact {@code created_at} ties, and {@code GraphTraversalService
     *  .seedsFor}'s stable sort now relies on THIS query producing the same row order every time to
     *  keep equally-ranked nodes in a deterministic order across repeated calls (mezo-b3pp.34). */
    private static final String ACTIVE_NODES_SQL = """
        select id, title, summary
        from knowledge_node n
        where created_by = :userId and status = 'active' and is_deleted = false
          and (:applyAsOf = false or occurred_on is null or occurred_on <= :asOf)
        order by created_at desc, id
        """;

    private static final RowMapper<NeighborEdge> ROW_MAPPER = (rs, rowNum) -> new NeighborEdge(
            rs.getObject("edge_id", UUID.class),
            rs.getObject("from_node_id", UUID.class),
            rs.getString("from_title"),
            rs.getObject("to_node_id", UUID.class),
            rs.getString("to_title"),
            rs.getString("kind"),
            rs.getBigDecimal("weight"),
            rs.getInt("hops"));

    private static final RowMapper<ActiveNode> ACTIVE_NODE_ROW_MAPPER = (rs, rowNum) -> new ActiveNode(
            rs.getObject("id", UUID.class),
            rs.getString("title"),
            rs.getString("summary"));

    private final NamedParameterJdbcTemplate jdbc;

    /** Weight-ordered ≤maxHops neighborhood; a failure rolls back to the savepoint and rethrows. */
    public List<NeighborEdge> neighborhood(UUID userId, Collection<UUID> seedNodeIds, int maxHops, int topK) {
        return neighborhood(userId, seedNodeIds, maxHops, topK, LocalDate.EPOCH, false);
    }

    /** Historical neighborhood whose seed and endpoint nodes cannot lie after {@code asOf}. */
    public List<NeighborEdge> neighborhood(UUID userId, Collection<UUID> seedNodeIds,
                                            int maxHops, int topK, LocalDate asOf) {
        return neighborhood(userId, seedNodeIds, maxHops, topK, asOf, true);
    }

    private List<NeighborEdge> neighborhood(UUID userId, Collection<UUID> seedNodeIds,
                                             int maxHops, int topK, LocalDate asOf,
                                             boolean applyAsOf) {
        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("userId", userId)
                .addValue("seeds", seedNodeIds)
                .addValue("maxHops", maxHops)
                .addValue("topK", topK)
                .addValue("asOf", asOf)
                .addValue("applyAsOf", applyAsOf);
        return underSavepoint(template -> template.query(SQL, params, ROW_MAPPER));
    }

    /** The owner's active, non-deleted nodes, newest first; same savepoint guarantee as above. */
    public List<ActiveNode> activeNodes(UUID userId) {
        return activeNodes(userId, LocalDate.EPOCH, false);
    }

    /** The owner's active nodes that were already effective at {@code asOf}. */
    public List<ActiveNode> activeNodes(UUID userId, LocalDate asOf) {
        return activeNodes(userId, asOf, true);
    }

    private List<ActiveNode> activeNodes(UUID userId, LocalDate asOf, boolean applyAsOf) {
        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("userId", userId)
                .addValue("asOf", asOf)
                .addValue("applyAsOf", applyAsOf);
        return underSavepoint(template -> template.query(ACTIVE_NODES_SQL, params, ACTIVE_NODE_ROW_MAPPER));
    }

    /** Runs {@code work} on the transaction-bound connection, wrapped in a savepoint that is rolled
     *  back (and the failure rethrown) on any error — so the caller's transaction stays usable. */
    private <T> T underSavepoint(Function<NamedParameterJdbcTemplate, T> work) {
        return jdbc.getJdbcTemplate().execute((ConnectionCallback<T>) connection -> {
            NamedParameterJdbcTemplate onThisConnection =
                    new NamedParameterJdbcTemplate(new SingleConnectionDataSource(connection, true));
            Savepoint savepoint = connection.getAutoCommit() ? null : connection.setSavepoint(SAVEPOINT_NAME);
            try {
                T result = work.apply(onThisConnection);
                if (savepoint != null) {
                    connection.releaseSavepoint(savepoint);
                }
                return result;
            } catch (RuntimeException e) {
                if (savepoint != null) {
                    try {
                        connection.rollback(savepoint);
                    } catch (SQLException rollbackFailure) {
                        e.addSuppressed(rollbackFailure);
                    }
                }
                throw e;
            }
        });
    }
}
