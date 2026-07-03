package io.mrkuhne.mezo.feature.companion.entity;

import java.util.List;

/**
 * Typed jsonb envelope for ai_message.refs — the data references backing an assistant answer.
 * V0.2 only persists null; V0.5 fills it. Mirrors the FE mock ChatRef contract { kind, id }.
 */
public record RefsEnvelope(List<Ref> refs) {

    public record Ref(String kind, String id) {
    }
}
