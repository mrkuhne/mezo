package io.mrkuhne.mezo.feature.character.entity;

import java.util.List;

/** Egy kiadás-poszt hivatkozásai más forrásokra, jsonb-mappoláshoz csomagolva. */
public record EditionRefsEnvelope(List<EditionRef> refs) {
}
