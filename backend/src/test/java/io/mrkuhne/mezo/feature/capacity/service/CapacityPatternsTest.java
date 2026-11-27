package io.mrkuhne.mezo.feature.capacity.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.capacity.service.CapacityPatterns.DayFact;
import io.mrkuhne.mezo.feature.capacity.service.CapacityPatterns.Found;
import io.mrkuhne.mezo.feature.capacity.service.CapacityPatterns.MoveFact;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

/** Boop B7 K4 Task 22 (mezo-r36n9.17): the learned patterns' counts and show rule. All facts invented. */
class CapacityPatternsTest {

    private static final LocalDate MONDAY = LocalDate.of(2026, 10, 5);

    private static DayFact day(LocalDate d, String verdict) {
        return new DayFact(d, verdict, 0, false, false, false, false, null, null, null);
    }

    private static Found find(List<Found> all, String key) {
        return all.stream().filter(f -> f.key().equals(key)).findFirst().orElseThrow();
    }

    /** Three Thursdays, two tight; the other days are calm — evidence 3, consistent 2, shown. */
    @Test
    void twoOfThreeConsistentShows() {
        List<DayFact> days = new ArrayList<>();
        for (int w = 0; w < 3; w++) {
            for (int i = 0; i < 7; i++) {
                LocalDate d = MONDAY.plusWeeks(w).plusDays(i);
                boolean thursdayTight = i == 3 && w < 2;
                days.add(day(d, thursdayTight ? "túl sok" : "rendben"));
            }
        }

        Found thu = find(CapacityPatterns.find(days, List.of()), "weekday-overload:THURSDAY");

        assertThat(thu.evidence()).isEqualTo(3);
        assertThat(thu.consistent()).isEqualTo(2);
        assertThat(thu.shown()).isTrue();
        assertThat(thu.title()).isEqualTo("A csütörtök a gyenge pontod.");
        assertThat(thu.body()).contains("csütörtökön 3 napból 2");
        assertThat(thu.payload()).containsEntry("weekday", "THURSDAY");
        assertThat(CapacityPatterns.shown(CapacityPatterns.find(days, List.of())))
            .extracting(Found::key).containsExactly("weekday-overload:THURSDAY");
    }

    /** Two occurrences, both consistent, stay hidden: three is the minimum. */
    @Test
    void twoOccurrencesStayHidden() {
        List<DayFact> days = new ArrayList<>();
        for (int w = 0; w < 2; w++) {
            for (int i = 0; i < 7; i++) {
                days.add(day(MONDAY.plusWeeks(w).plusDays(i), i == 3 ? "túl sok" : "laza"));
            }
        }

        Found thu = find(CapacityPatterns.find(days, List.of()), "weekday-overload:THURSDAY");

        assertThat(thu.evidence()).isEqualTo(2);
        assertThat(thu.shown()).isFalse();
        assertThat(CapacityPatterns.visible(2, 2)).isFalse();
        assertThat(CapacityPatterns.visible(3, 2)).isTrue();
        assertThat(CapacityPatterns.visible(5, 2)).isFalse(); // fewer than half consistent
    }

    /** Every day tight: no weekday stands out, so none is "the weak spot". */
    @Test
    void aWeekdayMustStandOutAgainstTheOthers() {
        List<DayFact> days = new ArrayList<>();
        for (int i = 0; i < 28; i++) {
            days.add(day(MONDAY.plusDays(i), "szoros"));
        }

        assertThat(CapacityPatterns.shown(CapacityPatterns.find(days, List.of()))).isEmpty();
        assertThat(find(CapacityPatterns.find(days, List.of()), "weekday-overload:MONDAY").contrast()).isFalse();
    }

    /** Long meeting days skip the session while other session days do not. */
    @Test
    void longMeetingDaysSkipTheSession() {
        List<DayFact> days = new ArrayList<>();
        for (int i = 0; i < 4; i++) { // 4 heavy meeting days with a session: 3 skipped
            days.add(new DayFact(MONDAY.plusDays(i), "szoros", 300, false, false, true, i == 0, null, null, null));
        }
        for (int i = 4; i < 8; i++) { // 4 calm session days: all done
            days.add(new DayFact(MONDAY.plusDays(i), "rendben", 60, false, false, true, true, null, null, null));
        }

        Found f = find(CapacityPatterns.find(days, List.of()), CapacityPatterns.MEETINGS_SKIP);

        assertThat(f.evidence()).isEqualTo(4);
        assertThat(f.consistent()).isEqualTo(3);
        assertThat(f.shown()).isTrue();
    }

    /** Late evenings shorten the night after; evening energy after back-to-back blocks is low. */
    @Test
    void lateEveningsAndBackToBackBlocks() {
        List<DayFact> days = new ArrayList<>();
        for (int i = 0; i < 3; i++) {
            days.add(new DayFact(MONDAY.plusDays(i), "rendben", 0, true, true, false, false, 380, 480, 3));
        }
        for (int i = 3; i < 9; i++) {
            days.add(new DayFact(MONDAY.plusDays(i), "laza", 0, false, false, false, false, 470, 480, 7));
        }

        List<Found> all = CapacityPatterns.find(days, List.of());

        assertThat(find(all, CapacityPatterns.LATE_SLEEP).shown()).isTrue();
        assertThat(find(all, CapacityPatterns.BACK_TO_BACK).shown()).isTrue();
        assertThat(find(all, CapacityPatterns.BACK_TO_BACK).consistent()).isEqualTo(3);
    }

    /** Accepted moves of one kind that went well: the kind works for him. */
    @Test
    void moveKindWorks() {
        List<MoveFact> moves = List.of(new MoveFact("MOVE_SESSION_DAY", true), new MoveFact("MOVE_SESSION_DAY", true),
            new MoveFact("MOVE_SESSION_DAY", false), new MoveFact("SHIFT_BEDTIME", true));

        List<Found> all = CapacityPatterns.find(List.of(), moves);

        Found move = find(all, "move-kind-works:MOVE_SESSION_DAY");
        assertThat(move.evidence()).isEqualTo(3);
        assertThat(move.consistent()).isEqualTo(2);
        assertThat(move.shown()).isTrue();
        assertThat(move.payload()).containsEntry("kind", "MOVE_SESSION_DAY").doesNotContainKey("weekday");
        assertThat(find(all, "move-kind-works:SHIFT_BEDTIME").shown()).isFalse();
    }
}
