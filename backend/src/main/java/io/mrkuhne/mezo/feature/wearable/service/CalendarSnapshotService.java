package io.mrkuhne.mezo.feature.wearable.service;

import io.mrkuhne.mezo.api.dto.CalendarDayIn;
import io.mrkuhne.mezo.api.dto.CalendarEventIn;
import io.mrkuhne.mezo.feature.wearable.config.WearableProperties;
import io.mrkuhne.mezo.feature.wearable.entity.CalendarEventEntity;
import io.mrkuhne.mezo.feature.wearable.repository.CalendarEventRepository;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Device-calendar snapshot (Boop S2, mezo-r36n9.2): each given day's rows are replaced by the
 *  events sent for it; an empty list clears the day. Boop never writes back to the calendar. */
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
            repository.deleteDay(createdBy, day.getDate());
            repository.saveAllAndFlush(day.getEvents().stream().map(e -> toEntity(createdBy, day, e)).toList());
        }
    }

    private static CalendarEventEntity toEntity(UUID createdBy, CalendarDayIn day, CalendarEventIn in) {
        CalendarEventEntity e = new CalendarEventEntity();
        e.setCreatedBy(createdBy); // server-side from principal, never from client
        e.setDate(day.getDate());
        e.setTitle(in.getTitle());
        e.setStartAt(in.getStartAt().toInstant());
        e.setEndAt(in.getEndAt().toInstant());
        e.setAllDay(Boolean.TRUE.equals(in.getAllDay()));
        e.setCalendarName(in.getCalendarName());
        return e;
    }
}
