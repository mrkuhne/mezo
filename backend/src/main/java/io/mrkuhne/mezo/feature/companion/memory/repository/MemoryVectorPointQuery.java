package io.mrkuhne.mezo.feature.companion.memory.repository;

import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Savepoint;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
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
 * The memory map's point cloud (mezo-4qyt): every ANN-eligible vector of one user and one
 * generation, with the item metadata the map renders beside it.
 *
 * <p>The predicate is {@link DenseMemoryQuery}'s ANN-eligibility predicate verbatim minus the
 * query vector — same {@code ready} + live + hash-matching conditions, so the map shows exactly
 * the population retrieval could actually reach, and the partial HNSW index still applies.
 *
 * <p>Raw JDBC under a savepoint, the {@link DenseMemoryQuery} idiom: pgvector operators are
 * involved (the {@code embedding::text} cast), and a failed statement must not leave the
 * surrounding read-only transaction rollback-only.
 *
 * <p>{@code embedding::text} rather than {@code getObject}: pgvector's {@code vector} type is
 * {@code USER-DEFINED} to {@code information_schema} and has no default JDBC mapping — the exact
 * reason the admin catalog drops such columns. The {@code [0.1,0.2,...]} text form is parsed by a
 * hand-rolled split here rather than by pulling in the pgvector JDBC extension.
 *
 * <p>The SAMPLING ORDER IS THE LIMIT CLAUSE: {@code occurred_on desc, salience desc, id} is
 * "newest and most salient first", so a caller that passes {@code limit = threshold + 1} both
 * gets the right subset and can tell "exactly at the threshold" from "over it".
 */
@Repository
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class MemoryVectorPointQuery {

    /** One map point: the item facts the UI shows plus the raw embedding the PCA consumes. */
    public record PointRow(UUID itemId, UUID sourceId, String sourceKind, LocalDate occurredOn,
                           BigDecimal salience, String state, String snippet, Instant updatedAt,
                           float[] embedding) {}

    private static final String SAVEPOINT_NAME = "memory_vector_points";

    private static final String POINTS = """
        select i.id as item_id, i.source_id, i.source_kind, i.occurred_on, i.salience, i.state,
               left(i.content, :snippetChars) as snippet, i.updated_at,
               v.embedding::text as embedding_text
        from memory_vector v
        join memory_item i on i.id = v.memory_item_id and i.created_by = :userId
        where v.created_by = :userId
          and v.is_deleted = false and v.status = 'ready' and v.embedding is not null
          and v.embedding_version = :embeddingVersion
          and v.embedded_content_hash = i.content_hash
          and i.is_deleted = false and i.state = 'active'
        order by i.occurred_on desc, i.salience desc, i.id
        limit :limit
        """;

    /**
     * The projection cache's invalidation probe: the two facts that can change the PCA input
     * without changing anything else. {@code memory_item.updated_at} rather than the vector's —
     * {@code OwnedEntity} carries no {@code updated_at}.
     */
    private static final String PROBE = """
        select count(*) as ready_count, max(i.updated_at) as newest_updated_at
        from memory_vector v
        join memory_item i on i.id = v.memory_item_id and i.created_by = :userId
        where v.created_by = :userId
          and v.is_deleted = false and v.status = 'ready' and v.embedding is not null
          and v.embedding_version = :embeddingVersion
          and v.embedded_content_hash = i.content_hash
          and i.is_deleted = false and i.state = 'active'
        """;

    private static final RowMapper<PointRow> POINT_MAPPER = (rs, rowNum) -> new PointRow(
            rs.getObject("item_id", UUID.class),
            rs.getObject("source_id", UUID.class),
            rs.getString("source_kind"),
            rs.getObject("occurred_on", LocalDate.class),
            rs.getBigDecimal("salience"),
            rs.getString("state"),
            rs.getString("snippet"),
            instant(rs, "updated_at"),
            parseVector(rs.getString("embedding_text")));

    private final NamedParameterJdbcTemplate jdbc;

    /** At most {@code limit} eligible points, newest and most salient first. */
    public List<PointRow> points(UUID userId, String embeddingVersion, int snippetChars, int limit) {
        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("userId", userId)
                .addValue("embeddingVersion", embeddingVersion)
                .addValue("snippetChars", snippetChars)
                .addValue("limit", limit);
        return underSavepoint(template -> template.query(POINTS, params, POINT_MAPPER));
    }

    /** The unsampled population size and its newest item change, under the same predicate. */
    public Probe probe(UUID userId, String embeddingVersion) {
        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("userId", userId)
                .addValue("embeddingVersion", embeddingVersion);
        return underSavepoint(template -> template.queryForObject(PROBE, params,
                (rs, rowNum) -> new Probe(
                        rs.getLong("ready_count"),
                        instant(rs, "newest_updated_at"))));
    }

    /** The projection cache key's two moving parts. */
    public record Probe(long readyCount, Instant newestUpdatedAt) {}

    /**
     * {@code timestamptz} -> {@link Instant} via {@link OffsetDateTime}: this project's PostgreSQL
     * JDBC driver rejects {@code getObject(label, Instant.class)} outright, so the two-step
     * conversion is required rather than stylistic.
     */
    private static Instant instant(ResultSet rs, String label) throws SQLException {
        OffsetDateTime value = rs.getObject(label, OffsetDateTime.class);
        return value == null ? null : value.toInstant();
    }

    /** pgvector's {@code [0.1,0.2,...]} text form; null/blank yields an empty vector. */
    private static float[] parseVector(String text) {
        if (text == null || text.length() < 3) {
            return new float[0];
        }
        String body = text.substring(1, text.length() - 1);
        if (body.isBlank()) {
            return new float[0];
        }
        String[] parts = body.split(",");
        float[] vector = new float[parts.length];
        for (int i = 0; i < parts.length; i++) {
            vector[i] = Float.parseFloat(parts[i].trim());
        }
        return vector;
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
