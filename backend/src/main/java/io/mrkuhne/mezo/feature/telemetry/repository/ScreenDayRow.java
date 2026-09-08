package io.mrkuhne.mezo.feature.telemetry.repository;

import java.time.LocalDate;

/** One screen's view count on one calendar day, cut in the admin report zone (bd mezo-o5cz). */
public interface ScreenDayRow {

    String getScreen();

    LocalDate getDay();

    long getViews();
}
