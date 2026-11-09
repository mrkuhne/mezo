package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.wearable.entity.CalendarEventEntity;
import io.mrkuhne.mezo.feature.wearable.repository.CalendarEventRepository;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;

/** Test data factory for CalendarEvent (Boop S2, mezo-r36n9.2) — one populator per aggregate,
 *  persisted with {@code saveAndFlush} so DB CHECKs fire. */
@TestComponent
@RequiredArgsConstructor
public class CalendarEventPopulator {

    private final CalendarEventRepository repository;

    public CalendarEventEntity createEvent(UUID owner, LocalDate date, String title, Instant start, Instant end) {
        CalendarEventEntity e = new CalendarEventEntity();
        e.setCreatedBy(owner);
        e.setDate(date);
        e.setTitle(title);
        e.setStartAt(start);
        e.setEndAt(end);
        e.setAllDay(false);
        return repository.saveAndFlush(e);
    }
}
