package io.mrkuhne.mezo.feature.companion.repository;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.ConnectionCallback;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.datasource.SingleConnectionDataSource;
import org.springframework.stereotype.Repository;

import java.sql.SQLException;
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
 * <p><b>The same-connection guarantee holds by construction, in BOTH states.</b> The outer
 * {@code execute(ConnectionCallback)} goes through {@code DataSourceUtils}, so the callback is
 * handed the transaction-bound connection when there is a transaction, and a plain pooled one when
 * there is not. The statement is then run on THAT connection — through a
 * {@code NamedParameterJdbcTemplate} over a close-suppressing {@link SingleConnectionDataSource}
 * wrapping it — instead of re-resolving a connection from the pool. Inside a transaction the
 * savepoint scopes the failure to this one statement; outside one the connection is in auto-commit,
 * where savepoints are illegal, so none is taken and none is needed (nothing else is at stake).
 *
 * <p>The savepoint is taken by hand rather than through {@code PROPAGATION_NESTED}: Spring's
 * {@code JpaTransactionManager} refuses nested transactions on Hibernate
 * ({@code NestedTransactionNotSupportedException: JpaDialect does not support savepoints}) even
 * with {@code setNestedTransactionAllowed(true)}, since {@code HibernateJpaDialect} exposes no
 * {@code SavepointManager}. {@code kinds} must be non-empty ({@code in ()} is a SQL error) —
 * callers skip groups whose cap is 0.
 *
 * <p><b>Caveat of going around Hibernate:</b> a raw JDBC read does NOT trigger the session's
 * auto-flush, so pending, unflushed entity changes would be invisible to it. That is harmless
 * today — no in-transaction writer precedes {@code recall} on either chat path (the assembler runs
 * before the turn's own rows are written), and the ITs' populators {@code saveAndFlush}. A future
 * caller that writes memory rows and then recalls in the same transaction must flush first.
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

    /**
     * W3.2 (mezo-b3pp.13) coverage-filtered twin: the same ANN search with a metadata floor on
     * {@code occurred_on}, so ambient recall can stop asking for fine-grained rows that a
     * consolidation rung already covers. A separate constant rather than a nullable parameter —
     * an {@code (:notBefore is null or …)} predicate would be an untyped-parameter cast headache
     * for no gain, and the planner sees a cleaner statement this way.
     */
    private static final String SQL_SINCE = """
        select id, kind, ref_id, content, occurred_on,
               (embedding <=> cast(:queryVector as vector)) as distance
        from memory_embedding
        where created_by = :userId
          and is_deleted = false
          and kind in (:kinds)
          and occurred_on >= :notBefore
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
        return nearestInKinds(userId, kinds, queryVector, k, null);
    }

    /**
     * Nearest-first hits of the given kinds, optionally floored at {@code notBefore} (W3.2's
     * coverage filter — {@code null} means no floor). Same savepoint contract as the unfiltered
     * call.
     */
    public List<Hit> nearestInKinds(UUID userId, Collection<String> kinds, String queryVector, int k,
                                    LocalDate notBefore) {
        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("userId", userId)
                .addValue("kinds", kinds)
                .addValue("queryVector", queryVector)
                .addValue("k", k);
        String sql = SQL;
        if (notBefore != null) {
            params.addValue("notBefore", notBefore);
            sql = SQL_SINCE;
        }
        String statement = sql;
        return jdbc.getJdbcTemplate().execute((ConnectionCallback<List<Hit>>) connection -> {
            // the statement runs on THIS connection — the one the savepoint is taken on — rather
            // than on whatever the pool would hand back; suppressClose so the template cannot
            // close a connection it does not own
            NamedParameterJdbcTemplate onThisConnection =
                    new NamedParameterJdbcTemplate(new SingleConnectionDataSource(connection, true));
            // auto-commit ⇒ no surrounding transaction to protect (and savepoints are illegal there)
            Savepoint savepoint = connection.getAutoCommit() ? null : connection.setSavepoint(SAVEPOINT_NAME);
            try {
                List<Hit> hits = onThisConnection.query(statement, params, ROW_MAPPER);
                if (savepoint != null) {
                    connection.releaseSavepoint(savepoint);
                }
                return hits;
            } catch (RuntimeException e) {
                // RuntimeException, not just DataAccessException: a row-mapper failure must unwind
                // the savepoint too. The ORIGINAL failure is always the one thrown; a failing
                // rollback rides along suppressed rather than masking it.
                if (savepoint != null) {
                    try {
                        // undo ONLY the failed statement — the caller's transaction stays usable
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
