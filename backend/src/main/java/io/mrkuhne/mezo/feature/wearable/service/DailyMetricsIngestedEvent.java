package io.mrkuhne.mezo.feature.wearable.service;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * Published inside {@link DailyMetricService#ingest} once an Apple Health day-totals batch is upserted (Boop B7 K3,
 * mezo-r36n9.17). Listeners take it AFTER_COMMIT (e.g. the capacity feature re-reads today's verdict); wearable knows
 * none of them.
 *
 * @param owner the account whose day totals changed
 * @param dates the days the batch carried
 */
public record DailyMetricsIngestedEvent(UUID owner, List<LocalDate> dates) {

    public DailyMetricsIngestedEvent {
        dates = List.copyOf(dates);
    }
}
