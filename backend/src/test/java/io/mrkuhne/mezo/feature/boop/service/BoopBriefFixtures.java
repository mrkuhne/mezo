package io.mrkuhne.mezo.feature.boop.service;

import io.mrkuhne.mezo.feature.boop.service.BoopDay.Calendar;
import io.mrkuhne.mezo.feature.boop.service.BoopDay.CalendarItem;
import io.mrkuhne.mezo.feature.boop.service.BoopDay.Intention;
import io.mrkuhne.mezo.feature.boop.service.BoopDay.Sleep;
import io.mrkuhne.mezo.feature.boop.service.BoopDay.WorkoutLoad;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.Collections;
import java.util.List;

/** A configurable Boop day for the unit tests of the brief's words (final review fixes, mezo-r36n9.7). */
final class BoopBriefFixtures {

    static final LocalDate DAY = LocalDate.of(2026, 11, 10);

    private BoopBriefFixtures() {}

    static BoopDay day(Sleep sleep, Integer steps, List<CalendarItem> events) {
        return day(sleep, steps, events, List.of());
    }

    static BoopDay day(Sleep sleep, Integer steps, List<CalendarItem> events, List<BoopDay.Meal> meals) {
        return new BoopDay(DAY, sleep, 480, LocalTime.of(22, 30), 40,
            Collections.nCopies(7, 80), Collections.nCopies(7, 57), 58.0, 75.0, 56, null, steps,
            steps == null ? null : 120, null, new WorkoutLoad(0, 0), meals, 450, 2400, 25, 160, 60, 15,
            List.of(), new Intention(null, List.of()), List.of(),
            new Calendar(events.size(), Collections.nCopies(BoopDay.BUSY_SLOTS, false), events), null, null);
    }

    static Sleep night(String bedtime, String wakeup) {
        return new Sleep(null, bedtime, wakeup, 420, null, null, null, null, 7, List.of());
    }
}
