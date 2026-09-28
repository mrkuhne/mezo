package io.mrkuhne.mezo.feature.companion.entity;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Typed jsonb envelope for ai_message.recalled_memories (W3.1b, mezo-b3pp.28) — what the
 * [Emlékek] block carried into this answer's prompt, in prompt order. The RefsEnvelope precedent:
 * null when nothing was recalled; {@code label}/{@code gist} are snapshots of what was rendered.
 */
public record RecalledMemoriesEnvelope(List<Item> items) {

    public record Item(
            String kind,
            UUID refId,
            LocalDate occurredOn,
            String label,
            String gist,
            double similarity,
            UUID retrievalRunId,
            UUID retrievalResultId,
            UUID memoryItemId,
            String indicator) {

        /** Legacy JSON and callers keep the exact pre-platform shape; new keys remain absent/null. */
        public Item(String kind, UUID refId, LocalDate occurredOn, String label, String gist, double similarity) {
            this(kind, refId, occurredOn, label, gist, similarity, null, null, null, null);
        }
    }

    /** S8 (mezo-d6ivw.12): the deterministic people recall's item kind ("Emlékszem"). */
    public static final String KIND_PERSON = "person";

    /** {@code base} plus {@code extra} items not already in it — null when both are empty. */
    public static RecalledMemoriesEnvelope withExtra(RecalledMemoriesEnvelope base, List<Item> extra) {
        List<Item> all = new ArrayList<>(base == null ? List.of() : base.items());
        extra.stream().filter(item -> !all.contains(item)).forEach(all::add);
        return ofOrNull(all);
    }

    /** S8: the {@code kind=person} items of an envelope — empty when none (or no envelope). */
    public static List<Item> personItems(RecalledMemoriesEnvelope envelope) {
        return envelope == null ? List.of()
                : envelope.items().stream().filter(item -> KIND_PERSON.equals(item.kind())).toList();
    }

    /** Null (not an empty envelope) when nothing was recalled — a jsonb column is either a
     *  disclosure or absent, and every pre-W3.1b row is already null. */
    public static RecalledMemoriesEnvelope ofOrNull(List<Item> items) {
        return items == null || items.isEmpty() ? null : new RecalledMemoriesEnvelope(List.copyOf(items));
    }
}
