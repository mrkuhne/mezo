package io.mrkuhne.mezo.feature.dayclose;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.api.dto.CreateJournalEntryRequest;
import io.mrkuhne.mezo.api.dto.DayClosePlanGoal;
import io.mrkuhne.mezo.api.dto.DayCloseRequest;
import io.mrkuhne.mezo.api.dto.DayCloseResponse;
import io.mrkuhne.mezo.feature.biometrics.checkin.config.OwnerZoneProperties;
import io.mrkuhne.mezo.feature.biometrics.checkin.service.CheckInService;
import io.mrkuhne.mezo.feature.dayclose.service.DayCloseService;
import io.mrkuhne.mezo.feature.intention.service.IntentionService;
import io.mrkuhne.mezo.feature.journal.service.JournalService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

/** Boop B3 (mezo-r36n9.13, spec §7.4): the day-close record, its legacy dual-write and the web fallback. */
@Transactional
@Import(DayCloseServiceIT.OwnerClockConfig.class)
class DayCloseServiceIT extends AbstractIntegrationTest {

    /** A clock the tests can set to the owner's "just after midnight"; the system clock otherwise. */
    static final class MutableClock extends Clock {
        private volatile Clock delegate = Clock.systemUTC();

        void set(Instant instant) { delegate = Clock.fixed(instant, ZoneOffset.UTC); }
        void reset() { delegate = Clock.systemUTC(); }
        @Override public ZoneId getZone() { return delegate.getZone(); }
        @Override public Clock withZone(ZoneId zone) { return delegate.withZone(zone); }
        @Override public Instant instant() { return delegate.instant(); }
    }

    @TestConfiguration
    static class OwnerClockConfig {
        @Bean
        MutableClock dayCloseTestClock() {
            return new MutableClock();
        }
    }

    @Autowired private DayCloseService service;
    @Autowired private CheckInService checkInService;
    @Autowired private IntentionService intentionService;
    @Autowired private JournalService journalService;
    @Autowired private OwnerZoneProperties ownerZone;
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private MutableClock clock;

    private ZoneId zone;
    private LocalDate today;
    private UUID user;

    @BeforeEach
    void setUp() {
        zone = ownerZone.zoneId();
        today = LocalDate.now(zone);
        user = databasePopulator.populateUser("dayclose@test.local");
    }

    @AfterEach
    void resetClock() {
        clock.reset();
    }

    private DayCloseRequest request(int rating, Integer energy, DayCloseRequest.GoalOutcomeEnum outcome) {
        return new DayCloseRequest()
            .capturedAt(OffsetDateTime.now(ZoneOffset.UTC).minusMinutes(1).truncatedTo(ChronoUnit.MICROS))
            .clientRef(UUID.randomUUID())
            .dayRating(rating)
            .eveningEnergy(energy)
            .goalText("Lezárni a negyedéves jelentést")
            .goalOutcome(outcome)
            .planGoals(List.of(new DayClosePlanGoal().id("protein").title("Fehérje").result("146 g").met(true)));
    }

    private Map<String, Object> row(String sql, Object... args) {
        return jdbc.queryForMap(sql, args);
    }

    private int count(String sql, Object... args) {
        return jdbc.queryForObject(sql, Integer.class, args);
    }

    @Test
    void closeWritesRecordAndLegacyStores() {
        DayCloseResponse saved = service.put(user, today, request(4, 7, DayCloseRequest.GoalOutcomeEnum.PARTIAL));

        assertThat(saved.getSource()).isEqualTo(DayCloseResponse.SourceEnum.BOOP);
        assertThat(saved.getDayRating()).isEqualTo(4);
        Map<String, Object> close = row("select * from day_close where created_by = ? and close_date = ?", user, today);
        assertThat(close.get("day_rating")).isEqualTo(4);
        assertThat(close.get("evening_energy")).isEqualTo(7);
        assertThat(close.get("goal_outcome")).isEqualTo("partial");
        assertThat(close.get("plan_goals").toString()).contains("146 g");
        assertThat(row("select reflection from daily_intention where created_by = ? and intention_date = ?", user, today)
            .get("reflection")).isEqualTo("partial");
        assertThat(row("select closed_at from ritual_day where created_by = ? and ritual_date = ?", user, today)
            .get("closed_at")).isNotNull();
        Map<String, Object> evening = row(
            "select energy, day_rating from check_in where created_by = ? and date = ? and slot_time = '20:00'", user, today);
        assertThat(evening.get("energy")).isEqualTo(7);
        assertThat(evening.get("day_rating")).isEqualTo(8);
    }

    @Test
    void acceptsCloseForYesterdayAfterMidnight() {
        // 00:20 in the owner zone — still "yesterday" (and earlier) in UTC
        Instant justAfterMidnight = today.atStartOfDay(zone).plusMinutes(20).toInstant();
        clock.set(justAfterMidnight);
        LocalDate yesterday = today.minusDays(1);
        DayCloseRequest req = request(3, 5, DayCloseRequest.GoalOutcomeEnum.DONE)
            .capturedAt(justAfterMidnight.atOffset(ZoneOffset.UTC));

        assertThat(service.put(user, yesterday, req).getDate()).isEqualTo(yesterday);
        // the owner's today is accepted even though UTC has not reached it yet; tomorrow is not
        assertThat(service.put(user, today, req.clientRef(UUID.randomUUID())).getDate()).isEqualTo(today);
        assertThatThrownBy(() -> service.put(user, today.plusDays(1), req))
            .isInstanceOfSatisfying(SystemRuntimeErrorException.class,
                e -> assertThat(e.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST));
    }

    @Test
    void putIsIdempotent() {
        DayCloseRequest req = request(4, 7, DayCloseRequest.GoalOutcomeEnum.DONE);
        service.put(user, today, req);
        service.put(user, today, req);
        assertThat(count("select count(*) from day_close where created_by = ? and close_date = ?", user, today))
            .isEqualTo(1);

        UUID journalRef = UUID.randomUUID();
        UUID entryId = journalService.create(user, new CreateJournalEntryRequest().text("Jó volt a séta.")
            .source("boop").occurredOn(today).clientRef(journalRef)).getId();
        DayCloseResponse relinked = service.put(user, today, req.journalClientRef(journalRef));

        assertThat(count("select count(*) from day_close where created_by = ? and close_date = ?", user, today))
            .isEqualTo(1);
        assertThat(row("select journal_entry_id from day_close where created_by = ? and close_date = ?", user, today)
            .get("journal_entry_id")).isEqualTo(entryId);
        assertThat(relinked.getJournalText()).isEqualTo("Jó volt a séta.");
    }

    @Test
    void unknownJournalClientRefIsIgnoredUntilItArrives() {
        UUID journalRef = UUID.randomUUID();
        DayCloseRequest req = request(4, 7, DayCloseRequest.GoalOutcomeEnum.DONE).journalClientRef(journalRef);

        DayCloseResponse first = service.put(user, today, req);

        assertThat(first.getJournalText()).isNull();
        assertThat(row("select journal_entry_id from day_close where created_by = ? and close_date = ?", user, today)
            .get("journal_entry_id")).isNull();

        UUID entryId = journalService.create(user, new CreateJournalEntryRequest().text("Későn jött a szöveg.")
            .source("boop").occurredOn(today).clientRef(journalRef)).getId();
        service.put(user, today, req);

        assertThat(row("select journal_entry_id from day_close where created_by = ? and close_date = ?", user, today)
            .get("journal_entry_id")).isEqualTo(entryId);
        // a later PUT without the ref keeps the link
        service.put(user, today, req.journalClientRef(null));
        assertThat(row("select journal_entry_id from day_close where created_by = ? and close_date = ?", user, today)
            .get("journal_entry_id")).isEqualTo(entryId);
    }

    private void closeOnTheWeb(LocalDate date) {
        jdbc.update("insert into ritual_day (created_by, ritual_date, closed_at, reflection_text) values (?, ?, ?, ?)",
            user, date, java.sql.Timestamp.from(date.atTime(21, 30).atZone(zone).toInstant()), "Fárasztó, de jó nap.");
        intentionService.reflect(user, date, "yes");
        checkInService.mergeEvening(user, date, 6, 8, date.atTime(21, 0).atZone(zone).toInstant());
    }

    @Test
    void webClosedDayFallsBackToLegacy() {
        LocalDate day = today.minusDays(1);
        closeOnTheWeb(day);

        DayCloseResponse web = service.get(user, day).orElseThrow();

        assertThat(web.getSource()).isEqualTo(DayCloseResponse.SourceEnum.WEB);
        assertThat(web.getDayRating()).isEqualTo(4);
        assertThat(web.getEveningEnergy()).isEqualTo(6);
        assertThat(web.getGoalOutcome()).isEqualTo(DayCloseResponse.GoalOutcomeEnum.DONE);
        assertThat(web.getJournalText()).isEqualTo("Fárasztó, de jó nap.");
        assertThat(web.getClosedAt().toInstant()).isEqualTo(day.atTime(21, 30).atZone(zone).toInstant());
        assertThat(web.getPlanGoals()).isEmpty();
        assertThat(service.get(user, today.minusDays(2))).isEmpty();
    }

    @Test
    void recloseKeepsWebReflectionText() {
        LocalDate day = today.minusDays(1);
        closeOnTheWeb(day);

        DayCloseResponse boop = service.put(user, day, request(2, 4, DayCloseRequest.GoalOutcomeEnum.NO));

        assertThat(boop.getSource()).isEqualTo(DayCloseResponse.SourceEnum.BOOP);
        assertThat(row("select reflection_text from ritual_day where created_by = ? and ritual_date = ?", user, day)
            .get("reflection_text")).isEqualTo("Fárasztó, de jó nap.");
        assertThat(row("select reflection from daily_intention where created_by = ? and intention_date = ?", user, day)
            .get("reflection")).isEqualTo("no");
    }

    @Test
    void ritualReflectionTextNotWritten() {
        UUID journalRef = UUID.randomUUID();
        journalService.create(user, new CreateJournalEntryRequest().text("Esti gondolatok.")
            .source("boop").occurredOn(today).clientRef(journalRef));

        service.put(user, today, request(5, 9, DayCloseRequest.GoalOutcomeEnum.DONE).journalClientRef(journalRef));

        assertThat(row("select reflection_text from ritual_day where created_by = ? and ritual_date = ?", user, today)
            .get("reflection_text")).isNull();
    }

    @Test
    void eveningEnergyLeftOutKeepsTheWebEveningEnergy() {
        LocalDate day = today.minusDays(1);
        closeOnTheWeb(day);

        service.put(user, day, request(5, null, null));

        Map<String, Object> evening = row(
            "select energy, day_rating from check_in where created_by = ? and date = ? and slot_time = '20:00'", user, day);
        assertThat(evening.get("energy")).isEqualTo(6);
        assertThat(evening.get("day_rating")).isEqualTo(10);
        // no outcome given — the web's reflection stays
        assertThat(row("select reflection from daily_intention where created_by = ? and intention_date = ?", user, day)
            .get("reflection")).isEqualTo("yes");
    }

    @Test
    void listReturnsRangeIncludingWebDays() {
        closeOnTheWeb(today.minusDays(2));
        service.put(user, today, request(4, 7, DayCloseRequest.GoalOutcomeEnum.DONE));
        service.put(user, today.minusDays(5), request(3, 5, null));

        List<DayCloseResponse> list = service.list(user, today.minusDays(3), today);

        assertThat(list).extracting(DayCloseResponse::getDate).containsExactly(today, today.minusDays(2));
        assertThat(list).extracting(DayCloseResponse::getSource)
            .containsExactly(DayCloseResponse.SourceEnum.BOOP, DayCloseResponse.SourceEnum.WEB);
    }
}
