package io.mrkuhne.mezo.feature.companion.service;

import java.util.Locale;

/** How a scalar pattern metric should be grouped and rendered outside the statistics engine. */
public enum MetricValueKind {
    NUMBER,
    CLOCK_HOUR,
    BINARY;

    public String wireKey() {
        return name().toLowerCase(Locale.ROOT);
    }
}
