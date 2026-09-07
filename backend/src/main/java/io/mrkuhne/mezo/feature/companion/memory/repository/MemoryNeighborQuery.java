package io.mrkuhne.mezo.feature.companion.memory.repository;

import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.math.BigDecimal;
import java.sql.SQLException;
import java.sql.Savepoint;
import java.time.LocalDate;
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
 * Real pgvector cosine neighbours of ONE memory item (mezo-4qyt) — the map's "why is this dot
 * here" probe. The anchor's own stored embedding is the query vector, so no embed call is needed
 * and the distances are the ones retrieval itself would see.
 *
 * <p>Raw JDBC under a savepoint, the {@link DenseMemoryQuery} idiom, for the same reason: a failed
 * pgvector statement must not leave the caller's read-only transaction rollback-only.
 *
 * <p>The eligibility predicate is kept IDENTICAL to {@link DenseMemoryQuery}'s so the partial
 * HNSW index (ready + live rows only) is actually used; diverge from it and the statement timeout
 * starts to matter.
 */
@Repository
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class MemoryNeighborQuery {

    /** One neighbour with its real cosine distance; similarity is derived by the caller. */
    public record NeighborRow(UUID itemId, String sourceKind, LocalDate occurredOn,
                              BigDecimal salience, String state, String snippet, double distance) {}

    private static final String SAVEPOINT_NAME = "memory_vector_neighbors";

    /**
     * {@code exists (select 1 from anchor)} is LOAD-BEARING: without it, an anchor with no ready
     * vector makes {@code v.embedding <=> null} null for every row, {@code order by distance}
     * returns an arbitrary page, and the endpoint answers with nonsense instead of an error. An
     * empty result is what the service turns into 404 {@code ADMIN_MEMORY_NO_VECTOR}.
     */
    private static final String NEIGHBORS = """
        with anchor as (
            select v.embedding
            from memory_vector v
            where v.created_by = :userId and v.memory_item_id = :itemId
              and v.embedding_version = :embeddingVersion
              and v.status = 'ready' and v.is_deleted = false and v.embedding is not null
        )
        select i.id as item_id, i.source_kind, i.occurred_on, i.salience, i.state,
               left(i.content, :snippetChars) as snippet,
               (v.embedding <=> (select embedding from anchor)) as distance
        from memory_vector v
        join memory_item i on i.id = v.memory_item_id and i.created_by = :userId
        where v.created_by = :userId
          and v.is_deleted = false and v.status = 'ready' and v.embedding is not null
          and v.embedding_version = :embeddingVersion
          and v.embedded_content_hash = i.content_hash
          and i.is_deleted = false and i.state = 'active'
          and v.memory_item_id <> :itemId
          and exists (select 1 from anchor)
        order by distance
        limit :k
        """;

    /** Does the anchor itself have a ready vector of this generation? */
    private static final String ANCHOR_EXISTS = """
        select count(*) from memory_vector v
        where v.created_by = :userId and v.memory_item_id = :itemId
          and v.embedding_version = :embeddingVersion
          and v.status = 'ready' and v.is_deleted = false and v.embedding is not null
        """;

    private static final RowMapper<NeighborRow> NEIGHBOR_MAPPER = (rs, rowNum) -> new NeighborRow(
            rs.getObject("item_id", UUID.class),
            rs.getString("source_kind"),
            rs.getObject("occurred_on", LocalDate.class),
            rs.getBigDecimal("salience"),
            rs.getString("state"),
            rs.getString("snippet"),
            rs.getDouble("distance"));

    private final NamedParameterJdbcTemplate jdbc;

    public List<NeighborRow> neighbors(
            UUID userId, UUID itemId, String embeddingVersion, int snippetChars, int k) {
        MapSqlParameterSource params = params(userId, itemId, embeddingVersion)
                .addValue("snippetChars", snippetChars)
                .addValue("k", k);
        return underSavepoint(template -> template.query(NEIGHBORS, params, NEIGHBOR_MAPPER));
    }

    /**
     * Told apart from "the item does not exist" by the caller's prior owner-scoped item check:
     * false here means ADMIN_MEMORY_NO_VECTOR, not ADMIN_MEMORY_ITEM_NOT_FOUND. Asked separately
     * because a legitimately isolated anchor (a ready vector, but the only one) also returns zero
     * neighbours.
     */
    public boolean hasServingVector(UUID userId, UUID itemId, String embeddingVersion) {
        Long count = underSavepoint(template -> template.queryForObject(
                ANCHOR_EXISTS, params(userId, itemId, embeddingVersion), Long.class));
        return count != null && count > 0;
    }

    private static MapSqlParameterSource params(UUID userId, UUID itemId, String embeddingVersion) {
        return new MapSqlParameterSource()
                .addValue("userId", userId)
                .addValue("itemId", itemId)
                .addValue("embeddingVersion", embeddingVersion);
    }

    private <T> T underSavepoint(Function<NamedParameterJdbcTemplate, T> work) {
        return jdbc.getJdbcTemplate().execute((ConnectionCallback<T>) connection -> {
            NamedParameterJdbcTemplate current =
                    new NamedParameterJdbcTemplate(new SingleConnectionDataSource(connection, true));
            Savepoint savepoint = connection.getAutoCommit() ? null : connection.setSavepoint(SAVEPOINT_NAME);
            try {
                T result = work.apply(current);
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
