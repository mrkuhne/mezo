package io.mrkuhne.mezo.feature.capacity.service;

import io.mrkuhne.mezo.feature.capacity.port.CapacityCalendarPort;
import io.mrkuhne.mezo.feature.wearable.entity.CalendarEventEntity;
import io.mrkuhne.mezo.feature.wearable.repository.CalendarEventRepository;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/** {@link CapacityCalendarPort} over the wearable's calendar snapshot (live rows only). */
@Component
@RequiredArgsConstructor
public class CapacityCalendarAdapter implements CapacityCalendarPort {

    private final CalendarEventRepository events;

    @Override
    @Transactional(readOnly = true)
    public List<CalendarEventView> events(UUID owner, LocalDate from, LocalDate to) {
        return events.findByCreatedByAndDeletedFalseAndDateBetweenOrderByStartAt(owner, from, to).stream()
            .map(CapacityCalendarAdapter::view).toList();
    }

    private static CalendarEventView view(CalendarEventEntity e) {
        return new CalendarEventView(e.getId(), e.getExternalId(), e.getDate(), e.getTitle(), e.getStartAt(),
            e.getEndAt(), e.isAllDay(), e.getCalendarName(), e.getAttendeeCount(),
            e.getAttendeeNames() == null ? List.of() : List.copyOf(e.getAttendeeNames()), e.getOrganizerIsMe(),
            e.getLocation(), e.getRecurring(), e.getAvailability(), e.getNotes());
    }
}
