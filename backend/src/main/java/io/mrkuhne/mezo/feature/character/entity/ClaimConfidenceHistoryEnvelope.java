package io.mrkuhne.mezo.feature.character.entity;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/** Compact confidence movement history for the claim detail UI (spec §4). */
public record ClaimConfidenceHistoryEnvelope(List<Point> points) {

    public record Point(BigDecimal value, String cause, Instant at) {
    }
}
