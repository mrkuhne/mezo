package io.mrkuhne.mezo.feature.wearable;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.api.dto.CalendarDayIn;
import io.mrkuhne.mezo.api.dto.CalendarEventIn;
import io.mrkuhne.mezo.api.dto.DailyMetricIn;
import io.mrkuhne.mezo.api.dto.IngestResult;
import io.mrkuhne.mezo.api.dto.WorkoutIn;
import io.mrkuhne.mezo.feature.wearable.service.CalendarSnapshotService;
import io.mrkuhne.mezo.feature.wearable.service.DailyMetricService;
import io.mrkuhne.mezo.feature.wearable.service.WearableWorkoutService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

@Transactional
class WearableServiceIT extends AbstractIntegrationTest {

    @Autowired private DailyMetricService metrics;
    @Autowired private WearableWorkoutService workouts;
    @Autowired private CalendarSnapshotService calendar;
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private JdbcTemplate jdbc;

    private static final LocalDate D1 = LocalDate.parse("2026-11-08");
    private static final LocalDate D2 = LocalDate.parse("2026-11-09");

    private static DailyMetricIn day(LocalDate d, int steps) {
        return new DailyMetricIn().date(d).steps(steps).restingHr(57).avgHr(72).minHr(48).maxHr(151).activeKcal(620);
    }

    private static WorkoutIn workout(String id, String start) {
        OffsetDateTime s = OffsetDateTime.parse(start);
        return new WorkoutIn().externalId(id).activityType("strength").startAt(s).endAt(s.plusMinutes(60))
            .kcal(480).avgHr(128).sourceName("Huawei Health");
    }

    private static CalendarEventIn event(String title, String start) {
        OffsetDateTime s = OffsetDateTime.parse(start);
        return new CalendarEventIn().title(title).startAt(s).endAt(s.plusMinutes(30)).allDay(false).calendarName("Munka");
    }

    private int count(String table, UUID user) {
        return jdbc.queryForObject("select count(*) from " + table + " where created_by = ?", Integer.class, user);
    }

    @Test
    void dailyMetricsUpsertByDay() {
        UUID user = databasePopulator.populateUser("a@test.local");
        assertThat(metrics.ingest(user, List.of(day(D1, 6000), day(D2, 3000))))
            .isEqualTo(new IngestResult(2, 0));
        assertThat(metrics.ingest(user, List.of(day(D1, 6100), day(D2, 8000))))
            .isEqualTo(new IngestResult(0, 2));
        assertThat(count("daily_metric", user)).isEqualTo(2);
        assertThat(jdbc.queryForObject("select steps from daily_metric where created_by = ? and date = ?",
            Integer.class, user, D2)).isEqualTo(8000);
    }

    @Test
    void workoutsUpsertByExternalId() {
        UUID user = databasePopulator.populateUser("a@test.local");
        workouts.ingest(user, List.of(workout("hk-1", "2026-11-08T17:00:00+01:00")));
        IngestResult r = workouts.ingest(user, List.of(
            workout("hk-1", "2026-11-08T17:00:00+01:00").kcal(500), workout("hk-2", "2026-11-09T07:30:00+01:00")));
        assertThat(r).isEqualTo(new IngestResult(1, 1));
        assertThat(count("wearable_workout", user)).isEqualTo(2);
        assertThat(jdbc.queryForObject("select date from wearable_workout where external_id = 'hk-1' and created_by = ?",
            LocalDate.class, user)).isEqualTo(D1);
    }

    @Test
    void calendarReplaceClearsTheDay() {
        UUID user = databasePopulator.populateUser("a@test.local");
        calendar.replace(user, List.of(
            new CalendarDayIn().date(D2).events(List.of(event("Egyeztetés", "2026-11-09T09:00:00+01:00"),
                event("Workshop", "2026-11-09T10:30:00+01:00"), event("Hívás", "2026-11-09T17:30:00+01:00"))),
            new CalendarDayIn().date(D1).events(List.of(event("Tegnapi", "2026-11-08T12:00:00+01:00")))));
        calendar.replace(user, List.of(new CalendarDayIn().date(D2).events(List.of(event("Csak ez", "2026-11-09T12:00:00+01:00")))));
        assertThat(jdbc.queryForObject("select count(*) from calendar_event where created_by = ? and date = ?",
            Integer.class, user, D2)).isEqualTo(1);
        calendar.replace(user, List.of(new CalendarDayIn().date(D2).events(List.of())));
        assertThat(jdbc.queryForObject("select count(*) from calendar_event where created_by = ? and date = ?",
            Integer.class, user, D2)).isZero();
        assertThat(jdbc.queryForObject("select count(*) from calendar_event where created_by = ? and date = ?",
            Integer.class, user, D1)).isEqualTo(1);
    }

    @Test
    void capsAreEnforced() {
        UUID user = databasePopulator.populateUser("a@test.local");
        List<DailyMetricIn> tooManyDays = IntStream.range(0, 121).mapToObj(i -> day(D2.minusDays(i), 1)).toList();
        assertThatThrownBy(() -> metrics.ingest(user, tooManyDays)).isInstanceOf(SystemRuntimeErrorException.class)
            .hasMessageContaining("WEARABLE_BATCH_TOO_LARGE");
        List<WorkoutIn> tooManyWorkouts = IntStream.range(0, 301)
            .mapToObj(i -> workout("hk-" + i, "2026-11-09T07:30:00+01:00")).toList();
        assertThatThrownBy(() -> workouts.ingest(user, tooManyWorkouts)).isInstanceOf(SystemRuntimeErrorException.class);
        List<CalendarDayIn> tooManyCalendarDays = IntStream.range(0, 4)
            .mapToObj(i -> new CalendarDayIn().date(D2.plusDays(i)).events(List.of())).toList();
        assertThatThrownBy(() -> calendar.replace(user, tooManyCalendarDays)).isInstanceOf(SystemRuntimeErrorException.class);
    }
}
