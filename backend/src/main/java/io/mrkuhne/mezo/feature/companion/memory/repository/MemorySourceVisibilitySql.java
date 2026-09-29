package io.mrkuhne.mezo.feature.companion.memory.repository;

/** Immediate source tombstone checks, independent of asynchronous projection/legacy embedding repair. */
public final class MemorySourceVisibilitySql {
    private MemorySourceVisibilitySql() {}

    /** Alias and named parameter are internal SQL identifiers, never user-provided values. */
    public static String predicate(String itemAlias, String ownerParameter) {
        return SQL.replace("{item}", itemAlias).replace("{owner}", ":" + ownerParameter);
    }

    /**
     * mezo-tdabt ("ezt ne jegyezd meg" really forgets): a boolean SQL expression, true when the chat
     * turn of the ASSISTANT row {@code assistantAlias} is forgotten — its paired user message is
     * {@code extraction_blocked}. The pairing is exactly {@link MemorySourceRepairQuery}'s chat_turn
     * projection: the latest non-deleted {@code role='user'} row of the same conversation with
     * {@code created_at <=} the assistant's, ties broken by id. No user row = not forgotten.
     */
    public static String forgottenTurn(String assistantAlias, String ownerParameter) {
        // padded + parenthesised: text blocks strip the trailing space of a preceding "and not "
        return " (" + FORGOTTEN_TURN.replace("{a}", assistantAlias).replace("{owner}", ":" + ownerParameter) + ") ";
    }

    private static final String FORGOTTEN_TURN = """
        coalesce((select u.extraction_blocked from ai_message u
          where u.created_by={owner} and u.conversation_id={a}.conversation_id and not u.is_deleted
            and u.role='user' and u.created_at<={a}.created_at
          order by u.created_at desc, u.id limit 1), false)""";

    // The chat_turn branch also hides a forgotten turn (mezo-tdabt); {owner} is substituted by predicate().
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
          or ({item}.source_kind='character_reply' and exists (select 1 from character_reply s
            where s.id={item}.source_id and s.created_by={owner} and s.is_deleted))
          or ({item}.source_kind='chat_turn' and exists (select 1 from ai_message s
            left join ai_conversation c on c.id=s.conversation_id and c.created_by={owner}
            where s.id={item}.source_id and s.created_by={owner}
              and (s.is_deleted or c.is_deleted or s.content ~ '^[[:space:]]*$'
                or (""" + FORGOTTEN_TURN.replace("{a}", "s") + """
          ))))
        )
        """;
}
