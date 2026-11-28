package io.mrkuhne.mezo.feature.train.service.sport;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import org.junit.jupiter.api.Test;

/** Boop Sport S2 (mezo-r36n9.202): weeks are the owner's ISO weeks, cut in his zone, not in UTC. */
class SportWeekTest {

    private static final ZoneId BUDAPEST = ZoneId.of("Europe/Budapest");

    @Test
    void sundayLateEveningLocalIsStillThisWeek() {
        // Sunday 2026-11-29 23:30 in Budapest = 22:30 UTC
        LocalDate today = SportWeek.today(Instant.parse("2026-11-29T22:30:00Z"), BUDAPEST);
        SportWeek week = SportWeek.resolve(null, today);
        assertThat(week.start()).isEqualTo(LocalDate.of(2026, 11, 23));
        assertThat(week.end()).isEqualTo(LocalDate.of(2026, 11, 29));
    }

    @Test
    void mondayJustAfterMidnightLocalIsNextWeekEvenWhileUtcIsStillSunday() {
        // Monday 2026-11-30 00:30 in Budapest = Sunday 23:30 UTC
        LocalDate today = SportWeek.today(Instant.parse("2026-11-29T23:30:00Z"), BUDAPEST);
        assertThat(SportWeek.resolve(null, today).start()).isEqualTo(LocalDate.of(2026, 11, 30));
    }

    @Test
    void anyDateOfTheWeekSelectsThatWeek() {
        SportWeek w = SportWeek.resolve(LocalDate.of(2026, 11, 26), LocalDate.of(2026, 12, 20));
        assertThat(w).isEqualTo(new SportWeek(LocalDate.of(2026, 11, 23), LocalDate.of(2026, 11, 29)));
        assertThat(w.minusWeeks(1).start()).isEqualTo(LocalDate.of(2026, 11, 16));
        assertThat(w.contains(LocalDate.of(2026, 11, 29))).isTrue();
        assertThat(w.contains(LocalDate.of(2026, 11, 30))).isFalse();
    }
}
