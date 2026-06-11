package io.mrkuhne.mezo.feature.train.entity;

import java.util.List;

/** Weekly recompute audit, stored verbatim as jsonb on mesocycle (display strings included). */
public record VolumeRecomputeJson(String lastRun, String nextRun, String trigger, List<Change> changes) {
    public record Change(String muscle, String change, String reason, Boolean warning) {}
}
