package io.mrkuhne.mezo.feature.capacity.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import org.junit.jupiter.api.Test;

/** Boop B7 K4 (mezo-r36n9.17, Task 23): the Sunday preview targets next week judged in the owner zone. */
class SundayPreviewJobTest {

    static final ZoneId BUD = ZoneId.of("Europe/Budapest");

    @Test
    void sundayEveningInHisZoneTargetsTomorrow() {
        // Sunday 2026-11-29 18:00 Budapest = 17:00 UTC
        assertThat(SundayPreviewJob.targetMonday(Instant.parse("2026-11-29T17:00:00Z"), BUD))
            .isEqualTo(LocalDate.of(2026, 11, 30));
        // Sunday 23:30 Budapest = 22:30 UTC: still this Sunday
        assertThat(SundayPreviewJob.targetMonday(Instant.parse("2026-11-29T22:30:00Z"), BUD))
            .isEqualTo(LocalDate.of(2026, 11, 30));
    }

    @Test
    void utcSundayThatIsAlreadyMondayInHisZoneTargetsTheWeekAfter() {
        // Sunday 23:30 UTC = Monday 00:30 Budapest
        assertThat(SundayPreviewJob.targetMonday(Instant.parse("2026-11-29T23:30:00Z"), BUD))
            .isEqualTo(LocalDate.of(2026, 12, 7));
        // the same instant judged in UTC would still say tomorrow — the zone is what decides
        assertThat(SundayPreviewJob.targetMonday(Instant.parse("2026-11-29T23:30:00Z"), ZoneId.of("UTC")))
            .isEqualTo(LocalDate.of(2026, 11, 30));
    }
}
