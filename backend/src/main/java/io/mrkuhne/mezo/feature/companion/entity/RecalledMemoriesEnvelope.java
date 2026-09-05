package io.mrkuhne.mezo.feature.companion.entity;

import java.time.LocalDate;
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

    /** Null (not an empty envelope) when nothing was recalled — a jsonb column is either a
     *  disclosure or absent, and every pre-W3.1b row is already null. */
    public static RecalledMemoriesEnvelope ofOrNull(List<Item> items) {
        return items == null || items.isEmpty() ? null : new RecalledMemoriesEnvelope(List.copyOf(items));
    }
}
