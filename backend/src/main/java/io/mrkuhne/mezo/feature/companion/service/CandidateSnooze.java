package io.mrkuhne.mezo.feature.companion.service;

import java.time.Duration;

/** „Most ne” (U9b, mezo-zpxv7): a snoozed candidate leaves the inbox for this long, then is re-offered. */
public final class CandidateSnooze {
    public static final Duration DURATION = Duration.ofDays(14);

    private CandidateSnooze() {
    }
}
