package io.mrkuhne.mezo.feature.llmlog.repository;

import java.time.LocalDate;

/**
 * One feature's call count on one calendar day (admin feature-usage matrix, mezo-d5iy.6).
 * ERROR-status calls are excluded — failed calls are not usage.
 */
public interface LlmFeatureDayRow {

    LocalDate getDay();

    String getFeature();

    long getCalls();
}
