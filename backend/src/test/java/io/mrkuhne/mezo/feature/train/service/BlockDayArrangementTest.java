package io.mrkuhne.mezo.feature.train.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.train.service.BlockDayArrangement.Change;
import io.mrkuhne.mezo.feature.train.service.BlockDayArrangement.Day;
import io.mrkuhne.mezo.feature.train.service.BlockDayArrangement.Plan;
import java.util.List;
import java.util.UUID;
import java.util.function.ToIntFunction;
import org.junit.jupiter.api.Test;

/** Re-arranging a running block onto new gym days (mezo-r36n9.122) — the pure part. */
class BlockDayArrangementTest {

    private static final UUID A = UUID.nameUUIDFromBytes("A".getBytes());
    private static final UUID B = UUID.nameUUIDFromBytes("B".getBytes());
    private static final UUID C = UUID.nameUUIDFromBytes("C".getBytes());
    private static final UUID D = UUID.nameUUIDFromBytes("D".getBytes());

    private static Day day(UUID id, int weekday, String title) {
        return new Day(id, weekday, title);
    }

    /** No preference: every candidate scores the same, so the tie-breaks decide. */
    private static final ToIntFunction<List<Plan.Slot>> FLAT = slots -> 0;

    @Test
    void sameCount_shouldMoveTheDaysInOrderOntoTheNewWeekdays() {
        List<Day> block = List.of(day(A, 0, "Felső A"), day(B, 1, "Alsó A"), day(C, 3, "Felső B"), day(D, 4, "Alsó B"));

        Plan p = BlockDayArrangement.arrange(block, List.of(0, 2, 3, 5), FLAT);

        assertThat(p.slots()).extracting(Plan.Slot::weekday, Plan.Slot::sourceId, Plan.Slot::change, Plan.Slot::fromWeekday)
            .containsExactly(
                org.assertj.core.groups.Tuple.tuple(0, A, Change.KEEP, 0),
                org.assertj.core.groups.Tuple.tuple(2, B, Change.MOVE, 1),
                org.assertj.core.groups.Tuple.tuple(3, C, Change.KEEP, 3),
                org.assertj.core.groups.Tuple.tuple(5, D, Change.MOVE, 4));
        assertThat(p.dropped()).isEmpty();
        assertThat(p.changed()).isTrue();
    }

    @Test
    void sameDays_shouldBeUnchanged() {
        List<Day> block = List.of(day(A, 0, "Felső A"), day(B, 2, "Alsó A"));

        Plan p = BlockDayArrangement.arrange(block, List.of(2, 0), FLAT);

        assertThat(p.changed()).isFalse();
        assertThat(p.slots()).extracting(Plan.Slot::change).containsOnly(Change.KEEP);
    }

    @Test
    void moreDays_shouldAddTheCopyTheScoreLikesBest_atItsBestPlace() {
        List<Day> block = List.of(day(A, 0, "Felső"), day(B, 2, "Alsó"));
        // the score wants the week Felső · Alsó · Felső — anything else is worse
        ToIntFunction<List<Plan.Slot>> wantsUpperLowerUpper = slots -> {
            List<UUID> order = slots.stream().map(Plan.Slot::sourceId).toList();
            return order.equals(List.of(A, B, A)) ? 0 : 5;
        };

        Plan p = BlockDayArrangement.arrange(block, List.of(0, 2, 4), wantsUpperLowerUpper);

        assertThat(p.slots()).extracting(Plan.Slot::weekday, Plan.Slot::sourceId, Plan.Slot::change)
            .containsExactly(
                org.assertj.core.groups.Tuple.tuple(0, A, Change.KEEP),
                org.assertj.core.groups.Tuple.tuple(2, B, Change.KEEP),
                org.assertj.core.groups.Tuple.tuple(4, A, Change.ADD));
        assertThat(p.slots().get(2).fromWeekday()).isEqualTo(0);
        assertThat(p.slots().get(2).title()).isEqualTo("Felső");
    }

    @Test
    void moreDays_onATie_shouldRepeatTheFirstDayAtTheEnd() {
        List<Day> block = List.of(day(A, 0, "Felső"), day(B, 2, "Alsó"));

        Plan p = BlockDayArrangement.arrange(block, List.of(0, 2, 4, 6), FLAT);

        assertThat(p.slots()).extracting(Plan.Slot::sourceId).containsExactly(A, B, A, A);
        assertThat(p.slots()).extracting(Plan.Slot::change)
            .containsExactly(Change.KEEP, Change.KEEP, Change.ADD, Change.ADD);
    }

    @Test
    void fewerDays_shouldDropTheDayWhoseLossTheScoreMindsLeast() {
        List<Day> block = List.of(day(A, 0, "Felső A"), day(B, 1, "Alsó A"), day(C, 3, "Felső B"), day(D, 4, "Alsó B"));
        // dropping C (a second upper day) keeps the week best balanced
        ToIntFunction<List<Plan.Slot>> missesC = slots ->
            slots.stream().anyMatch(s -> s.sourceId().equals(C)) ? 3 : 0;

        Plan p = BlockDayArrangement.arrange(block, List.of(0, 2, 4), missesC);

        assertThat(p.slots()).extracting(Plan.Slot::weekday, Plan.Slot::sourceId)
            .containsExactly(org.assertj.core.groups.Tuple.tuple(0, A), org.assertj.core.groups.Tuple.tuple(2, B),
                org.assertj.core.groups.Tuple.tuple(4, D));
        assertThat(p.dropped()).extracting(Day::id).containsExactly(C);
    }

    @Test
    void fewerDays_onATie_shouldDropTheLastDays() {
        List<Day> block = List.of(day(A, 0, "Felső A"), day(B, 1, "Alsó A"), day(C, 3, "Felső B"));

        Plan p = BlockDayArrangement.arrange(block, List.of(1), FLAT);

        assertThat(p.slots()).extracting(Plan.Slot::sourceId, Plan.Slot::change)
            .containsExactly(org.assertj.core.groups.Tuple.tuple(A, Change.MOVE));
        assertThat(p.dropped()).extracting(Day::id).containsExactly(B, C);
    }

    @Test
    void unknownLabels_shouldKeepTheirListOrder_afterTheKnownWeekdays() {
        List<Day> block = List.of(day(A, -1, "Extra"), day(B, 3, "Felső"));

        Plan p = BlockDayArrangement.arrange(block, List.of(1, 5), FLAT);

        assertThat(p.slots()).extracting(Plan.Slot::sourceId).containsExactly(B, A);
    }
}
