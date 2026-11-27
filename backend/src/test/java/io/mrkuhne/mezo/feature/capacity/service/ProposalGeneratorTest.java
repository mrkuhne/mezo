package io.mrkuhne.mezo.feature.capacity.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.capacity.config.CapacityProperties;
import io.mrkuhne.mezo.feature.capacity.port.CapacityCalendarPort.CalendarEventView;
import io.mrkuhne.mezo.feature.capacity.service.AdjustmentPayload.MoveSessionDay;
import io.mrkuhne.mezo.feature.capacity.service.AdjustmentPayload.ShiftBedtime;
import io.mrkuhne.mezo.feature.capacity.service.AdjustmentPayload.ShiftSessionTime;
import io.mrkuhne.mezo.feature.capacity.service.CapacityCalculator.Capacity;
import io.mrkuhne.mezo.feature.capacity.service.DemandCalculator.Demand;
import io.mrkuhne.mezo.feature.capacity.service.DemandCalculator.DemandItem;
import io.mrkuhne.mezo.feature.capacity.service.WeekPicture.PlannedSession;
import io.mrkuhne.mezo.feature.capacity.service.WeekPicture.SportSlot;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/**
 * Boop B7 K3 (mezo-r36n9.17, Task 16): the pure proposal generator on hand-built weeks. The spike week ("például",
 * invented): Monday upper body, Thursday a packed leg day, Friday back, Saturday empty, volleyball Tuesday evening and
 * Sunday morning. Ratios follow the spike's demand / capacity pairs; units are scaled so one 60-minute session is a
 * realistic share of a day.
 */
class ProposalGeneratorTest {

    static final ZoneId ZONE = ZoneId.of("Europe/Budapest");
    static final LocalDate MON = LocalDate.of(2026, 11, 23);
    static final double SCALE = 2.2;
    static final CapacityProperties P = props();

    static CapacityProperties props() {
        return new CapacityProperties(true, new CapacityProperties.Verdict(0.6, 0.9, 1.0), 1.25, 1.3, 90, 15,
            new CapacityProperties.Learning(14, 5), new CapacityProperties.Proposals(5),
            new CapacityProperties.Live(Duration.ofHours(3)), new CapacityProperties.Sunday("0 0 18 * * SUN"), 2000,
            6.0);
    }

    // ── week builder ─────────────────────────────────────────────────────────

    static final class Week {
        final Map<LocalDate, double[]> ratio = new LinkedHashMap<>(); // {demand, capacity} in spike units
        final List<PlannedSession> sessions = new ArrayList<>();
        final List<SportSlot> sport = new ArrayList<>();
        final List<CalendarEventView> events = new ArrayList<>();
        final Map<LocalDate, List<DemandItem>> meetings = new HashMap<>();
        final Set<LocalDate> started = new HashSet<>();
        final Set<LocalDate> claimed = new HashSet<>();
        final Map<LocalDate, LocalTime> bedtimes = new HashMap<>();
        LocalDate today = MON;
        boolean recovery;

        Week day(int offset, double demand, double capacity) {
            ratio.put(MON.plusDays(offset), new double[] {demand, capacity});
            return this;
        }

        Week gym(int offset, String time, String label, boolean heavy) {
            return gym(offset, time, label, heavy, 60);
        }

        Week gym(int offset, String time, String label, boolean heavy, int minutes) {
            sessions.add(new PlannedSession(UUID.randomUUID(), MON.plusDays(offset), LocalTime.parse(time), minutes,
                label, false, false, heavy));
            return this;
        }

        Week sport(int offset, String time, String label) {
            sport.add(new SportSlot(MON.plusDays(offset), LocalTime.parse(time), 90, label));
            return this;
        }

        Week event(int offset, String title, String from, String to) {
            LocalDate d = MON.plusDays(offset);
            events.add(new CalendarEventView(UUID.randomUUID(), "ext-" + title, d, title, at(d, from), at(d, to),
                false, null, null, null, null, null, null, null, null));
            return this;
        }

        /** A scored meeting inside the day's demand (the generator reads meetings from the load model's items). */
        Week meeting(int offset, String title, String from, String to) {
            LocalDate d = MON.plusDays(offset);
            meetings.computeIfAbsent(d, k -> new ArrayList<>())
                .add(new DemandItem(title, "meeting", at(d, from), at(d, to), 0.1, false, "key-" + title, null));
            return event(offset, title, from, to);
        }

        static Instant at(LocalDate d, String time) {
            return d.atTime(LocalTime.parse(time)).atZone(ZONE).toInstant();
        }

        WeekPicture build() {
            List<CapacityDay> days = new ArrayList<>();
            for (int i = 0; i < 7; i++) {
                LocalDate d = MON.plusDays(i);
                double[] r = ratio.getOrDefault(d, new double[] {0.3, 0.85});
                List<DemandItem> items = new ArrayList<>(meetings.getOrDefault(d, List.of()));
                for (PlannedSession s : sessions) {
                    if (s.date().equals(d)) {
                        Instant start = d.atTime(s.start()).atZone(ZONE).toInstant();
                        double units = DemandCalculator.day(List.of(DemandCalculator.training(start, s.minutes(),
                            s.heavy(), null, null, s.label())), P, ZONE, d).units();
                        items.add(new DemandItem(s.label(), "training", start, start.plusSeconds(s.minutes() * 60L),
                            units, false, null, null));
                    }
                }
                double demand = r[0] * SCALE;
                double capacity = r[1] * SCALE;
                double ratioValue = demand / capacity;
                days.add(new CapacityDay(d, Verdicts.word(ratioValue, P), ratioValue, false, 20, 10, true,
                    new Demand(demand, 0, 0, 0, List.copyOf(items), new double[19]),
                    new Capacity(capacity, List.of()), "Sok megbeszélés"));
            }
            Set<LocalDate> rawGym = new HashSet<>();
            sessions.forEach(s -> rawGym.add(s.date()));
            Map<LocalDate, LocalTime> beds = new LinkedHashMap<>();
            for (int i = 0; i < 7; i++) {
                beds.put(MON.plusDays(i), bedtimes.getOrDefault(MON.plusDays(i), LocalTime.of(22, 30)));
            }
            return new WeekPicture(MON, today, ZONE, days, List.copyOf(sessions), List.copyOf(sport),
                List.copyOf(events), Set.copyOf(started), recovery,
                new WeekPicture.PlanFacts(rawGym, Set.copyOf(claimed), Set.of(), Set.of()),
                new WeekPicture.Sleep(450, beds));
        }
    }

    /** The spike's week (KapacitasDemo kapWeek): Thursday is túl sok, Saturday empty. */
    static Week spikeWeek() {
        return new Week()
            .day(0, 0.62, 0.82).day(1, 0.55, 0.78).day(2, 0.80, 0.80).day(3, 1.12, 0.70)
            .day(4, 0.72, 0.76).day(5, 0.30, 0.85).day(6, 0.48, 0.84)
            .gym(0, "17:30", "Felsőtest", false)
            .gym(3, "18:00", "Lábnap", true)
            .gym(4, "17:30", "Hát", false)
            .sport(1, "19:00", "röplabda")
            .sport(6, "10:00", "röplabda")
            .event(2, "Hívás", "20:00", "21:30");
    }

    // ── the brief's named tests ──────────────────────────────────────────────

    @Test
    void packedThursdayProposesMoveToEmptySaturday() {
        WeekPicture w = spikeWeek().build();

        List<ProposalDraft> drafts = ProposalGenerator.forWeek(w, List.of(), P);

        assertThat(drafts).isNotEmpty();
        ProposalDraft top = drafts.get(0);
        assertThat(top.kind()).isEqualTo("MOVE_SESSION_DAY");
        MoveSessionDay move = (MoveSessionDay) AdjustmentPayload.parse(top.bundle().get(0).kind(),
            top.bundle().get(0).payload());
        assertThat(move.fromDate()).isEqualTo(MON.plusDays(3));
        assertThat(move.toDate()).isEqualTo(MON.plusDays(5));
        assertThat(top.facts()).containsEntry("toEmptyCalendar", true).containsEntry("sessionTime", "18:00");
        DraftWeek.Result r = DraftWeek.apply(w, top.bundle(), P);
        assertThat(r.day(MON.plusDays(3)).orElseThrow().verdictAfter()).isEqualTo("szoros");
        assertThat(r.day(MON.plusDays(5)).orElseThrow().verdictAfter()).isEqualTo("rendben");
        // no second move lands on the same Saturday
        assertThat(drafts.stream().filter(d -> d.kind().equals("MOVE_SESSION_DAY"))).hasSize(1);
    }

    @Test
    void noProposalOnRendbenWeek() {
        Week week = new Week();
        for (int i = 0; i < 7; i++) {
            week.day(i, 0.6, 0.8); // 0.75 = rendben
        }
        week.gym(0, "17:30", "Felsőtest", false).gym(3, "18:00", "Lábnap", true);

        assertThat(ProposalGenerator.forWeek(week.build(), List.of(), P)).isEmpty();
    }

    @Test
    void lateCallBundlesBedtimeAndMorningShift() {
        WeekPicture w = new Week()
            .day(2, 0.80, 0.80) // Wednesday szoros
            .event(2, "Hívás", "19:00", "21:30")
            .gym(3, "06:45", "Séta", false)
            .event(3, "Első megbeszélés", "08:30", "09:00")
            .build();

        List<ProposalDraft> drafts = ProposalGenerator.forWeek(w, List.of(), P);

        ProposalDraft d = drafts.stream().filter(x -> x.kind().equals("SHIFT_BEDTIME")).findFirst().orElseThrow();
        assertThat(d.bundle()).hasSize(2);
        assertThat(AdjustmentPayload.parse(d.bundle().get(0).kind(), d.bundle().get(0).payload()))
            .isEqualTo(new ShiftBedtime(MON.plusDays(2), LocalTime.of(23, 0)));
        // 23:00 + 15 falling asleep + 7 h 30 need + 30 getting ready = 07:15
        assertThat(AdjustmentPayload.parse(d.bundle().get(1).kind(), d.bundle().get(1).payload()))
            .isEqualTo(new ShiftSessionTime(MON.plusDays(3), LocalTime.of(7, 15)));
        assertThat(d.facts()).containsEntry("eventEnd", "21:30").containsEntry("firstEventNext", "8:30");
    }

    @Test
    void lateCallWithNoRoomNextMorningProposesNothing() {
        WeekPicture w = new Week()
            .day(2, 0.80, 0.80)
            .event(2, "Hívás", "19:00", "21:30")
            .gym(3, "06:45", "Séta", false)
            .event(3, "Korai megbeszélés", "07:30", "08:00") // the shifted session would collide
            .build();

        assertThat(ProposalGenerator.forWeek(w, List.of(), P))
            .noneMatch(d -> d.kind().equals("SHIFT_BEDTIME"));
    }

    @Test
    void recoveryNeverAddsLoad() {
        Week week = spikeWeek();
        week.recovery = true;
        WeekPicture w = week.build();

        List<ProposalDraft> drafts = ProposalGenerator.forWeek(w, List.of(), P);

        assertThat(drafts).isNotEmpty().noneMatch(d -> d.kind().equals("MOVE_SESSION_DAY"));
        for (ProposalDraft d : drafts) {
            for (DraftWeek.DayLoad l : DraftWeek.apply(w, d.bundle(), P).days()) {
                assertThat(l.ratioAfter()).isLessThanOrEqualTo(l.ratioBefore());
            }
        }
    }

    @Test
    void atMostFive() {
        Week week = new Week();
        for (int i = 0; i < 7; i++) {
            week.day(i, 1.2, 0.7).gym(i, "17:30", "Edzés " + i, false)
                .meeting(i, "Blokk " + i, "13:00", "15:00");
        }
        WeekPicture w = week.build();

        List<ProposalDraft> drafts = ProposalGenerator.forWeek(w, List.of(), P);

        assertThat(drafts).hasSize(5);
        for (int i = 1; i < drafts.size(); i++) {
            assertThat(drafts.get(i - 1).relief()).isGreaterThanOrEqualTo(drafts.get(i).relief());
        }
    }

    /** mezo-r36n9.185: a week where every day is túl sok offers one skip, the rest of the sessions shorter. */
    @Test
    void atMostOneSkipAWeekTheOthersShorter() {
        Week week = new Week();
        for (int i = 0; i < 7; i++) {
            week.day(i, 1.4, 0.7).gym(i, "07:00", "Edzés " + i, false);
        }

        List<ProposalDraft> drafts = ProposalGenerator.forWeek(week.build(), List.of(), P);

        assertThat(drafts).isNotEmpty();
        assertThat(drafts.stream().filter(d -> d.kind().equals("SKIP_SESSION"))).hasSize(1);
        assertThat(drafts).anyMatch(d -> d.kind().equals("SHORTEN_SESSION"));
    }

    // ── the accept rules hold for every draft ────────────────────────────────

    @Test
    void neverTouchesAStartedDayOrARunningSession() {
        Week week = spikeWeek();
        week.today = MON.plusDays(4); // Friday: Thursday is past
        WeekPicture w = week.build();

        List<ProposalDraft> drafts = ProposalGenerator.forWeek(w, List.of(), P);

        assertThat(drafts).allSatisfy(d -> assertThat(d.touchedDays()).allMatch(x -> !x.isBefore(MON.plusDays(4))));

        Week running = spikeWeek();
        running.sessions.replaceAll(s -> s.date().equals(MON.plusDays(3))
            ? new PlannedSession(s.templateId(), s.date(), s.start(), s.minutes(), s.label(), false, true, s.heavy())
            : s);
        assertThat(ProposalGenerator.forWeek(running.build(), List.of(), P))
            .noneMatch(d -> d.touchedDays().contains(MON.plusDays(3)) && d.kind().contains("SESSION"));
    }

    @Test
    void aDayClaimedByAnAcceptedMoveIsNotATarget() {
        Week week = spikeWeek();
        week.claimed.add(MON.plusDays(5)); // Saturday already receives a moved session
        List<ProposalDraft> drafts = ProposalGenerator.forWeek(week.build(), List.of(), P);

        assertThat(drafts).noneMatch(d -> d.kind().equals("MOVE_SESSION_DAY")
            && d.touchedDays().contains(MON.plusDays(5)));
        // Thursday is still relieved: the next valid way, not a draft the accept would refuse
        assertThat(drafts).anyMatch(d -> d.touchedDays().contains(MON.plusDays(3)) && d.kind().contains("SESSION"));
    }

    @Test
    void shortMeetingRightBeforeASessionBecomesACalendarTodo() {
        WeekPicture w = new Week()
            .day(4, 0.72, 0.76)
            .gym(4, "17:30", "Hát", false)
            .meeting(4, "Sprint review", "16:30", "17:15")
            .build();

        ProposalDraft d = ProposalGenerator.forWeek(w, List.of(), P).stream()
            .filter(x -> x.kind().equals("CALENDAR_TODO")).findFirst().orElseThrow();
        assertThat(d.facts()).containsEntry("toStart", "15:30").containsEntry("toEnd", "16:15")
            .containsEntry("gapAfterMin", 75L);
    }

    @Test
    void afternoonBlockOnAnOverloadedDayMovesEnergyToLunch() {
        WeekPicture w = new Week()
            .day(3, 1.12, 0.70)
            .meeting(3, "A", "13:00", "14:00").meeting(3, "B", "14:00", "15:30")
            .build();

        ProposalDraft d = ProposalGenerator.forWeek(w, List.of(), P).stream()
            .filter(x -> x.kind().equals("MOVE_MEAL_ENERGY")).findFirst().orElseThrow();
        assertThat(d.bundle().get(0).payload().get("slotKcal")).isEqualTo(Map.of("lunch", 200, "dinner", -200));
        assertThat(d.facts()).containsEntry("blockStart", "13:00").containsEntry("blockEnd", "15:30");
    }

    @Test
    void aMatchingPatternLiftsTheRankAndLendsItsLine() {
        WeekPicture w = spikeWeek().build();
        var pattern = new ProposalGenerator.Pattern("weekday_overload", 3, 2,
            Map.of("weekday", "THURSDAY", "line", "Az utóbbi 3 csütörtökből 2-n elmaradt az esti edzés."));

        ProposalDraft plain = ProposalGenerator.forWeek(w, List.of(), P).get(0);
        ProposalDraft lifted = ProposalGenerator.forWeek(w, List.of(pattern), P).get(0);

        assertThat(lifted.relief()).isGreaterThan(plain.relief());
        assertThat(lifted.facts().get("patternLines")).asList().hasSize(1);
    }

    // ── fix round 1 ──────────────────────────────────────────────────────────

    @Test
    void aMoveNeedsTheSessionHourFreeOnTheTargetDay() {
        // Saturday has a timed event across the 18:00 session (± 30 min getting ready): not a target
        WeekPicture blocked = spikeWeek().event(5, "Szülinap", "17:45", "19:00").build();
        assertThat(ProposalGenerator.forWeek(blocked, List.of(), P))
            .noneMatch(d -> d.kind().equals("MOVE_SESSION_DAY") && d.touchedDays().contains(MON.plusDays(5)));

        // an event that ends 20 minutes before the session is still inside the getting-ready margin
        WeekPicture tight = spikeWeek().event(5, "Ebéd", "16:30", "17:40").build();
        assertThat(ProposalGenerator.forWeek(tight, List.of(), P))
            .noneMatch(d -> d.kind().equals("MOVE_SESSION_DAY") && d.touchedDays().contains(MON.plusDays(5)));

        // a morning event far from it leaves Saturday a fine target
        WeekPicture free = spikeWeek().event(5, "Piac", "09:00", "10:00").build();
        assertThat(ProposalGenerator.forWeek(free, List.of(), P))
            .anyMatch(d -> d.kind().equals("MOVE_SESSION_DAY") && d.touchedDays().contains(MON.plusDays(5)));
    }

    @Test
    void aMoveNeverLandsOnASportSlotHour() {
        Week week = spikeWeek().sport(5, "18:30", "röplabda");
        assertThat(ProposalGenerator.forWeek(week.build(), List.of(), P))
            .noneMatch(d -> d.kind().equals("MOVE_SESSION_DAY") && d.touchedDays().contains(MON.plusDays(5)));
    }

    @Test
    void draftsOnTheSameSessionNeverStandSideBySide() {
        // Thursday's early session could be moved to Saturday, started later after Wednesday's late call, or have
        // the meeting before it moved — all three would undo each other; only the strongest stays.
        Week week = new Week()
            .day(2, 0.80, 0.80).day(3, 1.12, 0.70)
            .event(2, "Hívás", "19:00", "21:30")
            .gym(3, "06:45", "Lábnap", true)
            .event(3, "Első megbeszélés", "08:30", "09:00");
        List<ProposalDraft> drafts = ProposalGenerator.forWeek(week.build(), List.of(), P);

        List<LocalDate> sessionDays = drafts.stream().map(ProposalGenerator::sessionDay)
            .flatMap(java.util.Optional::stream).toList();
        assertThat(sessionDays).doesNotHaveDuplicates().contains(MON.plusDays(3));
        assertThat(drafts.stream().map(ProposalDraft::touchedDays).toList()).doesNotHaveDuplicates();
        assertThat(drafts.get(0).kind()).isEqualTo("MOVE_SESSION_DAY"); // the higher relief wins
    }

    @Test
    void aVeryLongSessionShortensWithinThePayloadBound() {
        Week week = new Week();
        for (int i = 0; i < 7; i++) {
            week.day(i, 1.0, 0.9);
        }
        week.recovery = true; // no move: the shorten path
        week.gym(3, "08:00", "Túra", false, 400);

        List<ProposalDraft> drafts = ProposalGenerator.forWeek(week.build(), List.of(), P);

        ProposalDraft d = drafts.stream().filter(x -> x.kind().equals("SHORTEN_SESSION")).findFirst().orElseThrow();
        assertThat(((Number) d.bundle().get(0).payload().get("minutes")).intValue()).isEqualTo(240);
    }

    // ── K4: the season's advisory lighter-week card (decision #121) ──────────────────────────────────────

    private static SeasonLoadModel.WeekOut wk(int n, boolean planned, boolean over) {
        return new SeasonLoadModel.WeekOut(n, planned ? null : 100.0, planned ? null : 80.0, planned, over, false);
    }

    @Test
    void threeOverWeeksProposeDeloadForward() {
        // weeks 1-3 done and all over, now week 4, lighter week planned for week 7 of 8
        List<SeasonLoadModel.WeekOut> weeks = List.of(wk(1, false, true), wk(2, false, true), wk(3, false, true),
            wk(4, true, false), wk(5, true, false), wk(6, true, false), wk(7, true, false), wk(8, true, false));
        var hint = ProposalGenerator.deloadForward(weeks, 4, List.of(7)).orElseThrow();
        assertThat(hint.fromWeek()).isEqualTo(7);
        assertThat(hint.toWeek()).isEqualTo(5);
        assertThat(hint.body()).contains("7.").contains("5.");

        // not three over in a row → quiet
        List<SeasonLoadModel.WeekOut> mixed = List.of(wk(1, false, true), wk(2, false, false), wk(3, false, true),
            wk(4, true, false), wk(5, true, false), wk(6, true, false), wk(7, true, false), wk(8, true, false));
        assertThat(ProposalGenerator.deloadForward(mixed, 4, List.of(7))).isEmpty();
        // next week already the lighter one → quiet
        assertThat(ProposalGenerator.deloadForward(weeks, 4, List.of(5))).isEmpty();
        // no lighter week ahead → quiet
        assertThat(ProposalGenerator.deloadForward(weeks, 4, List.of(2))).isEmpty();
        // the season ends this week → quiet
        assertThat(ProposalGenerator.deloadForward(weeks.subList(0, 4), 4, List.of(7))).isEmpty();
    }
}
