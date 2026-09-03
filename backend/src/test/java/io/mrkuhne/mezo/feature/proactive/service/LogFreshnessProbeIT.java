package io.mrkuhne.mezo.feature.proactive.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.SleepLogPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * The shared stale probe (mezo-hqfi.1) — extracted VERBATIM from
 * {@code WeeklyReviewService#isStale}, with the ISO week generalised to an arbitrary
 * [from, to] window. Workout logs stay unprobed for the reason the original documents:
 * {@code WorkoutSessionEntity.date} is nullable on template rows, so there is no clean
 * date-window read. Only {@code createdAt} is observable — {@code OwnedEntity} has no
 * {@code updatedAt} (bd mezo-hszs).
 */
class LogFreshnessProbeIT extends AbstractIntegrationTest {

    @Autowired private LogFreshnessProbe probe;
    @Autowired private SleepLogPopulator sleepLogPopulator;
    @Autowired private UserPopulator userPopulator;

    @Test
    void reportsTrueWhenALogLandsInsideTheWindowAfterTheTimestamp() {
        UUID user = userPopulator.createUser("probe-fresh@test.local").getId();
        LocalDate from = LocalDate.now().minusDays(13);
        LocalDate to = LocalDate.now();
        Instant before = Instant.now().minusSeconds(60);

        sleepLogPopulator.createSleepLog(user, from.plusDays(3), new BigDecimal("7.0"), 8);

        assertThat(probe.anyLoggedAfter(user, from, to, before)).isTrue();
    }

    @Test
    void reportsFalseWhenTheLogIsOlderThanTheTimestamp() {
        UUID user = userPopulator.createUser("probe-stale@test.local").getId();
        LocalDate from = LocalDate.now().minusDays(13);
        LocalDate to = LocalDate.now();

        sleepLogPopulator.createSleepLog(user, from.plusDays(3), new BigDecimal("7.0"), 8);

        assertThat(probe.anyLoggedAfter(user, from, to, Instant.now().plusSeconds(60))).isFalse();
    }

    @Test
    void reportsFalseWhenTheLogFallsOutsideTheWindow() {
        UUID user = userPopulator.createUser("probe-outside@test.local").getId();
        LocalDate from = LocalDate.now().minusDays(13);
        LocalDate to = LocalDate.now();

        sleepLogPopulator.createSleepLog(user, from.minusDays(5), new BigDecimal("7.0"), 8);

        assertThat(probe.anyLoggedAfter(user, from, to, Instant.now().minusSeconds(60))).isFalse();
    }

    @Test
    void isOwnershipScoped() {
        UUID mine = userPopulator.createUser("probe-mine@test.local").getId();
        UUID theirs = userPopulator.createUser("probe-theirs@test.local").getId();
        LocalDate from = LocalDate.now().minusDays(13);
        LocalDate to = LocalDate.now();

        sleepLogPopulator.createSleepLog(theirs, from.plusDays(1), new BigDecimal("7.0"), 8);

        assertThat(probe.anyLoggedAfter(mine, from, to, Instant.now().minusSeconds(60))).isFalse();
    }
}
