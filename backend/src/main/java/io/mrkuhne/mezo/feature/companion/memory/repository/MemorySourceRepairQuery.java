package io.mrkuhne.mezo.feature.companion.memory.repository;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Repository;

/** Bounded reconciliation against authoritative narratives, including missed original listeners. */
@Repository
@RequiredArgsConstructor
public class MemorySourceRepairQuery {
    public record Source(String kind, UUID id, String content, LocalDate date) {}
    private final NamedParameterJdbcTemplate jdbc;

    // Deliberate source projection, not arbitrary table access. Ownership/soft deletion apply at every branch.
    private static final String SOURCES = """
        with sources as (
          select 'journal_entry' as kind, id, text as content, occurred_on as day
            from journal_entry where created_by=:owner and not is_deleted
          union all select 'gratitude', id, text, occurred_on
            from gratitude_entry where created_by=:owner and not is_deleted
          union all select 'decision', id, decision_text || case when outcome_rating is null then ''
            else E'\n\nKimenet (' || outcome_rating || '/5):' || coalesce(' ' || outcome_text, '') end, decided_on
            from decision_entry where created_by=:owner and not is_deleted
          union all select 'reflection', id, reflection_text, ritual_date
            from ritual_day where created_by=:owner and not is_deleted and closed_at is not null
          union all select 'daily_summary', id, narrative, summary_date
            from daily_summary where created_by=:owner and not is_deleted
          union all select case when granularity='month' then 'monthly_summary' else 'weekly_summary' end,
            id, summary_text, period_start from period_summary where created_by=:owner and not is_deleted
          union all select 'activity_note', id, text, occurred_on
            from activity_log where created_by=:owner and not is_deleted
          union all select 'checkin_note', id, note, date
            from check_in where created_by=:owner and not is_deleted
          union all select 'chat_turn', a.id,
            'Felhasználó: ' || coalesce((select u.content from ai_message u
              where u.created_by=:owner and u.conversation_id=a.conversation_id and not u.is_deleted
                and u.role='user' and u.created_at<=a.created_at
              order by u.created_at desc, u.id limit 1), '') || E'\nMezo: ' || a.content,
            cast(a.created_at as date)
            from ai_message a where a.created_by=:owner and not a.is_deleted and a.role='assistant'
              and exists (select 1 from ai_conversation c where c.id=a.conversation_id and c.created_by=:owner and not c.is_deleted)
        ), live_sources as (select * from sources where content is not null and content !~ '^[[:space:]]*$')
        """;

    public List<Source> changed(UUID owner, LocalDate through, String version, int limit) {
        String sql = SOURCES + """
            select s.* from live_sources s
            where s.day<=:through
              and not exists (select 1 from memory_item i where i.created_by=:owner
                and i.source_kind=s.kind and i.source_id=s.id and i.provenance->>'suppressionReason'='user')
              and not exists (select 1 from memory_item i join memory_retrieval_feedback f
                on f.memory_item_id=i.id and f.created_by=:owner and not f.is_deleted and f.action='suppress'
                where i.created_by=:owner and i.source_kind=s.kind and i.source_id=s.id)
              and (s.content is distinct from (select string_agg(i.content, '' order by i.chunk_index)
                from memory_item i where i.created_by=:owner and i.source_kind=s.kind and i.source_id=s.id
                  and not i.is_deleted and i.state='active')
                or exists (select 1 from memory_item i where i.created_by=:owner
                  and i.source_kind=s.kind and i.source_id=s.id and not i.is_deleted and i.state='active'
                  and not exists (select 1 from memory_vector v where v.created_by=:owner
                    and v.memory_item_id=i.id and v.embedding_version=:version and not v.is_deleted
                    and v.status='ready' and v.embedded_content_hash=i.content_hash)))
            order by s.day, s.kind, s.id limit :limit
            """;
        return jdbc.query(sql, parameters(owner, limit).addValue("through", through).addValue("version", version),
                (rs, row) -> new Source(rs.getString("kind"), rs.getObject("id", UUID.class),
                        rs.getString("content"), rs.getObject("day", LocalDate.class)));
    }

    public List<Source> orphaned(UUID owner, int limit) {
        String sql = SOURCES + """
            select distinct i.source_kind as kind, i.source_id as id from memory_item i
            where i.created_by=:owner and not i.is_deleted and i.state='active'
              and i.source_kind in ('journal_entry','gratitude','decision','reflection','daily_summary',
                'weekly_summary','monthly_summary','activity_note','checkin_note','chat_turn')
              and not exists (select 1 from live_sources s where s.kind=i.source_kind and s.id=i.source_id)
            order by kind, id limit :limit
            """;
        return jdbc.query(sql, parameters(owner, limit),
                (rs, row) -> new Source(rs.getString("kind"), rs.getObject("id", UUID.class), null, null));
    }

    private static MapSqlParameterSource parameters(UUID owner, int limit) {
        return new MapSqlParameterSource().addValue("owner", owner).addValue("limit", limit);
    }
}
