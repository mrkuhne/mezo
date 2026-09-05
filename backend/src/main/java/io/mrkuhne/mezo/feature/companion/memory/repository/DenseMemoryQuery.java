package io.mrkuhne.mezo.feature.companion.memory.repository;

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

/** Owner- and generation-scoped ANN query over the canonical memory projection. */
@Repository
@RequiredArgsConstructor
public class DenseMemoryQuery {

    public record Hit(UUID itemId, UUID sourceId, String sourceKind, String label, String content,
                      LocalDate occurredOn, BigDecimal salience, double distance, UUID diversityGroupId) {
    }

    private static final String SAVEPOINT_NAME = "memory_dense_retrieval";
    private static final String SQL_HEAD = """
        select i.id as item_id, i.source_id, i.source_kind,
               coalesce(i.title, i.source_kind) as label, i.content, i.occurred_on, i.salience,
               (v.embedding <=> cast(:queryVector as vector)) as distance,
               source_message.conversation_id as diversity_group_id
        from memory_vector v
        join memory_item i on i.id = v.memory_item_id and i.created_by = :userId
        left join ai_message source_message
          on i.source_kind = 'chat_turn' and source_message.id = i.source_id
         and source_message.created_by = :userId and source_message.is_deleted = false
        where v.created_by = :userId
          and v.is_deleted = false and v.status = 'ready' and v.embedding is not null
          and v.embedding_version = :embeddingVersion
          and v.embedded_content_hash = i.content_hash
          and i.is_deleted = false and i.state = 'active'
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
        order by v.embedding <=> cast(:queryVector as vector), i.occurred_on desc, i.id
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
            rs.getDouble("distance"),
            rs.getObject("diversity_group_id", UUID.class));

    private final NamedParameterJdbcTemplate jdbc;

    public List<Hit> nearest(UUID userId, String queryVector, String embeddingVersion,
                             LocalDate asOf, UUID conversationId, int candidateLimit) {
        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("userId", userId)
                .addValue("queryVector", queryVector)
                .addValue("embeddingVersion", embeddingVersion)
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
