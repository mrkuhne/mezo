package io.mrkuhne.mezo.feature.companion.entity;

import java.util.ArrayList;
import java.util.List;

/** S8 (mezo-d6ivw.12): typed jsonb envelope for ai_message.forgotten_memories — the
 *  {@link RecalledMemoriesEnvelope} precedent: null when nothing was forgotten. */
public record ForgottenMemoriesEnvelope(List<ChatMemoryItem> items) {

    public static ForgottenMemoriesEnvelope ofOrNull(List<ChatMemoryItem> items) {
        return items == null || items.isEmpty() ? null : new ForgottenMemoriesEnvelope(List.copyOf(items));
    }

    /** The widen-to-conversation step appends to the triggering message's envelope. */
    public static ForgottenMemoriesEnvelope append(ForgottenMemoriesEnvelope base, List<ChatMemoryItem> more) {
        List<ChatMemoryItem> all = new ArrayList<>(base == null ? List.of() : base.items());
        more.stream().filter(i -> !all.contains(i)).forEach(all::add);
        return ofOrNull(all);
    }
}
