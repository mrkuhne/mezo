package io.mrkuhne.mezo.feature.character.entity;

import java.util.List;

/** Vendég-hozzászólások egy kiadás-poszton, jsonb-mappoláshoz csomagolva. */
public record EditionGuestsEnvelope(List<Guest> guests) {

    public record Guest(String characterKey, String body, boolean voiced) {
    }
}
