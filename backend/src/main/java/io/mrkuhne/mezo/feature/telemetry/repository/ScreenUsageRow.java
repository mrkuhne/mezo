package io.mrkuhne.mezo.feature.telemetry.repository;

import java.time.Instant;

/** One screen's totals over the admin read window (bd mezo-o5cz). */
public interface ScreenUsageRow {

    String getScreen();

    long getViews();

    long getUniqueUsers();

    Instant getLastSeenAt();
}
