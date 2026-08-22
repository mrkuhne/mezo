package io.mrkuhne.mezo.feature.companion.repository;

import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.ConnectionCallback;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

import java.sql.Savepoint;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

/**
 * W3.1 ambient recall's ANN search, deliberately OUTSIDE Hibernate: it runs through JDBC on the
 * caller's own connection, wrapped in a JDBC savepoint. A failed statement is rolled back to that
 * savepoint, so the surrounding turn transaction is left neither in Postgres's "aborted" state
 * ("current transaction is aborted, commands ignored until end of transaction block") nor marked
 * rollback-only — the JPA path would do both, because Hibernate marks the session on any query
 * PersistenceException. Same connection also means no second-connection lock waits against a
 * test-managed transaction's TRUNCATE.
 *
 * <p>The savepoint is taken by hand rather than through {@code PROPAGATION_NESTED}: Spring's
 * {@code JpaTransactionManager} refuses nested transactions on Hibernate
 * ({@code NestedTransactionNotSupportedException: JpaDialect does not support savepoints}) even
 * with {@code setNestedTransactionAllowed(true)}, since {@code HibernateJpaDialect} exposes no
 * {@code SavepointManager}. Outside a transaction (auto-commit) no savepoint is needed and the
 * query simply runs. {@code kinds} must be non-empty ({@code in ()} is a SQL error) — callers skip
 * groups whose cap is 0.
 */
@Repository
@RequiredArgsConstructor
public class MemoryEmbeddingAnnQuery {

    /** One ANN hit — the row fields plus the cosine distance the ordering used. */
    public record Hit(UUID id, String kind, UUID refId, String content, LocalDate occurredOn, double distance) {}

    private static final String SAVEPOINT_NAME = "ambient_recall_ann";

    private static final String SQL = """
        select id, kind, ref_id, content, occurred_on,
               (embedding <=> cast(:queryVector as vector)) as distance
        from memory_embedding
        where created_by = :userId
          and is_deleted = false
          and kind in (:kinds)
        order by embedding <=> cast(:queryVector as vector)
        limit :k
        """;

    private static final RowMapper<Hit> ROW_MAPPER = (rs, rowNum) -> new Hit(
            rs.getObject("id", UUID.class),
            rs.getString("kind"),
            rs.getObject("ref_id", UUID.class),
            rs.getString("content"),
            rs.getObject("occurred_on", LocalDate.class),
            rs.getDouble("distance"));

    private final NamedParameterJdbcTemplate jdbc;

    /** Nearest-first hits of the given kinds; a failure rolls back to the savepoint and rethrows. */
    public List<Hit> nearestInKinds(UUID userId, Collection<String> kinds, String queryVector, int k) {
        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("userId", userId)
                .addValue("kinds", kinds)
                .addValue("queryVector", queryVector)
                .addValue("k", k);
        return jdbc.getJdbcTemplate().execute((ConnectionCallback<List<Hit>>) connection -> {
            // auto-commit ⇒ no surrounding transaction to protect (and savepoints are illegal there)
            Savepoint savepoint = connection.getAutoCommit() ? null : connection.setSavepoint(SAVEPOINT_NAME);
            try {
                List<Hit> hits = jdbc.query(SQL, params, ROW_MAPPER);
                if (savepoint != null) {
                    connection.releaseSavepoint(savepoint);
                }
                return hits;
            } catch (DataAccessException e) {
                if (savepoint != null) {
                    // undo ONLY the failed statement — the caller's transaction stays usable
                    connection.rollback(savepoint);
                }
                throw e;
            }
        });
    }
}
