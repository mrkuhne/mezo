package io.mrkuhne.mezo.feature.capacity.port;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/** What capacity needs from the synced device calendar (consumer-owned port; wearable never imports capacity). */
public interface CapacityCalendarPort {

    /** One live calendar event with every field the scoring needs; nullable fields mirror the snapshot. */
    record CalendarEventView(UUID id, String externalId, LocalDate date, String title, Instant start, Instant end,
                             boolean allDay, String calendarName, Integer attendeeCount, List<String> attendeeNames,
                             Boolean organizerIsMe, String location, Boolean recurring, String availability,
                             String notes) {
    }

    /** His live events whose date is in {@code from..to} (inclusive), chronological. */
    List<CalendarEventView> events(UUID owner, LocalDate from, LocalDate to);
}
