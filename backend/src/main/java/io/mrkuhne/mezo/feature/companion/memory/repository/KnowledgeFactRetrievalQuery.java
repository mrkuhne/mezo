package io.mrkuhne.mezo.feature.companion.memory.repository;

import io.mrkuhne.mezo.feature.companion.tools.ToolText;
import java.sql.SQLException;
import java.sql.Savepoint;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import java.util.function.Function;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.ConnectionCallback;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.datasource.SingleConnectionDataSource;
import org.springframework.stereotype.Repository;

/** Pinned plus lexically relevant confirmed facts, with owner and validity enforced in SQL. */
@Repository
@RequiredArgsConstructor
public class KnowledgeFactRetrievalQuery {

    public record Hit(UUID id, String category, String factText, LocalDate occurredOn,
                      double score, boolean pinned, boolean conflicting) {
    }

    private static final String SAVEPOINT_NAME = "memory_fact_retrieval";
    private static final String SQL = """
        with eligible as (
            select f.id, f.category, f.fact_text,
                   coalesce(f.valid_from, cast(f.created_at as date)) as occurred_on,
                   f.reinforcement_count, f.pinned, f.conflicts_with,
                   ts_rank_cd(to_tsvector('simple', lower(unaccent(f.fact_text))),
                              websearch_to_tsquery('simple', :query))
                     + greatest(similarity(lower(unaccent(f.fact_text)), :query),
                                word_similarity(:query, lower(unaccent(f.fact_text)))) * 0.25 as score
            from knowledge_fact f
            where f.created_by = :userId and f.is_deleted = false and f.include_in_prompt = true
              and f.superseded_by is null
              and coalesce(f.valid_from, cast(f.created_at as date)) <= :asOf
              and (f.valid_to is null or f.valid_to >= :asOf)
        ), seeds as (
            select * from eligible where pinned
            union
            select * from eligible where score > 0
        ), ranked_seeds as (
            select * from seeds
            order by pinned desc, score desc, reinforcement_count desc, id
            limit :candidateLimit
        ), candidates as (
            select * from ranked_seeds
            union
            select e.* from eligible e
            join ranked_seeds s on e.id = s.conflicts_with or e.conflicts_with = s.id
        )
        select c.id, c.category, c.fact_text, c.occurred_on, c.score, c.pinned,
               exists (
                   select 1 from eligible peer
                   where peer.id = c.conflicts_with or peer.conflicts_with = c.id
               ) as conflicting
        from candidates c
        order by c.pinned desc, c.score desc, c.reinforcement_count desc, c.id
        """;

    private static final RowMapper<Hit> ROW_MAPPER = (rs, rowNum) -> new Hit(
            rs.getObject("id", UUID.class),
            rs.getString("category"),
            rs.getString("fact_text"),
            rs.getObject("occurred_on", LocalDate.class),
            rs.getDouble("score"),
            rs.getBoolean("pinned"),
            rs.getBoolean("conflicting"));

    private final NamedParameterJdbcTemplate jdbc;

    public List<Hit> search(UUID userId, String rawQuery, LocalDate asOf, int candidateLimit) {
        String query = ToolText.fold(rawQuery).trim();
        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("userId", userId)
                .addValue("query", query)
                .addValue("asOf", asOf)
                .addValue("candidateLimit", candidateLimit);
        return underSavepoint(template -> template.query(SQL, params, ROW_MAPPER));
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
