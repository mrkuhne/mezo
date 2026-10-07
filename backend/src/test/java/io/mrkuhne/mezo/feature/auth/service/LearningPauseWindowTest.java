package io.mrkuhne.mezo.feature.auth.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.time.LocalTime;
import java.time.ZoneId;
import org.junit.jupiter.api.Test;

/** "Most ne tanulj" (mezo-rrjxe): the three duration choices, as pure clock arithmetic. */
class LearningPauseWindowTest {

    private static final ZoneId ZONE = ZoneId.of("Europe/Budapest");
    private static final LocalTime MORNING = LocalTime.of(7, 0);

    @Test
    void tonight_endsAtTheNextLocalMidnight_evenWhenStartedLate() {
        // 2026-10-08 23:30 Budapest (UTC+2) → 2026-10-09 00:00 Budapest
        Instant now = Instant.parse("2026-10-08T21:30:00Z");
        assertThat(LearningPauseService.plannedEnd("tonight", now, ZONE, MORNING))
                .isEqualTo(Instant.parse("2026-10-08T22:00:00Z"));
    }

    @Test
    void tomorrowMorning_endsAtTomorrowsQuietHoursEnd() {
        Instant now = Instant.parse("2026-10-08T10:00:00Z");
        assertThat(LearningPauseService.plannedEnd("tomorrow_morning", now, ZONE, MORNING))
                .isEqualTo(Instant.parse("2026-10-09T05:00:00Z"));
    }

    @Test
    void tomorrowMorning_afterMidnightBeforeTheMorning_stillMeansTheNextCalendarDay() {
        // 01:00 on the 9th → the morning of the 10th: "holnap reggelig" never ends within hours.
        Instant now = Instant.parse("2026-10-08T23:00:00Z");
        assertThat(LearningPauseService.plannedEnd("tomorrow_morning", now, ZONE, MORNING))
                .isEqualTo(Instant.parse("2026-10-10T05:00:00Z"));
    }

    @Test
    void open_hasNoPlannedEnd_andAnUnknownChoiceIsRefused() {
        assertThat(LearningPauseService.plannedEnd("open", Instant.now(), ZONE, MORNING)).isNull();
        assertThatThrownBy(() -> LearningPauseService.plannedEnd("forever", Instant.now(), ZONE, MORNING))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
