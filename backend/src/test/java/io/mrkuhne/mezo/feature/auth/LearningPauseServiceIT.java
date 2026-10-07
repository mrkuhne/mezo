package io.mrkuhne.mezo.feature.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.feature.auth.entity.LearningPauseEntity;
import io.mrkuhne.mezo.feature.auth.repository.LearningPauseRepository;
import io.mrkuhne.mezo.feature.auth.service.LearningPauseService;
import io.mrkuhne.mezo.feature.auth.service.LearningPauseSql;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * "Most ne tanulj" store + rules (mezo-rrjxe). Not {@code @Transactional}: the service commits in
 * its own transactions and the unique index must really fire.
 */
class LearningPauseServiceIT extends AbstractIntegrationTest {

    @Autowired private LearningPauseService service;
    @Autowired private LearningPauseRepository pauses;
    @Autowired private UserPopulator userPopulator;
    @Autowired private JdbcTemplate jdbc;

    private LearningPauseEntity pause(UUID user, Instant start, Instant plannedEnd, Instant ended) {
        LearningPauseEntity p = new LearningPauseEntity();
        p.setCreatedBy(user);
        p.setStartedAt(start);
        p.setPlannedEndAt(plannedEnd);
        p.setEndedAt(ended);
        p.setDurationChoice(plannedEnd == null ? "open" : "tonight");
        p.setEndReason(ended == null ? null : "user");
        return pauses.saveAndFlush(p);
    }

    @Test
    void oneOpenIntervalPerUser_isEnforcedByTheDatabase() {
        UUID user = userPopulator.createUser().getId();
        Instant t = Instant.parse("2026-10-08T10:00:00Z");
        pause(user, t, null, null);
        assertThat(pauses.findOpen(user)).isPresent();
        assertThatThrownBy(() -> pause(user, t.plus(1, ChronoUnit.HOURS), null, null))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void overlapping_usesTheEffectiveEnd_plannedOrEndedOrOpen() {
        UUID user = userPopulator.createUser().getId();
        Instant t = Instant.parse("2026-10-01T10:00:00Z");
        pause(user, t, t.plus(2, ChronoUnit.HOURS), t.plus(1, ChronoUnit.HOURS));   // ended early by the user
        Instant d2 = t.plus(1, ChronoUnit.DAYS);
        pause(user, d2, d2.plus(3, ChronoUnit.HOURS), null);                          // timed, never swept
        assertThat(pauses.overlapping(user, t.plus(90, ChronoUnit.MINUTES), t.plus(100, ChronoUnit.MINUTES))).isEmpty();
        assertThat(pauses.overlapping(user, t.plus(30, ChronoUnit.MINUTES), t.plus(40, ChronoUnit.MINUTES))).hasSize(1);
        assertThat(pauses.overlapping(user, d2.plus(4, ChronoUnit.HOURS), d2.plus(1, ChronoUnit.DAYS))).isEmpty();
        assertThat(pauses.expiredOpen(d2.plus(1, ChronoUnit.DAYS))).hasSize(1);
        assertThat(service.isPausedAt(user, d2.plus(1, ChronoUnit.HOURS))).isTrue();
        assertThat(service.isPausedAt(user, d2.plus(3, ChronoUnit.HOURS))).isFalse();   // end is exclusive
    }

    @Test
    void start_thenEnd_leavesOneClosedInterval_andBothAreIdempotent() {
        UUID user = userPopulator.createUser().getId();
        assertThat(service.current(user).paused()).isFalse();

        LearningPauseService.Status on = service.start(user, "open");
        assertThat(on.paused()).isTrue();
        assertThat(on.until()).isNull();
        assertThat(service.start(user, "tonight").choice()).isEqualTo("open");   // already paused: unchanged
        assertThat(service.isPausedAt(user, Instant.now())).isTrue();

        assertThat(service.end(user).paused()).isFalse();
        assertThat(service.end(user).paused()).isFalse();
        assertThat(pauses.findAll()).singleElement()
                .satisfies(p -> assertThat(p.getEndReason()).isEqualTo(LearningPauseEntity.END_USER));
        assertThat(service.isPausedAt(user, Instant.now())).isFalse();
    }

    @Test
    void aTimedPause_readsAsEnded_pastItsPlannedEnd_withoutAnySweep() {
        UUID user = userPopulator.createUser().getId();
        Instant plannedEnd = Instant.now().minus(1, ChronoUnit.HOURS);
        pause(user, Instant.now().minus(3, ChronoUnit.HOURS), plannedEnd, null);

        assertThat(service.current(user).paused()).isFalse();
        assertThat(service.isPausedAt(user, Instant.now())).isFalse();
        assertThat(service.isPausedAt(user, Instant.now().minus(2, ChronoUnit.HOURS))).isTrue();

        // starting again closes the stale row first, at its PLANNED end — never extended
        assertThat(service.start(user, "open").paused()).isTrue();
        assertThat(pauses.findAll()).hasSize(2).anySatisfy(p -> {
            assertThat(p.getEndReason()).isEqualTo(LearningPauseEntity.END_EXPIRED);
            assertThat(p.getEndedAt().truncatedTo(ChronoUnit.MILLIS)).isEqualTo(plannedEnd.truncatedTo(ChronoUnit.MILLIS));
        });
    }

    @Test
    void pausedDays_coversEveryLocalDayTheIntervalTouches() {
        UUID user = userPopulator.createUser().getId();
        // 20:00 Budapest on the 1st → 00:30 Budapest on the 3rd
        pause(user, Instant.parse("2026-10-01T18:00:00Z"), null, Instant.parse("2026-10-02T22:30:00Z"));

        assertThat(service.pausedDays(user, LocalDate.of(2026, 9, 28), LocalDate.of(2026, 10, 5)))
                .containsExactlyInAnyOrder(LocalDate.of(2026, 10, 1), LocalDate.of(2026, 10, 2), LocalDate.of(2026, 10, 3));
        assertThat(service.isPausedDay(user, LocalDate.of(2026, 10, 3))).isTrue();
        assertThat(service.isPausedDay(user, LocalDate.of(2026, 10, 4))).isFalse();
    }

    @Test
    void anIntervalEndingExactlyAtMidnight_doesNotTouchTheNextDay() {
        UUID user = userPopulator.createUser().getId();
        pause(user, Instant.parse("2026-10-01T18:00:00Z"), Instant.parse("2026-10-01T22:00:00Z"), null);
        assertThat(service.pausedDays(user, LocalDate.of(2026, 10, 1), LocalDate.of(2026, 10, 2)))
                .containsExactly(LocalDate.of(2026, 10, 1));
    }

    @Test
    void theSqlFragment_agreesWithTheService_andNeverCrossesUsers() {
        UUID user = userPopulator.createUser().getId();
        UUID other = userPopulator.createUser().getId();
        Instant t = Instant.parse("2026-10-01T10:00:00Z");
        pause(user, t, null, t.plus(2, ChronoUnit.HOURS));
        String sql = "select count(*) from (select ?::uuid as created_by, ?::timestamptz as created_at) r where"
                + LearningPauseSql.notPaused("r");
        assertThat(count(sql, user, t.plus(1, ChronoUnit.HOURS))).isZero();      // inside
        assertThat(count(sql, user, t.plus(2, ChronoUnit.HOURS))).isEqualTo(1);  // end exclusive
        assertThat(count(sql, user, t.minusSeconds(1))).isEqualTo(1);            // before
        assertThat(count(sql, other, t.plus(1, ChronoUnit.HOURS))).isEqualTo(1); // someone else's pause
    }

    private int count(String sql, UUID user, Instant at) {
        return jdbc.queryForObject(sql, Integer.class, user.toString(), java.sql.Timestamp.from(at));
    }
}
