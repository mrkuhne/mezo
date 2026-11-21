package io.mrkuhne.mezo.feature.capacity.port;

import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;

/** What capacity needs from the watch's daily totals (consumer-owned port; wearable never imports capacity). */
public interface CapacityMetricsPort {

    /** One synced day; a column the watch did not send is null. */
    record DayMetric(LocalDate date, Integer restingHr, Double hrvMs) {
    }

    /** Every synced day of {@code from..to} (inclusive); a day with no row is absent. */
    Map<LocalDate, DayMetric> metrics(UUID owner, LocalDate from, LocalDate to);
}
