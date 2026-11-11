package io.mrkuhne.mezo.feature.train.service;

import java.time.Instant;
import java.util.UUID;

/**
 * A session the owner logged in train, flattened for read-only consumers that do not own the
 * train model (the wearable workout reconciler, Boop's day load). {@code start}/{@code end} are
 * null when the log carries no trustworthy time (a sport without a clock time; a gym session
 * with no finish, no active seconds and no estimate); {@code minutes} is always a best-effort
 * duration (0 when unknown).
 */
public record LoggedSession(Kind kind, UUID id, String sport, Instant start, Instant end, int minutes, Integer kcal) {

    public enum Kind { GYM, SPORT }
}
