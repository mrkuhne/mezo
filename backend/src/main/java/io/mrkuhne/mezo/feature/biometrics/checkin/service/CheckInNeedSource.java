package io.mrkuhne.mezo.feature.biometrics.checkin.service;

import java.util.List;
import java.util.UUID;

/**
 * Port (mezo-ck2, spec §2.3): which non-core check-in items some consumer is currently waiting
 * on for this user — an active hypothesis, an open pattern pair, an enabled detector — and WHY,
 * as a ready Hungarian sentence. The question-of-the-day chooser merges every specific source
 * (in bean order, so the first source's sentence wins for an item) and, on a need draw, asks the
 * thinnest of those series. Only when no specific source wants anything does it fall back to the
 * {@link #fallback()} sources. Other features plug in by adding an implementation; biometrics never
 * depends on them directly.
 */
public interface CheckInNeedSource {

    /**
     * One wanted item.
     *
     * @param item the check-in item
     * @param why  the full Hungarian "why" sentence shown under "A NAP KÉRDÉSE"; {@code null} =
     *             use the generic need sentence
     */
    record Need(CheckInItem item, String why) {}

    /** Items wanted for {@code userId}, most specific reason first; empty = waits on nothing. */
    List<Need> needs(UUID userId);

    /** A fallback source is consulted only when every specific source came back empty. */
    default boolean fallback() {
        return false;
    }
}
