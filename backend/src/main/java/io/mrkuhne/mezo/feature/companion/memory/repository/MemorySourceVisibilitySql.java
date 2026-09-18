package io.mrkuhne.mezo.feature.companion.memory.repository;

/** Immediate source tombstone checks, independent of asynchronous projection/legacy embedding repair. */
public final class MemorySourceVisibilitySql {
    private MemorySourceVisibilitySql() {}

    /** Alias and named parameter are internal SQL identifiers, never user-provided values. */
    public static String predicate(String itemAlias, String ownerParameter) {
        return SQL.replace("{item}", itemAlias).replace("{owner}", ":" + ownerParameter);
    }

    private static final String SQL = """
        not (
          ({item}.source_kind='journal_entry' and exists (select 1 from journal_entry s
            where s.id={item}.source_id and s.created_by={owner} and (s.is_deleted or s.text ~ '^[[:space:]]*$')))
          or ({item}.source_kind='gratitude' and exists (select 1 from gratitude_entry s
            where s.id={item}.source_id and s.created_by={owner} and (s.is_deleted or s.text ~ '^[[:space:]]*$')))
          or ({item}.source_kind='decision' and exists (select 1 from decision_entry s
            where s.id={item}.source_id and s.created_by={owner} and s.is_deleted))
          or ({item}.source_kind='reflection' and exists (select 1 from ritual_day s
            where s.id={item}.source_id and s.created_by={owner}
              and (s.is_deleted or s.closed_at is null or coalesce(s.reflection_text,'') ~ '^[[:space:]]*$')))
          or ({item}.source_kind='daily_summary' and exists (select 1 from daily_summary s
            where s.id={item}.source_id and s.created_by={owner} and s.is_deleted))
          or ({item}.source_kind in ('weekly_summary','monthly_summary') and exists (select 1 from period_summary s
            where s.id={item}.source_id and s.created_by={owner} and s.is_deleted))
          or ({item}.source_kind='activity_note' and exists (select 1 from activity_log s
            where s.id={item}.source_id and s.created_by={owner} and (s.is_deleted or s.text ~ '^[[:space:]]*$')))
          or ({item}.source_kind='checkin_note' and exists (select 1 from check_in s
            where s.id={item}.source_id and s.created_by={owner}
              and (s.is_deleted or coalesce(s.note,'') ~ '^[[:space:]]*$')))
          or ({item}.source_kind='chat_turn' and exists (select 1 from ai_message s
            left join ai_conversation c on c.id=s.conversation_id and c.created_by={owner}
            where s.id={item}.source_id and s.created_by={owner}
              and (s.is_deleted or c.is_deleted or s.content ~ '^[[:space:]]*$')))
        )
        """;
}
