package io.mrkuhne.mezo.feature.wearable.service;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * Published inside {@link CalendarSnapshotService#replace} once a calendar-days PUT is applied (Boop B7 K1,
 * mezo-r36n9.17). Listeners take it AFTER_COMMIT (e.g. the capacity feature scores the coming days in the
 * background); wearable knows none of them.
 *
 * @param owner the account whose calendar changed
 * @param dates the days the PUT replaced
 */
public record CalendarDaysReplacedEvent(UUID owner, List<LocalDate> dates) {

    public CalendarDaysReplacedEvent {
        dates = List.copyOf(dates);
    }
}
