package io.mrkuhne.mezo.feature.capacity.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.capacity.port.CapacityCalendarPort.CalendarEventView;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class RuleEventScoreTest {

    private static final Instant NINE = Instant.parse("2026-11-23T09:00:00Z");

    private static CalendarEventView event(String title, String calendar, int minutes, boolean allDay, int attendees,
                                           String availability) {
        return new CalendarEventView(UUID.randomUUID(), "ek|x", LocalDate.of(2026, 11, 23), title, NINE,
            NINE.plusSeconds(minutes * 60L), allDay, calendar, attendees, List.of(), null, null, null, availability,
            null);
    }

    @Test
    void sixtyMinuteMeetingWithFourAttendees() {
        EventScore s = RuleEventScore.score(event("Heti sync", "Munka", 60, false, 4, "busy"));
        assertThat(s.mental()).isEqualTo(2);
        assertThat(s.social()).isEqualTo(2);
        assertThat(s.physical()).isZero();
        assertThat(s.source()).isEqualTo("rule");
    }

    @Test
    void sportEventIsPhysical() {
        assertThat(RuleEventScore.score(event("Edzés", "Munka", 60, false, 0, "busy")).physical()).isEqualTo(2);
        assertThat(RuleEventScore.score(event("Délután", "Sport", 60, false, 0, "busy")).physical()).isEqualTo(2);
    }

    @Test
    void allDayFreeEventIsZero() {
        EventScore s = RuleEventScore.score(event("Névnap", "Család", 1440, true, 0, "free"));
        assertThat(s.mental() + s.social() + s.physical()).isZero();
    }
}
