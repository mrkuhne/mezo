package io.mrkuhne.mezo.feature.boop.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.boop.service.BoopDay.CalendarItem;
import io.mrkuhne.mezo.feature.boop.service.BoopScores.Scores;
import java.time.LocalTime;
import java.util.List;
import org.junit.jupiter.api.Test;

/** Final review M3 + I3 (mezo-r36n9.7): what the brief's LLM call is told. */
class BoopPromptsTest {

    private static final Scores SCORES = new Scores(70, 70, 40, 60, 70, 56, "okay");
    private final BoopPrompts prompts = new BoopPrompts(9000, 14);

    @Test
    void calendarEventTitlesNeverReachTheModel() {
        List<CalendarItem> events = List.of(
            new CalendarItem("Fogorvos dr. Kovácsnál", LocalTime.of(9, 0), LocalTime.of(9, 45), false),
            new CalendarItem("Bérszámfejtés Annával", LocalTime.of(14, 0), LocalTime.of(15, 0), false),
            new CalendarItem("Nagymama születésnapja", null, null, true));
        BoopDay d = BoopBriefFixtures.day(BoopBriefFixtures.night("23:00", "06:30"), 4000, events);

        String prompt = prompts.context(d, SCORES, LocalTime.of(8, 0), null);

        assertThat(prompt).doesNotContain("Fogorvos", "Kovács", "Bérszámfejtés", "Annával", "Nagymama");
        assertThat(prompt).contains("09:00–09:45").contains("14:00–15:00");
    }

    @Test
    void aNightWithoutTimesIsNotWrittenAsNull() {
        BoopDay d = BoopBriefFixtures.day(BoopBriefFixtures.night(null, null), 4000, List.of());

        String prompt = prompts.context(d, SCORES, LocalTime.of(8, 0), null);

        assertThat(prompt).doesNotContain("null");
    }

    @Test
    void promptContainsTodaysFoci() {
        BoopDay base = BoopBriefFixtures.day(BoopBriefFixtures.night("23:00", "06:30"), 4000, List.of());
        BoopDay d = new BoopDay(base.date(), base.sleep(), base.sleepTargetMin(), base.bedtimeTarget(),
            base.nightsKnown(), base.deepSleepWeek(), base.restingHrWeek(), base.baselineRestingHr(),
            base.baselineDeepMin(), base.restingHr(), base.hrToday(), base.steps(), base.activeKcal(),
            base.session(), base.yesterdayLoad(), base.meals(), base.kcalSoFar(), base.kcalTarget(),
            base.proteinG(), base.proteinTarget(), base.carbsG(), base.fatG(), base.checkins(),
            new BoopDay.Intention("Lassan", List.of("Séta ebéd után", "Víz")), base.observations(),
            base.calendar(), base.weight(), base.recovery());

        String prompt = prompts.context(d, SCORES, LocalTime.of(8, 0), null);

        assertThat(prompt).contains("[Mai fókusz] Séta ebéd után; Víz");
    }
}
