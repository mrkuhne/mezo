package io.mrkuhne.mezo.feature.biometrics.sleep.service;

import java.time.LocalTime;
import java.util.UUID;

/** Read seam for the day's wake/bed anchor — habit/fuel consumers depend on this, never on the goal row. */
public interface SleepAnchorPort {

    record SleepAnchor(LocalTime wake, LocalTime bed) {}

    /** Resolves the user's anchor pair; config-default ghost when no goal row exists (never empty). */
    SleepAnchor resolve(UUID userId);
}
