package io.mrkuhne.mezo.feature.biometrics.checkin.service;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

/**
 * Port: the owner's biomarkers around a moment, for the server-side snapshot of a check-in that arrived
 * without one (Boop B3, mezo-r36n9.13, spec §7.3). Implemented in {@code wearable}, which owns the Health
 * data — biometrics must not import wearable (precedent {@code SleepAnchorPort}).
 */
public interface CheckInBiomarkerSource {

    /** The readings around {@code at}; empty when there is nothing to read. */
    Optional<CheckInSnapshotValues> snapshotAt(UUID owner, Instant at);

    /** One snapshot's readings — every field nullable. */
    record CheckInSnapshotValues(Integer hrBpm, Instant hrAt, Double hrvMs, Instant hrvAt, Double hrvUsualMs,
                                 Integer steps, Boolean stepsIsDayTotal, Integer sleepMinutes, String source) {
    }
}
