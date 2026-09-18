package io.mrkuhne.mezo.feature.companion.repository;

import io.mrkuhne.mezo.feature.companion.memory.repository.MemorySourceVisibilitySql;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

/** Native JSON projection is deliberate: heterogeneous, allowlisted, read-only domain records. */
@Repository
@RequiredArgsConstructor
public class PersonalRecordQuery {
    public record Row(UUID id, String content) {}
    private final NamedParameterJdbcTemplate jdbc;

    public List<Row> read(UUID user, PersonalRecordSource source, UUID id, UUID parent,
            LocalDate from, LocalDate to, String query, int offset, int limit) {
        var parameters = new MapSqlParameterSource("user", user).addValue("offset", offset)
                .addValue("limit", limit);
        String where = visible(source, "t", 0);
        if (id != null) {
            where += " and t.id = :id";
            parameters.addValue("id", id);
        }
        if (parent != null) {
            where += " and t." + source.parentColumn() + " = :parent";
            parameters.addValue("parent", parent);
        }
        String date = dateExpression(source, "t");
        if (from != null) {
            where += " and (" + date + ")::date >= :from";
            parameters.addValue("from", from);
        }
        if (to != null) {
            where += " and (" + date + ")::date <= :to";
            parameters.addValue("to", to);
        }
        String fields = source.fields().stream().map(f -> "t." + f).collect(Collectors.joining(","));
        // The identifier fragments above come ONLY from the static catalogue, never model input.
        String projection = "(select row_to_json(projected)::text from (select " + fields + ") projected)";
        if (query != null && !query.isBlank()) {
            where += " and strpos(lower(" + projection + "), lower(:query)) > 0";
            parameters.addValue("query", query);
        }
        String sql = "select t.id, " + projection + " as content from " + source.name()
                + " t where " + where + " order by " + date + " desc nulls last, t.id"
                + " limit :limit offset :offset";
        return jdbc.query(sql, parameters,
                (rs, row) -> new Row(rs.getObject("id", UUID.class), rs.getString("content")));
    }

    private String visible(PersonalRecordSource source, String alias, int depth) {
        String predicate = alias + ".is_deleted = false"
                + (source.shared() ? "" : " and " + alias + ".created_by = :user");
        if (!source.parentSource().isEmpty()) {
            String parentAlias = "p" + depth;
            var parent = PersonalRecordSource.named(source.parentSource());
            predicate += " and (" + alias + "." + source.parentColumn() + " is null or exists (select 1 from "
                    + parent.name() + " " + parentAlias + " where " + parentAlias + ".id = "
                    + alias + "." + source.parentColumn() + " and " + visible(parent, parentAlias, depth + 1) + "))";
        }
        if (source.name().equals("exercise_set") || source.name().equals("exercise_feedback")) {
            predicate += " and exists (select 1 from exercise e where e.id = " + alias
                    + ".exercise_id and e.created_by = :user and e.is_deleted = false)";
        }
        if (source.name().equals("memory_item")) {
            predicate += " and " + alias + ".state = 'active' and " + MemorySourceVisibilitySql.predicate(alias, "user");
        }
        return predicate;
    }

    private String dateExpression(PersonalRecordSource source, String alias) {
        if (source.dateColumn().isEmpty()) return "null::date";
        if (source.dateColumn().contains(".")) {
            var parts = source.dateColumn().split("\\.");
            return "(select d." + parts[1] + " from " + parts[0] + " d where d.id = "
                    + alias + "." + source.parentColumn() + ")";
        }
        return alias + "." + source.dateColumn();
    }
}
