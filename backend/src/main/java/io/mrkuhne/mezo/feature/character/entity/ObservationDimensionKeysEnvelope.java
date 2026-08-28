package io.mrkuhne.mezo.feature.character.entity;

import java.util.List;

/** Dimension keys an observation may inform (Karakter spec §5), wrapped for JSON mapping. */
public record ObservationDimensionKeysEnvelope(List<String> keys) {
}
