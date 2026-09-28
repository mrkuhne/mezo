package io.mrkuhne.mezo.feature.biometrics.checkin.service;

import java.util.Set;
import java.util.UUID;

/**
 * Port (mezo-ck2, spec §2.3): which non-core check-in items some consumer is currently waiting
 * on for this user — an active hypothesis, an open pattern pair, an enabled detector. The
 * question-of-the-day chooser unions every bean's answer and, on a need draw, asks the thinnest
 * of those series. Other features plug in by adding an implementation; biometrics never depends
 * on them directly.
 */
public interface CheckInNeedSource {

    /** Items wanted for {@code userId}; empty = this source waits on nothing. */
    Set<CheckInItem> wantedItems(UUID userId);
}
