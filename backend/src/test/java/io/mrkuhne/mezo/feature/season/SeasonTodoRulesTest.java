package io.mrkuhne.mezo.feature.season;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.season.entity.SeasonDraftJson;
import io.mrkuhne.mezo.feature.season.entity.SeasonNumbersJson;
import io.mrkuhne.mezo.feature.season.service.SeasonTodoRules;
import io.mrkuhne.mezo.feature.season.service.SeasonTodoRules.Todo;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;

/** Boop B6 Évad (mezo-r36n9.16): the deterministic "Ehhez ezt kell tenned" checklist from a preview's diff. */
class SeasonTodoRulesTest {

    private static final SeasonDraftJson.SportSlot TUE = new SeasonDraftJson.SportSlot(1, "19:00", 90, "volleyball");
    private static final SeasonDraftJson.SportSlot THU = new SeasonDraftJson.SportSlot(3, "19:00", 90, "volleyball");

    @Test
    void oneMoreGymDayAsksForFoodBedtimeAndBlockInThatOrder() {
        SeasonDraftJson from = draft(List.of(0, 1, 3, 4), List.of(TUE, THU), 12);
        SeasonDraftJson to = draft(List.of(0, 1, 2, 3, 4), List.of(TUE, THU), 12);
        SeasonNumbersJson before = numbers(2440, 486, "22:09", 12, LocalDate.of(2027, 2, 14), 4);
        SeasonNumbersJson after = numbers(2500, 492, "22:03", 12, LocalDate.of(2027, 2, 14), 5);

        List<Todo> todo = SeasonTodoRules.todo(before, after, from, to, null);

        assertThat(todo).extracting(Todo::key).containsExactly("more_food", "earlier_bed", "block");
        assertThat(todo.get(0).title()).isEqualTo("Több étel edzésnapon");
        assertThat(todo.get(0).body())
            .isEqualTo("Edzésnapokon kapsz egy plusz uzsonnát (kb. +60 kcal), és a bevásárlólista is frissül.");
        assertThat(todo.get(1).body()).isEqualTo("22:03 körül feküdj le. Az esti emlékeztetőt is ehhez igazítom.");
        assertThat(todo.get(2).body()).isEqualTo(
            "A blokkot át kell tenni heti 5 napra. Az Edzés → Blokk részben megmutatom a javaslatot, és te döntesz.");
    }

    @Test
    void identicalDraftsGiveAnEmptyList() {
        SeasonDraftJson d = draft(List.of(0, 1, 3, 4), List.of(TUE, THU), 12);
        SeasonNumbersJson n = numbers(2440, 486, "22:09", 12, LocalDate.of(2027, 2, 14), 4);

        assertThat(SeasonTodoRules.todo(n, n, d, d, null)).isEmpty();
    }

    @Test
    void smallerPortionsLongerSeasonAndSportDays() {
        SeasonDraftJson from = draft(List.of(0, 1, 3, 4), List.of(TUE, THU), 12);
        SeasonDraftJson to = draft(List.of(0, 1, 3, 4), List.of(TUE), 15);
        SeasonNumbersJson before = numbers(2440, 486, "22:09", 12, LocalDate.of(2027, 2, 14), 4);
        SeasonNumbersJson after = numbers(2380, 480, "22:15", 15, LocalDate.of(2027, 3, 7), 4);

        List<Todo> todo = SeasonTodoRules.todo(before, after, from, to, null);

        assertThat(todo).extracting(Todo::key).containsExactly("less_food", "length", "sport");
        assertThat(todo.get(0).body()).isEqualTo("Edzésnapon kb. 60 kcal-lal kisebbek lesznek az adagok.");
        assertThat(todo.get(1).body()).isEqualTo("Az évad hosszabb lesz, a célt márc. 7. körül éred el.");
        assertThat(todo.get(2).title()).isEqualTo("Sportnapok");
    }

    @Test
    void aKcalChangeDuringAnApprovedMenuWeekRefitsTheRestOfTheWeek() {
        SeasonDraftJson d = draft(List.of(0, 1, 3, 4), List.of(TUE, THU), 12);
        SeasonNumbersJson before = numbers(2440, 486, "22:09", 12, LocalDate.of(2027, 2, 14), 4);
        SeasonNumbersJson after = numbers(2460, 486, "22:09", 12, LocalDate.of(2027, 2, 14), 4);

        List<Todo> todo = SeasonTodoRules.todo(before, after, d, d, 3);

        assertThat(todo).extracting(Todo::key).containsExactly("refit_week");
        assertThat(todo.get(0).body()).isEqualTo("Csütörtöktől vasárnapig igazodnak az adagok; a bevásárlólistán egy"
            + " rövid »változott« rész jelenik meg.");
    }

    private static SeasonDraftJson draft(List<Integer> gym, List<SeasonDraftJson.SportSlot> sport, int weeks) {
        return new SeasonDraftJson("Őszi évad", "cut", new BigDecimal("80.0"), null, new BigDecimal("0.4"),
            LocalDate.of(2026, 11, 23), weeks, gym, "17:30", sport, null, List.of(), null);
    }

    private static SeasonNumbersJson numbers(int trainKcal, int sleep, String bed, int weeks, LocalDate target, int gym) {
        return new SeasonNumbersJson(trainKcal, 2200, 165, 260, sleep, bed, target, weeks, "feasible",
            new BigDecimal("-0.40"), null, null, gym, 2, null, null);
    }
}
