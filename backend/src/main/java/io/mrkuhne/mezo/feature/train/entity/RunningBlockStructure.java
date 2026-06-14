package io.mrkuhne.mezo.feature.train.entity;

import java.util.List;

/**
 * The week→session→segment plan tree, stored verbatim as jsonb on {@code running_block}
 * (the {@link VolumeRecomputeJson} pattern). Authored/read as a whole; never queried by
 * a single segment.
 */
public record RunningBlockStructure(List<RunWeek> weeks) {

    public record RunWeek(Integer weekNumber, String phaseLabel, List<RunPrescribedSession> sessions) {}

    public record RunPrescribedSession(
        String key,
        Integer dayOfWeek,            // 0=Hét..6=Vas
        String label,
        String kind,                  // sprint|pyramid|steady
        RpeTarget rpeTarget,
        Integer rounds,               // sprint kind only; null otherwise
        List<RunSegment> segments) {}

    public record RunSegment(String type, Integer durationSec, String label) {} // type: warmup|work|rest|cooldown

    public record RpeTarget(Integer min, Integer max) {}
}
