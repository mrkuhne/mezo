package io.mrkuhne.mezo.feature.character.entity;

import java.util.List;

/** Detector events + raw data refs an observation is grounded in (spec §5). */
public record ObservationSignalsEnvelope(List<Signal> signals) {

    public record Signal(String detectorKey, String summary, List<String> refIds) {
    }
}
