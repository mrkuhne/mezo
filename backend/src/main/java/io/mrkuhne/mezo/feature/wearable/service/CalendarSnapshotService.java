package io.mrkuhne.mezo.feature.wearable.service;

import io.mrkuhne.mezo.api.dto.CalendarDayIn;
import io.mrkuhne.mezo.api.dto.CalendarEventIn;
import io.mrkuhne.mezo.feature.wearable.config.WearableProperties;
import io.mrkuhne.mezo.feature.wearable.repository.CalendarEventRepository;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Device-calendar history (Boop S2 + B1, mezo-r36n9.2 / .11): each sent day is upserted by the
 *  EventKit id; live rows of that day missing from the payload are soft-deleted (cancelled). Days
 *  not sent are never touched. Boop never writes back to the calendar. */
@Service
@RequiredArgsConstructor
public class CalendarSnapshotService {

    private final CalendarEventRepository repository;
    private final WearableProperties properties;

    @Transactional
    public void replace(UUID createdBy, List<CalendarDayIn> days) {
        WearableBatches.requireAtMost(days.size(), properties.maxCalendarDays());
        for (CalendarDayIn day : days) {
            WearableBatches.requireAtMost(day.getEvents().size(), properties.maxEventsPerDay());
        }
        for (CalendarDayIn day : days) {
            Map<String, CalendarEventIn> byId = new LinkedHashMap<>(); // last wins per (externalId, date)
            for (CalendarEventIn e : day.getEvents()) {
                byId.put(e.getExternalId(), e);
            }
            for (CalendarEventIn e : byId.values()) {
                repository.upsert(createdBy, e.getExternalId(), day.getDate(), e.getTitle(), e.getStartAt().toInstant(),
                    e.getEndAt().toInstant(), Boolean.TRUE.equals(e.getAllDay()), e.getCalendarName());
            }
            if (byId.isEmpty()) {
                repository.softDeleteDay(createdBy, day.getDate());
            } else {
                repository.softDeleteMissing(createdBy, day.getDate(), byId.keySet());
            }
        }
    }
}
