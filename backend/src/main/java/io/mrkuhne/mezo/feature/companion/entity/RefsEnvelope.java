package io.mrkuhne.mezo.feature.companion.entity;

import java.util.List;

/**
 * Typed jsonb envelope for ai_message.refs — the data references backing an assistant answer.
 * V0.2 only persists null; V0.5 fills it. Mirrors the FE mock ChatRef contract { kind, id, label }.
 */
public record RefsEnvelope(List<Ref> refs) {

    /** {@code label}: human name for the referenced entity when the producer knows one
     *  (mezo-b3pp.33) — today only GraphNode refs carry it (the graph node's title). Null for
     *  every other kind, and for the ~jsonb rows persisted before this field existed — those
     *  deserialise with {@code label = null} exactly like a producer that never had one. */
    public record Ref(String kind, String id, String label) {
        /** The label-less form every non-graph producer uses — keeps the existing call sites
         *  unchanged and makes "no label" explicit rather than accidental (mezo-b3pp.33). */
        public Ref(String kind, String id) {
            this(kind, id, null);
        }
    }
}
