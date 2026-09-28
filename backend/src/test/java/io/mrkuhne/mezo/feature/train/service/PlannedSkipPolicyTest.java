package io.mrkuhne.mezo.feature.train.service;

import static org.assertj.core.api.Assertions.assertThat;
import io.mrkuhne.mezo.feature.train.entity.PlannedSkipEntity;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class PlannedSkipPolicyTest {

    private static final UUID ID_1 = UUID.fromString("00000000-0000-0000-0000-000000000001");
    private static final UUID ID_2 = UUID.fromString("00000000-0000-0000-0000-000000000002");
    private static final UUID ID_3 = UUID.fromString("00000000-0000-0000-0000-000000000003");
    private static final UUID ID_4 = UUID.fromString("00000000-0000-0000-0000-000000000004");

    @Test
    void testSeriousRow_shouldBeExcused_whenSerious() {
        PlannedSkipPolicy.Row row = new PlannedSkipPolicy.Row(
            ID_1,
            LocalDate.of(2026, 9, 28),
            PlannedSkipEntity.Kind.GYM,
            1,
            null,
            null,
            PlannedSkipEntity.Reason.ILLNESS,
            null,
            PlannedSkipPolicy.Source.USER,
            Instant.parse("2026-09-28T10:00:00Z")
        );

        List<PlannedSkipPolicy.Verdict> verdicts = PlannedSkipPolicy.judge(List.of(row));

        assertThat(verdicts).hasSize(1);
        PlannedSkipPolicy.Verdict verdict = verdicts.get(0);
        assertThat(verdict.serious()).isTrue();
        assertThat(verdict.excused()).isTrue();
        assertThat(verdict.freePass()).isFalse();
    }

    @Test
    void testTwoSoftRowsSameWeek_firstGetsPass_secondDoesNot() {
        PlannedSkipPolicy.Row row1 = new PlannedSkipPolicy.Row(
            ID_1,
            LocalDate.of(2026, 9, 28),
            PlannedSkipEntity.Kind.GYM,
            1,
            null,
            null,
            PlannedSkipEntity.Reason.NONE,
            null,
            PlannedSkipPolicy.Source.USER,
            Instant.parse("2026-09-28T10:00:00Z")
        );
        PlannedSkipPolicy.Row row2 = new PlannedSkipPolicy.Row(
            ID_2,
            LocalDate.of(2026, 9, 28),
            PlannedSkipEntity.Kind.GYM,
            1,
            null,
            null,
            PlannedSkipEntity.Reason.OTHER,
            null,
            PlannedSkipPolicy.Source.USER,
            Instant.parse("2026-09-28T11:00:00Z")
        );

        List<PlannedSkipPolicy.Verdict> verdicts = PlannedSkipPolicy.judge(List.of(row1, row2));

        assertThat(verdicts).hasSize(2);
        assertThat(verdicts.get(0).freePass()).isTrue();
        assertThat(verdicts.get(0).excused()).isTrue();
        assertThat(verdicts.get(1).freePass()).isFalse();
        assertThat(verdicts.get(1).excused()).isFalse();
    }

    @Test
    void testTwoSoftRowsReverseOrder_sortsByCreatedAtThenId() {
        PlannedSkipPolicy.Row row1 = new PlannedSkipPolicy.Row(
            ID_1,
            LocalDate.of(2026, 9, 28),
            PlannedSkipEntity.Kind.GYM,
            1,
            null,
            null,
            PlannedSkipEntity.Reason.NONE,
            null,
            PlannedSkipPolicy.Source.USER,
            Instant.parse("2026-09-28T10:00:00Z")
        );
        PlannedSkipPolicy.Row row2 = new PlannedSkipPolicy.Row(
            ID_2,
            LocalDate.of(2026, 9, 28),
            PlannedSkipEntity.Kind.GYM,
            1,
            null,
            null,
            PlannedSkipEntity.Reason.OTHER,
            null,
            PlannedSkipPolicy.Source.USER,
            Instant.parse("2026-09-28T11:00:00Z")
        );

        // Give them in reverse order
        List<PlannedSkipPolicy.Verdict> verdicts = PlannedSkipPolicy.judge(List.of(row2, row1));

        assertThat(verdicts).hasSize(2);
        // Output order = input order, but the one with earlier createdAt gets the pass
        // row2 is input[0], row1 is input[1]
        assertThat(verdicts.get(0).row().id()).isEqualTo(ID_2);
        assertThat(verdicts.get(0).freePass()).isFalse();
        assertThat(verdicts.get(1).row().id()).isEqualTo(ID_1);
        assertThat(verdicts.get(1).freePass()).isTrue();
    }

    @Test
    void testSoftRowsDifferentWeeks_bothGetPass() {
        PlannedSkipPolicy.Row row1 = new PlannedSkipPolicy.Row(
            ID_1,
            LocalDate.of(2026, 9, 27), // Sunday of week 39
            PlannedSkipEntity.Kind.GYM,
            0,
            null,
            null,
            PlannedSkipEntity.Reason.NONE,
            null,
            PlannedSkipPolicy.Source.USER,
            Instant.parse("2026-09-27T10:00:00Z")
        );
        PlannedSkipPolicy.Row row2 = new PlannedSkipPolicy.Row(
            ID_2,
            LocalDate.of(2026, 9, 28), // Monday of week 40
            PlannedSkipEntity.Kind.GYM,
            1,
            null,
            null,
            PlannedSkipEntity.Reason.OTHER,
            null,
            PlannedSkipPolicy.Source.USER,
            Instant.parse("2026-09-28T11:00:00Z")
        );

        List<PlannedSkipPolicy.Verdict> verdicts = PlannedSkipPolicy.judge(List.of(row1, row2));

        assertThat(verdicts).hasSize(2);
        assertThat(verdicts.get(0).freePass()).isTrue();
        assertThat(verdicts.get(0).excused()).isTrue();
        assertThat(verdicts.get(1).freePass()).isTrue();
        assertThat(verdicts.get(1).excused()).isTrue();
    }

    @Test
    void testSeriousFirst_softLaterSameWeek_softStillGetsPass() {
        PlannedSkipPolicy.Row serious = new PlannedSkipPolicy.Row(
            ID_1,
            LocalDate.of(2026, 9, 28),
            PlannedSkipEntity.Kind.GYM,
            1,
            null,
            null,
            PlannedSkipEntity.Reason.ILLNESS,
            null,
            PlannedSkipPolicy.Source.USER,
            Instant.parse("2026-09-28T10:00:00Z")
        );
        PlannedSkipPolicy.Row soft = new PlannedSkipPolicy.Row(
            ID_2,
            LocalDate.of(2026, 9, 28),
            PlannedSkipEntity.Kind.GYM,
            1,
            null,
            null,
            PlannedSkipEntity.Reason.OTHER,
            null,
            PlannedSkipPolicy.Source.USER,
            Instant.parse("2026-09-28T11:00:00Z")
        );

        List<PlannedSkipPolicy.Verdict> verdicts = PlannedSkipPolicy.judge(List.of(serious, soft));

        assertThat(verdicts).hasSize(2);
        assertThat(verdicts.get(0).serious()).isTrue();
        assertThat(verdicts.get(0).freePass()).isFalse();
        assertThat(verdicts.get(0).excused()).isTrue();
        // Soft row still gets the pass because serious never consumes it
        assertThat(verdicts.get(1).serious()).isFalse();
        assertThat(verdicts.get(1).freePass()).isTrue();
        assertThat(verdicts.get(1).excused()).isTrue();
    }

    @Test
    void testAdviceBackedUserRow_shouldBeExcusedWithoutPass_andLeaveThePassForTheNextSoftSkip() {
        PlannedSkipPolicy.Row backed = new PlannedSkipPolicy.Row(ID_1, LocalDate.of(2026, 9, 28),
            PlannedSkipEntity.Kind.SPORT, 0, "18:00", null, PlannedSkipEntity.Reason.TIRED, null,
            PlannedSkipPolicy.Source.USER, Instant.parse("2026-09-28T10:00:00Z"), true);
        PlannedSkipPolicy.Row soft = new PlannedSkipPolicy.Row(ID_2, LocalDate.of(2026, 9, 29),
            PlannedSkipEntity.Kind.GYM, null, null, null, PlannedSkipEntity.Reason.TIRED, null,
            PlannedSkipPolicy.Source.USER, Instant.parse("2026-09-29T10:00:00Z"));

        List<PlannedSkipPolicy.Verdict> verdicts = PlannedSkipPolicy.judge(List.of(backed, soft));

        assertThat(verdicts.get(0).excused()).isTrue();
        assertThat(verdicts.get(0).freePass()).isFalse();
        assertThat(verdicts.get(1).freePass()).isTrue();
        assertThat(verdicts.get(1).excused()).isTrue();
    }

    @Test
    void testAdviceRow_shouldBeExcused_doesNotConsumesPass() {
        PlannedSkipPolicy.Row advice = new PlannedSkipPolicy.Row(
            ID_1,
            LocalDate.of(2026, 9, 28),
            PlannedSkipEntity.Kind.GYM,
            1,
            null,
            null,
            PlannedSkipEntity.Reason.NONE,
            null,
            PlannedSkipPolicy.Source.ADVICE,
            Instant.parse("2026-09-28T10:00:00Z")
        );
        PlannedSkipPolicy.Row soft = new PlannedSkipPolicy.Row(
            ID_2,
            LocalDate.of(2026, 9, 28),
            PlannedSkipEntity.Kind.GYM,
            1,
            null,
            null,
            PlannedSkipEntity.Reason.OTHER,
            null,
            PlannedSkipPolicy.Source.USER,
            Instant.parse("2026-09-28T11:00:00Z")
        );

        List<PlannedSkipPolicy.Verdict> verdicts = PlannedSkipPolicy.judge(List.of(advice, soft));

        assertThat(verdicts).hasSize(2);
        // ADVICE row is excused but doesn't consume pass
        assertThat(verdicts.get(0).row().source()).isEqualTo(PlannedSkipPolicy.Source.ADVICE);
        assertThat(verdicts.get(0).excused()).isTrue();
        assertThat(verdicts.get(0).freePass()).isFalse();
        // USER soft row gets the pass
        assertThat(verdicts.get(1).row().source()).isEqualTo(PlannedSkipPolicy.Source.USER);
        assertThat(verdicts.get(1).freePass()).isTrue();
        assertThat(verdicts.get(1).excused()).isTrue();
    }

    @Test
    void testIsoWeekKey_week39_returns3939() {
        // 2026-09-27 is Sunday of week 39 (ISO 8601)
        LocalDate sunday = LocalDate.of(2026, 9, 27);
        long weekKey = PlannedSkipPolicy.isoWeekKey(sunday);
        assertThat(weekKey).isEqualTo(202639L);
    }

    @Test
    void testIsoWeekKey_week40_returns3940() {
        // 2026-09-28 is Monday of week 40 (ISO 8601)
        LocalDate monday = LocalDate.of(2026, 9, 28);
        long weekKey = PlannedSkipPolicy.isoWeekKey(monday);
        assertThat(weekKey).isEqualTo(202640L);
    }

    @Test
    void testIsSerious_illnessIsSevere() {
        assertThat(PlannedSkipPolicy.isSerious(PlannedSkipEntity.Reason.ILLNESS)).isTrue();
    }

    @Test
    void testIsSerious_stomachIsSevere() {
        assertThat(PlannedSkipPolicy.isSerious(PlannedSkipEntity.Reason.STOMACH)).isTrue();
    }

    @Test
    void testIsSerious_injuryIsSevere() {
        assertThat(PlannedSkipPolicy.isSerious(PlannedSkipEntity.Reason.INJURY)).isTrue();
    }

    @Test
    void testIsSerious_travelIsSevere() {
        assertThat(PlannedSkipPolicy.isSerious(PlannedSkipEntity.Reason.TRAVEL)).isTrue();
    }

    @Test
    void testIsSerious_tiredIsNotSevere() {
        assertThat(PlannedSkipPolicy.isSerious(PlannedSkipEntity.Reason.TIRED)).isFalse();
    }

    @Test
    void testIsSerious_noTimeIsNotSevere() {
        assertThat(PlannedSkipPolicy.isSerious(PlannedSkipEntity.Reason.NO_TIME)).isFalse();
    }

    @Test
    void testIsSerious_noMoodIsNotSevere() {
        assertThat(PlannedSkipPolicy.isSerious(PlannedSkipEntity.Reason.NO_MOOD)).isFalse();
    }

    @Test
    void testIsSerious_otherIsNotSevere() {
        assertThat(PlannedSkipPolicy.isSerious(PlannedSkipEntity.Reason.OTHER)).isFalse();
    }

    @Test
    void testIsSerious_noneIsNotSevere() {
        assertThat(PlannedSkipPolicy.isSerious(PlannedSkipEntity.Reason.NONE)).isFalse();
    }
}
