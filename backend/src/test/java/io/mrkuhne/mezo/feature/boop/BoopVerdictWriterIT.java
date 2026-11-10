package io.mrkuhne.mezo.feature.boop;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.boop.service.BoopDay;
import io.mrkuhne.mezo.feature.boop.service.BoopDay.Calendar;
import io.mrkuhne.mezo.feature.boop.service.BoopDay.CalendarItem;
import io.mrkuhne.mezo.feature.boop.service.BoopDay.Intention;
import io.mrkuhne.mezo.feature.boop.service.BoopDay.Meal;
import io.mrkuhne.mezo.feature.boop.service.BoopDay.Session;
import io.mrkuhne.mezo.feature.boop.service.BoopDay.Sleep;
import io.mrkuhne.mezo.feature.boop.service.BoopDay.WorkoutLoad;
import io.mrkuhne.mezo.feature.boop.service.BoopScores.Scores;
import io.mrkuhne.mezo.feature.boop.service.BoopVerdictWriter;
import io.mrkuhne.mezo.feature.boop.service.BoopVerdictWriter.Verdict;
import io.mrkuhne.mezo.feature.boop.service.BoopVerdictWriter.Verdicts;
import io.mrkuhne.mezo.feature.boop.service.RuleVerdicts;
import io.mrkuhne.mezo.feature.companion.llm.FakeCompanionLlm;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.Collections;
import java.util.List;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

/** Boop S3 Task 5 (mezo-r36n9.7): the words of the brief — LLM verdicts with a rule fallback. */
@ActiveProfiles("companion-fake")
class BoopVerdictWriterIT extends AbstractIntegrationTest {

    private static final LocalDate DAY = LocalDate.of(2026, 11, 10);
    private static final LocalTime NOW = LocalTime.of(8, 30);
    private static final Scores GOOD = new Scores(78, 82, 30, 90, 74, 56, "good");
    private static final Scores LEARNING = new Scores(null, null, 0, null, null, null, "learning");

    @Autowired private BoopVerdictWriter writer;

    private final RuleVerdicts rules = new RuleVerdicts(9000);

    @Test
    void validLlmJsonIsUsed() {
        Verdicts v = writer.write(fullDay("Nyugodt nap", null, List.of()), GOOD, NOW);

        assertThat(v.forma().headline()).isEqualTo("Jó formában vagy");
        assertThat(v.alvas().headline()).isEqualTo("Jól aludtál");
        assertThat(v.brief()).isNotEmpty();
        assertThat(v.brief().getFirst().text()).isEqualTo("Hét és fél órát aludtál, ez jó alap a naphoz.");
        assertThat(v.brief().getFirst().link()).isEqualTo("sleep");
        assertThat(v.tonightTip()).isEqualTo("Ma este fél tizenegy körül bújj ágyba.");
        assertThat(v.nextMealTip()).isEqualTo("Ebédnél egyél egy nagyobb adag fehérjét.");
        assertComplete(v);
    }

    @Test
    void junkAnswerFallsBackToRuleVerdicts() {
        BoopDay d = fullDay("Nyugodt nap [fake-boop-junk]", null, List.of());

        Verdicts v = writer.write(d, GOOD, NOW);

        assertThat(v).isEqualTo(rules.write(d, GOOD, NOW));
        assertComplete(v);
    }

    @Test
    void failingLlmCallFallsBackToRuleVerdicts() {
        BoopDay d = fullDay("Nyugodt nap " + FakeCompanionLlm.FAIL_COMPLETE, null, List.of());

        Verdicts v = writer.write(d, GOOD, NOW);

        assertThat(v).isEqualTo(rules.write(d, GOOD, NOW));
        assertComplete(v);
    }

    @Test
    void missingFieldsComeFromRules() {
        BoopDay d = fullDay("Nyugodt nap [fake-boop-partial]", null, List.of());

        Verdicts v = writer.write(d, GOOD, NOW);
        Verdicts r = rules.write(d, GOOD, NOW);

        assertThat(v.alvas().headline()).isEqualTo("Részleges alvás-ítélet");
        assertThat(v.forma()).isEqualTo(r.forma());
        assertThat(v.mozgas()).isEqualTo(r.mozgas());
        assertThat(v.fuel()).isEqualTo(r.fuel());
        assertThat(v.pulzus()).isEqualTo(r.pulzus());
        assertThat(v.brief()).isEqualTo(r.brief());
        assertThat(v.tonightTip()).isEqualTo(r.tonightTip());
        assertComplete(v);
    }

    @Test
    void learningStateWithNoDataSaysSoPlainly() {
        BoopDay empty = emptyDay("[fake-boop-junk]");

        Verdicts v = writer.write(empty, LEARNING, LocalTime.of(7, 0));

        assertThat(v.forma().headline()).isEqualTo("Még tanulom a ritmusod");
        assertComplete(v);
        assertThat(allText(v)).noneMatch(t -> t.contains("null"));
        assertThat(v.alvas().headline()).isEqualTo("Nincs adat az éjszakáról");
        assertThat(v.conflict()).isNull();
    }

    @Test
    void learningStateForcesTheFormaHeadlineEvenWhenTheLlmAnswers() {
        Verdicts v = writer.write(emptyDay(null), LEARNING, LocalTime.of(7, 0));

        assertThat(v.forma().headline()).isEqualTo("Még tanulom a ritmusod");
        assertComplete(v);
    }

    @Test
    void noConflictWithoutSessionTimeMeetingsOrWhenTheGapIsLongEnough() {
        CalendarItem meeting = new CalendarItem("Heti egyeztetés", LocalTime.of(16, 0), LocalTime.of(17, 0), false);
        // 60 min gap → fine
        assertThat(writer.write(fullDay("x", LocalTime.of(18, 0), List.of(meeting)), GOOD, NOW).conflict()).isNull();
        // no session time
        assertThat(writer.write(fullDay("x", null, List.of(meeting)), GOOD, NOW).conflict()).isNull();
        // no meetings
        assertThat(writer.write(fullDay("x", LocalTime.of(18, 0), List.of()), GOOD, NOW).conflict()).isNull();
        // a meeting after the session start and an all-day event do not count
        CalendarItem later = new CalendarItem("Vacsora", LocalTime.of(19, 30), LocalTime.of(21, 0), false);
        CalendarItem allDay = new CalendarItem("Szabadság", null, null, true);
        assertThat(writer.write(fullDay("x", LocalTime.of(18, 0), List.of(later, allDay)), GOOD, NOW).conflict())
            .isNull();
    }

    @Test
    void sessionRightAfterTheLastMeetingIsAConflict() {
        CalendarItem early = new CalendarItem("Reggeli stand-up", LocalTime.of(9, 0), LocalTime.of(9, 15), false);
        CalendarItem last = new CalendarItem("Ügyféltalálkozó", LocalTime.of(16, 30), LocalTime.of(17, 30), false);

        Verdicts v = writer.write(fullDay("x", LocalTime.of(18, 0), List.of(early, last)), GOOD, NOW);

        assertThat(v.conflict()).isNotNull();
        assertThat(v.conflict().suggestedTime()).isEqualTo("18:30");
        assertThat(v.conflict().text()).contains("18:00").contains("17:30").contains("18:30");

        // 17:40 + 60 = 18:40 → rounded up to the next half hour
        CalendarItem late = new CalendarItem("Tervezés", LocalTime.of(17, 0), LocalTime.of(17, 40), false);
        assertThat(writer.write(fullDay("x", LocalTime.of(18, 0), List.of(late)), GOOD, NOW).conflict().suggestedTime())
            .isEqualTo("19:00");

        // a meeting still running at the session start is a conflict too
        CalendarItem overlap = new CalendarItem("Hosszú meeting", LocalTime.of(17, 30), LocalTime.of(18, 15), false);
        assertThat(writer.write(fullDay("x", LocalTime.of(18, 0), List.of(overlap)), GOOD, NOW).conflict().suggestedTime())
            .isEqualTo("19:30");
    }

    @Test
    void ruleVerdictsAreCompleteForEveryState() {
        BoopDay full = fullDay("x", LocalTime.of(18, 0), List.of());
        BoopDay empty = emptyDay(null);
        for (String state : List.of("good", "okay", "tired")) {
            int forma = switch (state) { case "good" -> 80; case "okay" -> 60; default -> 40; };
            assertComplete(rules.write(full, new Scores(forma, 40, 120, 30, 30, 70, state), LocalTime.of(14, 0)));
            assertComplete(rules.write(empty, new Scores(forma, null, 0, null, null, null, state), LocalTime.of(22, 0)));
        }
        assertComplete(rules.write(empty, LEARNING, LocalTime.of(5, 0)));
        assertComplete(rules.write(full, LEARNING, LocalTime.of(12, 0)));
    }

    // ---------------------------------------------------------------------------------------------

    private static void assertComplete(Verdicts v) {
        for (Verdict m : List.of(v.forma(), v.alvas(), v.mozgas(), v.fuel(), v.pulzus())) {
            assertThat(m).isNotNull();
            assertThat(m.headline()).isNotBlank();
            assertThat(m.sentence()).isNotBlank();
        }
        assertThat(v.brief()).isNotEmpty();
        assertThat(v.brief()).allSatisfy(l -> {
            assertThat(l.text()).isNotBlank();
            assertThat(l.link()).isIn(null, "sleep", "heart", "day");
        });
        assertThat(v.tonightTip()).isNotBlank();
    }

    private static List<String> allText(Verdicts v) {
        return Stream.of(
                Stream.of(v.forma(), v.alvas(), v.mozgas(), v.fuel(), v.pulzus())
                    .flatMap(m -> Stream.of(m.headline(), m.sentence())),
                v.brief().stream().map(BoopVerdictWriter.BriefLine::text),
                Stream.of(v.tonightTip(), v.nextMealTip()))
            .flatMap(s -> s)
            .filter(s -> s != null)
            .toList();
    }

    private static BoopDay fullDay(String creed, LocalTime sessionTime, List<CalendarItem> events) {
        Sleep sleep = new Sleep(null, "23:10", "06:40", 450, 80, 100, 230, 40, 8, List.of());
        Session session = new Session("Felsőtest A", sessionTime, sessionTime, 60, List.of());
        List<Meal> meals = List.of(
            new Meal(LocalTime.of(7, 30), "Zabkása", "breakfast", 450, 25, true),
            new Meal(LocalTime.of(12, 30), "Csirke rizzsel", "lunch", 700, 45, false));
        return new BoopDay(DAY, sleep, 480, LocalTime.of(22, 30), 40,
            Collections.nCopies(7, 80), Collections.nCopies(7, 57), 58.0, 75.0, 56, null, 2700, 120, session,
            new WorkoutLoad(45, 380), meals, 450, 2400, 25, 160, 60, 15,
            List.of(), new Intention(creed, List.of("türelem")), List.of(),
            new Calendar(events.size(), Collections.nCopies(BoopDay.BUSY_SLOTS, false), events), null, null);
    }

    private static BoopDay emptyDay(String creed) {
        return new BoopDay(DAY, null, 480, LocalTime.of(23, 0), 3,
            Collections.nCopies(7, null), Collections.nCopies(7, null), null, null, null, null, null, null, null,
            new WorkoutLoad(0, 0), List.of(), 0, 0, 0, 0, 0, 0,
            List.of(), new Intention(creed, List.of()), List.of(),
            new Calendar(0, Collections.nCopies(BoopDay.BUSY_SLOTS, false), List.of()), null, null);
    }
}
