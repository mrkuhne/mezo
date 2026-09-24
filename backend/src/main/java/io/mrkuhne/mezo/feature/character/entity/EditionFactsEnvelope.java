package io.mrkuhne.mezo.feature.character.entity;

import java.util.List;

/** Rövid, ellenőrizhető tények egy kiadás-poszthoz, jsonb-mappoláshoz csomagolva (never a bare
 *  {@code List<String>} — bd hibernate-list-string-json-array-leak). */
public record EditionFactsEnvelope(List<String> facts) {
}
