package io.mrkuhne.mezo.feature.character.entity;

import java.util.List;

/** Distinct expert keys involved in a {@code character_run} row (Karakter S9 spec §3),
 *  wrapped for JSON mapping (never a bare {@code List<String>} — bd hibernate-list-string-json-array-leak). */
public record RunExpertKeysEnvelope(List<String> keys) {
}
