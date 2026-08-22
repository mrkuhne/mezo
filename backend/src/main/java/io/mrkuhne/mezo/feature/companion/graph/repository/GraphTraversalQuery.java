package io.mrkuhne.mezo.feature.companion.graph.repository;

import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.math.BigDecimal;
import java.sql.SQLException;
import java.sql.Savepoint;
import java.util.Collection;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.jdbc.core.ConnectionCallback;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.datasource.SingleConnectionDataSource;
import org.springframework.stereotype.Repository;

/**
 * W2.4 (mezo-b3pp.9, spec §6.4): the knowledge-graph neighborhood read — ONE recursive CTE that
 * walks {@code knowledge_edge} UNDIRECTED from the seed nodes, at most {@code maxHops} deep,
 * cycle-safe (a path array; a node is never re-entered), over ACTIVE, non-deleted nodes and
 * non-deleted edges of one owner. Each edge is reported once with the smallest hop count it was
 * reached at; the result is ordered by {@code weight desc, hops asc} and cut at {@code topK}.
 *
 * <p>Raw JDBC under a savepoint — the {@code MemoryEmbeddingAnnQuery} idiom, for the same reason:
 * the block this feeds is optional, the chat turn is not (IDENT-3). A failed statement rolls back
 * to the savepoint so the surrounding turn transaction is neither aborted nor rollback-only. Same
 * connection by construction ({@code DataSourceUtils} hands the transaction-bound one), savepoint
 * only when not in auto-commit. {@code seedNodeIds} must be non-empty ({@code in ()} is a SQL
 * error) — the caller returns early on no seeds.
 */
@Repository
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.KNOWLEDGE_GRAPH_SWITCH, havingValue = "true")
public class GraphTraversalQuery {

    /** One neighborhood edge with both endpoints resolved (titles/kinds are what the renderer needs). */
    public record NeighborEdge(UUID edgeId, UUID fromNodeId, String fromTitle, String fromKind,
                               UUID toNodeId, String toTitle, String toKind,
                               String kind, BigDecimal weight, int hops) {}

    private static final String SAVEPOINT_NAME = "graph_traversal";

    /** The frontier ends at the far end of the last edge; {@code path} is the cycle guard. */
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
        select b.edge_id, b.from_node_id, f.title as from_title, f.kind as from_kind,
               b.to_node_id, t.title as to_title, t.kind as to_kind, b.kind, b.weight, b.hops
        from best b
        join knowledge_node f on f.id = b.from_node_id and f.is_deleted = false and f.status = 'active'
        join knowledge_node t on t.id = b.to_node_id and t.is_deleted = false and t.status = 'active'
        order by b.weight desc, b.hops asc, b.edge_id
        limit :topK
        """;

    private static final RowMapper<NeighborEdge> ROW_MAPPER = (rs, rowNum) -> new NeighborEdge(
            rs.getObject("edge_id", UUID.class),
            rs.getObject("from_node_id", UUID.class),
            rs.getString("from_title"),
            rs.getString("from_kind"),
            rs.getObject("to_node_id", UUID.class),
            rs.getString("to_title"),
            rs.getString("to_kind"),
            rs.getString("kind"),
            rs.getBigDecimal("weight"),
            rs.getInt("hops"));

    private final NamedParameterJdbcTemplate jdbc;

    /** Weight-ordered ≤maxHops neighborhood; a failure rolls back to the savepoint and rethrows. */
    public List<NeighborEdge> neighborhood(UUID userId, Collection<UUID> seedNodeIds, int maxHops, int topK) {
        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("userId", userId)
                .addValue("seeds", seedNodeIds)
                .addValue("maxHops", maxHops)
                .addValue("topK", topK);
        return jdbc.getJdbcTemplate().execute((ConnectionCallback<List<NeighborEdge>>) connection -> {
            NamedParameterJdbcTemplate onThisConnection =
                    new NamedParameterJdbcTemplate(new SingleConnectionDataSource(connection, true));
            Savepoint savepoint = connection.getAutoCommit() ? null : connection.setSavepoint(SAVEPOINT_NAME);
            try {
                List<NeighborEdge> edges = onThisConnection.query(SQL, params, ROW_MAPPER);
                if (savepoint != null) {
                    connection.releaseSavepoint(savepoint);
                }
                return edges;
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
