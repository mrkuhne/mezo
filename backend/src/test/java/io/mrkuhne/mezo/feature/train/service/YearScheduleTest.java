package io.mrkuhne.mezo.feature.train.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.train.service.YearGenerator.Input;
import io.mrkuhne.mezo.feature.train.service.YearGenerator.Result;
import io.mrkuhne.mezo.feature.train.service.YearSchedule.Layout;
import io.mrkuhne.mezo.feature.train.service.YearSchedule.MesoFacts;
import io.mrkuhne.mezo.feature.train.service.YearSchedule.Placed;
import io.mrkuhne.mezo.feature.train.service.YearSchedule.Slot;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class YearScheduleTest {

    private static final LocalDate START = LocalDate.of(2027, 1, 4);
    /** Early in the plan: nothing is past due. */
    private static final LocalDate TODAY = LocalDate.of(2027, 1, 1);

    private static List<Slot> eightBlocks() {
        List<Slot> s = new ArrayList<>();
        for (int i = 1; i <= 8; i++) s.add(new Slot(UUID.randomUUID(), i, 6, 0, "planned", null));
        return s;
    }

    private static Slot consolidation() {
        return new Slot(UUID.randomUUID(), 9, 2, 0, "planned", null);
    }

    private static Layout layout(List<Slot> loading, LocalDate today) {
        return YearSchedule.layout(START, loading, consolidation(), 2, today, YearGeneratorTest.P);
    }

    private static Slot withMeso(Slot s, String status, LocalDate mesoStart, LocalDate closedOn) {
        return new Slot(s.id(), s.ordinal(), s.weeks(), s.gapWeeks(), status,
            new MesoFacts(mesoStart, s.weeks(), closedOn));
    }

    private static LocalDate start(Layout l, int ordinal) {
        return l.blocks().get(ordinal - 1).start();
    }

    @Test void onTime_keepsDates() {
        Layout l = layout(eightBlocks(), TODAY);
        assertThat(start(l, 1)).isEqualTo(START);
        assertThat(start(l, 2)).isEqualTo(LocalDate.of(2027, 2, 15));
        assertThat(start(l, 8)).isEqualTo(LocalDate.of(2027, 10, 25));
        assertThat(l.consolidation().start()).isEqualTo(LocalDate.of(2027, 12, 20));
        assertThat(l.consolidationWeeks()).isEqualTo(2);
        assertThat(l.bufferWeeks()).isEqualTo(2);
        assertThat(l.bufferStart()).isEqualTo(LocalDate.of(2027, 12, 6));
        assertThat(l.overrunWeeks()).isZero();
        assertThat(l.end()).isEqualTo(LocalDate.of(2028, 1, 3));
        assertThat(l.blocks()).allMatch(Placed::occupies);
    }

    @Test void twoDaysLate_keepsLaterDates() {
        List<Slot> s = eightBlocks();
        s.set(0, withMeso(s.get(0), "running", LocalDate.of(2027, 1, 6), null));
        Layout l = layout(s, LocalDate.of(2027, 1, 7));
        assertThat(start(l, 1)).isEqualTo(START);
        assertThat(start(l, 2)).isEqualTo(LocalDate.of(2027, 2, 15));
        assertThat(l.consolidation().start()).isEqualTo(LocalDate.of(2027, 12, 20));
        assertThat(l.bufferWeeks()).isEqualTo(2);
    }

    @Test void fiveDaysLate_shiftsLaterBlocks() {
        List<Slot> s = eightBlocks();
        s.set(0, withMeso(s.get(0), "running", LocalDate.of(2027, 1, 9), null));
        Layout l = layout(s, LocalDate.of(2027, 1, 10));
        assertThat(start(l, 1)).isEqualTo(LocalDate.of(2027, 1, 9));
        assertThat(start(l, 2)).isEqualTo(LocalDate.of(2027, 2, 22));
        assertThat(l.consolidation().start()).isEqualTo(LocalDate.of(2027, 12, 20));
        assertThat(l.bufferWeeks()).isEqualTo(1);
    }

    @Test void threeWeekDelay_eatsBufferThenShortensConsolidation() {
        List<Slot> s = eightBlocks();
        s.set(0, withMeso(s.get(0), "running", LocalDate.of(2027, 1, 25), null));
        Layout l = layout(s, LocalDate.of(2027, 1, 26));
        assertThat(start(l, 2)).isEqualTo(LocalDate.of(2027, 3, 8));
        assertThat(l.bufferWeeks()).isZero();
        assertThat(l.consolidationWeeks()).isEqualTo(1);
        assertThat(l.consolidation().weeks()).isEqualTo(1);
        assertThat(l.consolidation().start()).isEqualTo(LocalDate.of(2027, 12, 27));
        assertThat(l.overrunWeeks()).isZero();
        assertThat(l.end()).isEqualTo(LocalDate.of(2028, 1, 3));
    }

    @Test void fourWeekDelay_movesEnd() {
        List<Slot> s = eightBlocks();
        s.set(0, withMeso(s.get(0), "running", LocalDate.of(2027, 2, 1), null));
        Layout l = layout(s, LocalDate.of(2027, 2, 2));
        assertThat(l.bufferWeeks()).isZero();
        assertThat(l.consolidationWeeks()).isEqualTo(1);
        assertThat(l.consolidation().start()).isEqualTo(LocalDate.of(2028, 1, 3));
        assertThat(l.overrunWeeks()).isEqualTo(1);
        assertThat(l.end()).isEqualTo(LocalDate.of(2028, 1, 10));
    }

    /**
     * The brief's value for block 4 (2027-03-01) is not reachable with 6-week blocks from 2027-01-04 — block 3 is
     * due 2027-03-29, so a skipped block 3 hands its date to block 4 (buffer 8, consolidation unmoved).
     */
    @Test void skippedBlock_freesItsWeeks() {
        List<Slot> s = eightBlocks();
        Slot b3 = s.get(2);
        s.set(2, new Slot(b3.id(), 3, 6, 0, "skipped", null));
        Layout l = layout(s, TODAY);
        assertThat(l.blocks().get(2).occupies()).isFalse();
        assertThat(start(l, 3)).isEqualTo(LocalDate.of(2027, 3, 29));
        assertThat(start(l, 4)).isEqualTo(LocalDate.of(2027, 3, 29));
        assertThat(l.bufferWeeks()).isEqualTo(8);
        assertThat(l.consolidation().start()).isEqualTo(LocalDate.of(2027, 12, 20));
        assertThat(l.consolidationWeeks()).isEqualTo(2);
    }

    @Test void notStartedPastDue_redatesFromToday() {
        List<Slot> s = eightBlocks();
        s.set(0, withMeso(s.get(0), "running", START, null));
        // Block 2 is due 2027-02-15; today is 4 days later and it has not started.
        Layout l = layout(s, LocalDate.of(2027, 2, 19));
        assertThat(start(l, 2)).isEqualTo(LocalDate.of(2027, 2, 22));
        assertThat(start(l, 3)).isEqualTo(LocalDate.of(2027, 4, 5));
        assertThat(l.bufferWeeks()).isEqualTo(1);
    }

    @Test void notStartedWithinTolerance_keepsDue() {
        List<Slot> s = eightBlocks();
        s.set(0, withMeso(s.get(0), "running", START, null));
        Layout l = layout(s, LocalDate.of(2027, 2, 18));
        assertThat(start(l, 2)).isEqualTo(LocalDate.of(2027, 2, 15));
    }

    @Test void endedEarly_pullsNextForward() {
        List<Slot> s = eightBlocks();
        s.set(0, withMeso(s.get(0), "done", START, LocalDate.of(2027, 2, 1)));
        Layout l = layout(s, LocalDate.of(2027, 2, 1));
        assertThat(start(l, 2)).isEqualTo(LocalDate.of(2027, 2, 1));
        assertThat(l.bufferWeeks()).isEqualTo(4);
        assertThat(l.consolidation().start()).isEqualTo(LocalDate.of(2027, 12, 20));
    }

    @Test void endedEarlyMidweek_nextOnFollowingMonday() {
        List<Slot> s = eightBlocks();
        s.set(0, withMeso(s.get(0), "done", START, LocalDate.of(2027, 2, 3)));
        Layout l = layout(s, LocalDate.of(2027, 2, 3));
        assertThat(start(l, 2)).isEqualTo(LocalDate.of(2027, 2, 8));
    }

    @Test void closedWithinToleranceOfEnd_keepsSchedule() {
        List<Slot> s = eightBlocks();
        s.set(0, withMeso(s.get(0), "done", START, LocalDate.of(2027, 2, 13)));
        Layout l = layout(s, LocalDate.of(2027, 2, 13));
        assertThat(start(l, 2)).isEqualTo(LocalDate.of(2027, 2, 15));
    }

    @Test void gapWeek_shiftsFollowing() {
        List<Slot> s = eightBlocks();
        Slot b4 = s.get(3);
        s.set(3, new Slot(b4.id(), 4, 6, 1, "planned", null));
        Layout l = layout(s, TODAY);
        assertThat(start(l, 3)).isEqualTo(LocalDate.of(2027, 3, 29));
        assertThat(start(l, 4)).isEqualTo(LocalDate.of(2027, 5, 17));
        assertThat(start(l, 8)).isEqualTo(LocalDate.of(2027, 11, 1));
        assertThat(l.bufferWeeks()).isEqualTo(1);
        assertThat(l.consolidation().start()).isEqualTo(LocalDate.of(2027, 12, 20));
    }

    /** The generator leaves no buffer by design: 7 × 7-week blocks leave 1 week, which becomes the buffer. */
    @Test void sevenWeekBlocks_leftoverBecomesBufferBeforeConsolidation() {
        Result r = YearGenerator.generate(new Input(START, List.of(), 7, 2, null), YearGeneratorTest.P,
            YearGeneratorTest.MAV);
        List<Slot> loading = new ArrayList<>();
        Slot cons = null;
        for (YearGenerator.Block b : r.blocks()) {
            Slot slot = new Slot(UUID.randomUUID(), b.ordinal(), b.weeks(), 0, "planned", null);
            if (b.kind().equals(YearGenerator.CONSOLIDATION)) cons = slot; else loading.add(slot);
        }
        assertThat(loading).hasSize(7);
        Layout l = YearSchedule.layout(START, loading, cons, 2, TODAY, YearGeneratorTest.P);
        assertThat(l.bufferWeeks()).isEqualTo(1);
        assertThat(l.bufferStart()).isEqualTo(LocalDate.of(2027, 12, 13));
        assertThat(l.consolidation().start()).isEqualTo(LocalDate.of(2027, 12, 20));
        assertThat(l.consolidationWeeks()).isEqualTo(2);
        assertThat(l.end()).isEqualTo(LocalDate.of(2028, 1, 3));
    }

    @Test void consolidationWithMeso_followsItsMeso() {
        List<Slot> s = eightBlocks();
        for (int i = 0; i < 8; i++) {
            LocalDate due = START.plusWeeks(6L * i);
            s.set(i, withMeso(s.get(i), "done", due, due.plusWeeks(6).minusDays(1)));
        }
        Slot c = consolidation();
        Slot cm = new Slot(c.id(), 9, 2, 0, "running", new MesoFacts(LocalDate.of(2027, 12, 22), 2, null));
        Layout l = YearSchedule.layout(START, s, cm, 2, LocalDate.of(2027, 12, 23), YearGeneratorTest.P);
        assertThat(l.consolidation().start()).isEqualTo(LocalDate.of(2027, 12, 20));
        assertThat(l.consolidationWeeks()).isEqualTo(2);
        assertThat(l.bufferWeeks()).isEqualTo(2);
    }
}
