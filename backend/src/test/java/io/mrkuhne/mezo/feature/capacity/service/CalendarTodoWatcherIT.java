package io.mrkuhne.mezo.feature.capacity.service;

import static java.util.concurrent.TimeUnit.SECONDS;
import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;

import io.mrkuhne.mezo.api.dto.CalendarDayIn;
import io.mrkuhne.mezo.api.dto.CalendarEventIn;
import io.mrkuhne.mezo.feature.capacity.entity.DayAdjustmentEntity;
import io.mrkuhne.mezo.feature.capacity.repository.DayAdjustmentRepository;
import io.mrkuhne.mezo.feature.wearable.config.WearableProperties;
import io.mrkuhne.mezo.feature.wearable.service.CalendarSnapshotService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

/**
 * Boop B7 K3 (mezo-r36n9.17): a waiting calendar to-do is resolved by the next calendar PUT — moved to the agreed time
 * (±5 min) with the original gone → done; cancelled (no event of the key left on the day) → done; the day passed →
 * expired and never resurrected. Driven through the real PUT service, so the AFTER_COMMIT event fires.
 */
@ActiveProfiles("companion-fake")
class CalendarTodoWatcherIT extends AbstractIntegrationTest {

    @Autowired private CalendarSnapshotService calendarSnapshot;
    @Autowired private DayAdjustmentRepository adjustments;
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private WearableProperties wearable;
    @Autowired private JdbcTemplate jdbc;

    private ZoneId zone() {
        return ZoneId.of(wearable.zone());
    }

    private LocalDate friday() {
        return LocalDate.now(zone()).plusDays(2);
    }

    private OffsetDateTime at(LocalDate d, int h, int m) {
        return d.atTime(LocalTime.of(h, m)).atZone(zone()).toOffsetDateTime();
    }

    private CalendarEventIn event(String key, OffsetDateTime start) {
        return new CalendarEventIn().externalId(key).title("Csapat sync").startAt(start).endAt(start.plusHours(1))
            .allDay(false);
    }

    private void put(UUID owner, LocalDate d, CalendarEventIn... events) {
        calendarSnapshot.replace(owner, List.of(new CalendarDayIn().date(d).events(List.of(events))));
    }

    private UUID todo(UUID owner, LocalDate date, String action, Instant toStart) {
        DayAdjustmentEntity e = new DayAdjustmentEntity();
        e.setCreatedBy(owner);
        e.setDate(date);
        e.setKind("CALENDAR_TODO");
        e.setPayload(new AdjustmentPayload.CalendarTodo(date, "ek-watch", action, toStart,
            toStart == null ? null : toStart.plusSeconds(3600)).toMap());
        e.setBundleId(UUID.randomUUID());
        e.setState("waiting");
        e.setClientRef(UUID.randomUUID());
        return adjustments.saveAndFlush(e).getId();
    }

    private String state(UUID id) {
        return jdbc.queryForObject("select state from day_adjustment where id = ?", String.class, id);
    }

    @Test
    void movedEventMarksTodoDone() {
        UUID owner = databasePopulator.populateUser("cap-todo1@test.local");
        LocalDate d = friday();
        put(owner, d, event("ek-watch|1", at(d, 14, 0)));
        UUID id = todo(owner, d, "move", at(d, 16, 0).toInstant());

        // still at the old time: stays waiting (the sync ran, nothing to see yet)
        put(owner, d, event("ek-watch|1", at(d, 14, 0)));
        await().during(1, SECONDS).atMost(5, SECONDS).untilAsserted(() -> assertThat(state(id)).isEqualTo("waiting"));

        // moved to 16:02 (client rounding) — the agreed time within tolerance
        put(owner, d, event("ek-watch|1", at(d, 16, 2)));
        await().atMost(15, SECONDS).untilAsserted(() -> assertThat(state(id)).isEqualTo("done"));
    }

    @Test
    void cancelledEventMarksDone() {
        UUID owner = databasePopulator.populateUser("cap-todo2@test.local");
        LocalDate d = friday();
        put(owner, d, event("ek-watch|1", at(d, 14, 0)));
        UUID id = todo(owner, d, "cancel", null);
        put(owner, d, event("ek-watch|1", at(d, 14, 0)));
        await().during(1, SECONDS).atMost(5, SECONDS).untilAsserted(() -> assertThat(state(id)).isEqualTo("waiting"));

        put(owner, d, event("ek-other", at(d, 9, 0)));
        await().atMost(15, SECONDS).untilAsserted(() -> assertThat(state(id)).isEqualTo("done"));
    }

    @Test
    void dayPassedExpiresTodoAndExpiredIsNeverResurrected() {
        UUID owner = databasePopulator.populateUser("cap-todo3@test.local");
        LocalDate yesterday = LocalDate.now(zone()).minusDays(1);
        UUID id = todo(owner, yesterday, "cancel", null);
        // an unrelated PUT on another day triggers the sweep
        put(owner, LocalDate.now(zone()).plusDays(1), event("ek-other", at(LocalDate.now(zone()).plusDays(1), 9, 0)));
        await().atMost(15, SECONDS).untilAsserted(() -> assertThat(state(id)).isEqualTo("expired"));

        // the day's events are gone from the calendar, yet the expired row is not turned into done
        put(owner, yesterday, event("ek-other", at(yesterday, 9, 0)));
        await().during(2, SECONDS).atMost(8, SECONDS).untilAsserted(() -> assertThat(state(id)).isEqualTo("expired"));
    }
}
