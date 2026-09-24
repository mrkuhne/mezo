package io.mrkuhne.mezo.feature.character.entity;

/** A kiadás-poszt egy hivatkozása egy másik forrásra (pattern, prediction, pair, ...).
 *  Az `entity` csomagban él, mert a Task 3 jsonb-envelope-ja is ezt tárolja. */
public record EditionRef(String kind, String id) {
}
