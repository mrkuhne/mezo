package io.mrkuhne.mezo.feature.companion.memory.repository;

import io.mrkuhne.mezo.feature.companion.tools.ToolText;
import java.math.BigDecimal;
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

/** Full-text plus trigram candidate query over active canonical memories. */
@Repository
@RequiredArgsConstructor
public class LexicalMemoryQuery {

    public record Hit(UUID itemId, UUID sourceId, String sourceKind, String label, String content,
                      LocalDate occurredOn, BigDecimal salience, double score) {
    }

    private static final String SAVEPOINT_NAME = "memory_lexical_retrieval";
    private static final String SQL_HEAD = """
        with scored as (
            select i.id as item_id, i.source_id, i.source_kind,
                   coalesce(i.title, i.source_kind) as label, i.content, i.occurred_on, i.salience,
                   ts_rank_cd(i.search_vector, websearch_to_tsquery('simple', :query))
                     + greatest(similarity(i.search_text, :query),
                                word_similarity(:query, i.search_text)) * 0.25 as score
            from memory_item i
            where i.created_by = :userId and i.is_deleted = false and i.state = 'active'
              and (i.valid_from is null or i.valid_from <= :asOf)
              and (i.valid_to is null or i.valid_to >= :asOf)
              and i.occurred_on <= :asOf
        """;
    private static final String EXCLUDE_CONVERSATION = """
              and not (i.source_kind = 'chat_turn' and exists (
                  select 1 from ai_message m
                  where m.id = i.source_id and m.conversation_id = :conversationId
              ))
        """;
    private static final String SQL_TAIL = """
        )
        select item_id, source_id, source_kind, label, content, occurred_on, salience, score
        from scored
        where score > 0
        order by score desc, occurred_on desc, item_id
        limit :candidateLimit
        """;

    private static final RowMapper<Hit> ROW_MAPPER = (rs, rowNum) -> new Hit(
            rs.getObject("item_id", UUID.class),
            rs.getObject("source_id", UUID.class),
            rs.getString("source_kind"),
            rs.getString("label"),
            rs.getString("content"),
            rs.getObject("occurred_on", LocalDate.class),
            rs.getBigDecimal("salience"),
            rs.getDouble("score"));

    private final NamedParameterJdbcTemplate jdbc;

    public List<Hit> search(UUID userId, String rawQuery, LocalDate asOf,
                            UUID conversationId, int candidateLimit) {
        String query = ToolText.fold(rawQuery).trim();
        if (query.isEmpty()) {
            return List.of();
        }
        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("userId", userId)
                .addValue("query", query)
                .addValue("asOf", asOf)
                .addValue("candidateLimit", candidateLimit);
        StringBuilder sql = new StringBuilder(SQL_HEAD);
        if (conversationId != null) {
            params.addValue("conversationId", conversationId);
            sql.append(EXCLUDE_CONVERSATION);
        }
        sql.append(SQL_TAIL);
        return underSavepoint(template -> template.query(sql.toString(), params, ROW_MAPPER));
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
