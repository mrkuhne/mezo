package io.mrkuhne.mezo.feature.character.entity;

import java.time.Instant;
import java.util.List;
import java.util.Map;

/** The {@code AdviceActionCatalog} actions offered on a team chat thread, jsonb-mapped
 *  (mezo-a9bo7.21, Csapatfal Act III spec §5.1). Never a bare {@code List<Action>} — bd
 *  hibernate-list-string-json-array-leak. */
public record TeamChatActionsEnvelope(List<Action> actions) {

    public record Action(String key, String label, Map<String, Object> params) {
    }

    /** {@code team_chat_thread.applied} once the user has taken one of the offered actions. */
    public record Applied(String actionKey, Instant at) {
    }
}
