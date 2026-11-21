package io.mrkuhne.mezo.feature.capacity.service;

import static java.util.concurrent.TimeUnit.SECONDS;
import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;

import io.mrkuhne.mezo.api.dto.CalendarDayIn;
import io.mrkuhne.mezo.api.dto.CalendarEventIn;
import io.mrkuhne.mezo.feature.companion.llm.FakeCompanionLlm;
import io.mrkuhne.mezo.feature.wearable.config.WearableProperties;
import io.mrkuhne.mezo.feature.wearable.entity.CalendarEventEntity;
import io.mrkuhne.mezo.feature.wearable.service.CalendarSnapshotService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.CalendarEventPopulator;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;

/**
 * Boop B7 K1 final fix (mezo-r36n9.17): the model is never called on a request thread. A calendar PUT scores
 * today..today+8 in the background; the day read uses stored-or-rule scores and at most triggers that background
 * run without waiting for it; concurrent triggers make one model call.
 *
 * <p>Fixtures sit on TOMORROW in the owner zone: still inside the today..today+8 window if the run crosses midnight.
 */
@ActiveProfiles("companion-fake")
class EventScoringBackgroundIT extends AbstractIntegrationTest {

    @Autowired private CapacityDayService days;
    @Autowired private EventScoringService scoring;
    @Autowired private EventScoringRunner runner;
    @Autowired private CalendarSnapshotService calendarSnapshot;
    @Autowired private FakeCompanionLlm fakeLlm;
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private CalendarEventPopulator calendarPopulator;
    @Autowired private WearableProperties wearable;
    @Autowired private JdbcTemplate jdbc;

    private LocalDate tomorrow() {
        return LocalDate.now(ZoneId.of(wearable.zone())).plusDays(1);
    }

    private CalendarEventEntity event(UUID owner, LocalDate date, String title) {
        ZoneId zone = ZoneId.of(wearable.zone());
        return calendarPopulator.createEvent(owner, date, title, date.atTime(LocalTime.of(9, 0)).atZone(zone).toInstant(),
            date.atTime(LocalTime.of(10, 0)).atZone(zone).toInstant());
    }

    private String storedSource(UUID eventId) {
        List<String> rows = jdbc.queryForList("select source from calendar_event_score where event_id = ?", String.class,
            eventId);
        return rows.isEmpty() ? null : rows.get(0);
    }

    @Test
    void dayReadNeverWaitsForTheModelAndTheBackgroundRunUpgradesTheScore() {
        UUID owner = databasePopulator.populateUser("cap-bg1@test.local");
        LocalDate d = tomorrow();
        CalendarEventEntity ev = event(owner, d, "Tervezés " + FakeCompanionLlm.CAPACITY_SLOW);
        int before = fakeLlm.capacityScoreCallCount();

        long t0 = System.nanoTime();
        CapacityDay first = days.day(owner, d);
        long tookMs = (System.nanoTime() - t0) / 1_000_000;

        assertThat(tookMs).isLessThan(FakeCompanionLlm.CAPACITY_SLOW_MS);
        assertThat(first.demand().items()).extracting(DemandCalculator.DemandItem::kind).containsExactly("focus");
        assertThat(scoring.storedOrRule(owner, d, d).get(ev.getId()).source()).isEqualTo("rule");

        await().atMost(20, SECONDS).untilAsserted(() -> assertThat(storedSource(ev.getId())).isEqualTo("llm"));
        assertThat(fakeLlm.capacityScoreCallCount()).isEqualTo(before + 1);

        CapacityDay second = days.day(owner, d);
        assertThat(second.demand().items()).extracting(DemandCalculator.DemandItem::kind).containsExactly("meeting");
        assertThat(scoring.storedOrRule(owner, d, d).get(ev.getId()).source()).isEqualTo("llm");
        assertThat(fakeLlm.capacityScoreCallCount()).isEqualTo(before + 1);
    }

    @Test
    void calendarPutScoresTheComingDaysInTheBackground() {
        UUID owner = databasePopulator.populateUser("cap-bg2@test.local");
        LocalDate d = tomorrow();
        var start = d.atTime(LocalTime.of(14, 0)).atZone(ZoneId.of(wearable.zone())).toOffsetDateTime();
        CalendarEventIn in = new CalendarEventIn().externalId("ek-bg2").title("Egyeztetés").startAt(start)
            .endAt(start.plusHours(1)).allDay(false).attendeeCount(3);
        CalendarEventIn allDay = new CalendarEventIn().externalId("ek-bg2-allday").title("Konferencia")
            .startAt(d.atStartOfDay(ZoneId.of(wearable.zone())).toOffsetDateTime())
            .endAt(d.plusDays(1).atStartOfDay(ZoneId.of(wearable.zone())).toOffsetDateTime()).allDay(true)
            .availability(CalendarEventIn.AvailabilityEnum.BUSY);
        int before = fakeLlm.capacityScoreCallCount();

        calendarSnapshot.replace(owner, List.of(new CalendarDayIn().date(d).events(List.of(in, allDay))));

        await().atMost(20, SECONDS).untilAsserted(() -> assertThat(jdbc.queryForObject(
            "select s.source from calendar_event_score s join calendar_event e on e.id = s.event_id "
                + "where e.created_by = ? and e.external_id = 'ek-bg2'", String.class, owner)).isEqualTo("llm"));
        assertThat(fakeLlm.capacityScoreCallCount()).isEqualTo(before + 1);
        // an all-day event never goes to the model: its stored score is the rule's
        await().atMost(5, SECONDS).untilAsserted(() -> assertThat(jdbc.queryForObject(
            "select s.source from calendar_event_score s join calendar_event e on e.id = s.event_id "
                + "where e.created_by = ? and e.external_id = 'ek-bg2-allday'", String.class, owner)).isEqualTo("rule"));
    }

    @Test
    void concurrentTriggersMakeOneModelCall() throws Exception {
        UUID owner = databasePopulator.populateUser("cap-bg3@test.local");
        CalendarEventEntity ev = event(owner, tomorrow(), "Heti sync " + FakeCompanionLlm.CAPACITY_SLOW);
        int before = fakeLlm.capacityScoreCallCount();
        int n = 4;
        CyclicBarrier go = new CyclicBarrier(n);
        ExecutorService pool = Executors.newFixedThreadPool(n);
        try {
            List<Future<?>> all = new ArrayList<>();
            for (int i = 0; i < n; i++) {
                all.add(pool.submit(() -> {
                    go.await();
                    runner.scoreAhead(owner);
                    return null;
                }));
            }
            for (Future<?> f : all) {
                f.get(30, SECONDS);
            }
        } finally {
            pool.shutdownNow();
        }

        assertThat(storedSource(ev.getId())).isEqualTo("llm");
        assertThat(fakeLlm.capacityScoreCallCount()).isEqualTo(before + 1);
    }
}
