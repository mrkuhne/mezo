package io.mrkuhne.mezo.feature.character.entity;

import java.util.List;

/** The persisted konzílium exchange, turn by turn, as it actually ran (spec §3/§4). */
public record ConferenceTranscriptEnvelope(List<Turn> turns) {

    public record Turn(String persona, String text, List<String> refIds) {
    }
}
