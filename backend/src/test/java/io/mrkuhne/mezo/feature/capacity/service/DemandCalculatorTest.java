package io.mrkuhne.mezo.feature.capacity.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import io.mrkuhne.mezo.feature.capacity.config.CapacityProperties;
import io.mrkuhne.mezo.feature.capacity.service.DemandCalculator.TimedDemand;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

class DemandCalculatorTest {

    private static final CapacityProperties P = new CapacityProperties(true, new CapacityProperties.Verdict(0.6, 0.9, 1.0),
            1.25, 1.3, 90, 15, new CapacityProperties.Learning(14, 5), null, null, null, 2000, 6.0);
    private static final Instant NINE = Instant.parse("2026-11-23T09:00:00Z");

    private static TimedDemand meeting(int startMin, int durMin) {
        Instant s = NINE.plusSeconds(startMin * 60L);
        return new TimedDemand(s, s.plusSeconds(durMin * 60L), 2, 2, 0, false, "m", "meeting");
    }

    @Test
    void fourBackToBackMeetingsCostMoreThanSpread() {
        List<TimedDemand> b2b = new ArrayList<>();
        List<TimedDemand> spread = new ArrayList<>();
        for (int i = 0; i < 4; i++) {
            b2b.add(meeting(i * 60, 60));
            spread.add(meeting(i * 75, 60));
        }
        assertThat(DemandCalculator.day(b2b, P).units()).isGreaterThan(DemandCalculator.day(spread, P).units());
        // 4 h x 4/3 x 1.3 = 6.93 ; spread: 4 x 1.333 x (no run >= 90) - 3 x 0.1
        assertThat(DemandCalculator.day(b2b, P).units()).isCloseTo(4 * 4.0 / 3 * 1.3, within(1e-9));
        assertThat(DemandCalculator.day(spread, P).units()).isCloseTo(4 * 4.0 / 3 - 0.3, within(1e-9));
    }

    @Test
    void restoringItemSubtractsHalfAndDayNeverNegative() {
        TimedDemand walk = new TimedDemand(NINE, NINE.plusSeconds(3600), 3, 3, 3, true, "walk", "focus");
        assertThat(DemandCalculator.day(List.of(walk), P).units()).isEqualTo(0.0);
        TimedDemand work = new TimedDemand(NINE.plusSeconds(7200), NINE.plusSeconds(10800), 3, 3, 3, false, "w", "focus");
        assertThat(DemandCalculator.day(List.of(walk, work), P).units()).isCloseTo(1.5, within(1e-9));
    }

    @Test
    void hourlyBucketsStartAtSix() {
        TimedDemand t = new TimedDemand(NINE, NINE.plusSeconds(3600), 3, 0, 0, false, "x", "focus");
        double[] h = DemandCalculator.day(List.of(t), P).hourly19();
        assertThat(h).hasSize(19);
        assertThat(h[3]).isCloseTo(1.0 / 1, within(1e-9));
    }

    @Test
    void trainingPlannedAndLogged() {
        TimedDemand planned = DemandCalculator.training(NINE, 60, false, null, null, "Gym");
        assertThat(planned.physical()).isEqualTo(2);
        assertThat(DemandCalculator.training(NINE, 60, true, null, null, "Gym").physical()).isEqualTo(3);
        TimedDemand logged = DemandCalculator.training(NINE, 60, false, 8, 45, "Gym");
        assertThat(logged.physical()).isEqualTo(3);
        assertThat(logged.end()).isEqualTo(NINE.plusSeconds(45 * 60));
        assertThat(DemandCalculator.training(NINE, 60, true, 6, null, "Gym").physical()).isEqualTo(2);
    }

    @Test
    void trainingNeverBreaksAMeetingRun() {
        List<TimedDemand> items = List.of(meeting(0, 60), meeting(60, 60),
                DemandCalculator.training(NINE.plusSeconds(1800), 30, false, null, null, "Gym"));
        var d = DemandCalculator.day(items, P);
        double meetings = d.items().stream().filter(i -> i.kind().equals("meeting"))
                .mapToDouble(DemandCalculator.DemandItem::units).sum();
        assertThat(meetings).isCloseTo(2 * 4.0 / 3 * 1.3, within(1e-9));
    }

    private static final ZoneId BUD = ZoneId.of("Europe/Budapest");

    private static Instant local(LocalDate d, int hour) {
        return d.atTime(hour, 0).atZone(BUD).toInstant();
    }

    @Test
    void eventCrossingMidnightCountsOnlyTheHoursOfTheDay() {
        LocalDate d = LocalDate.of(2026, 11, 23);
        TimedDemand late = new TimedDemand(local(d, 22), local(d.plusDays(1), 2), 3, 0, 0, false, "x", "focus");

        var first = DemandCalculator.day(List.of(late), P, BUD, d);
        var next = DemandCalculator.day(List.of(late), P, BUD, d.plusDays(1));

        assertThat(first.units()).isCloseTo(2.0, within(1e-9));       // 22:00-24:00, mental 3 = 1 unit an hour
        assertThat(first.hourly19()[16] + first.hourly19()[17]).isCloseTo(2.0, within(1e-9));
        assertThat(next.units()).isCloseTo(2.0, within(1e-9));        // 00:00-02:00
        assertThat(java.util.Arrays.stream(next.hourly19()).sum()).isZero(); // before 06:00: no hourly slot
        assertThat(next.items()).singleElement().satisfies(i -> {
            assertThat(i.start()).isEqualTo(local(d.plusDays(1), 0));
            assertThat(i.end()).isEqualTo(local(d.plusDays(1), 2));
        });
    }

    @Test
    void threeDayTimedEventCountsAtMostOneDayOnEachDay() {
        LocalDate d = LocalDate.of(2026, 11, 23);
        TimedDemand conf = new TimedDemand(local(d, 9), local(d.plusDays(2), 18), 3, 0, 0, false, "x", "focus");

        assertThat(DemandCalculator.day(List.of(conf), P, BUD, d).units()).isCloseTo(15.0, within(1e-9));
        assertThat(DemandCalculator.day(List.of(conf), P, BUD, d.plusDays(1)).units()).isCloseTo(24.0, within(1e-9));
        assertThat(DemandCalculator.day(List.of(conf), P, BUD, d.plusDays(2)).units()).isCloseTo(18.0, within(1e-9));
        assertThat(DemandCalculator.day(List.of(conf), P, BUD, d.plusDays(3)).items()).isEmpty();
    }

    @Test
    void overlappingMeetingsCountTheirUnionForTheRun() {
        // 09:00-10:00 and 09:15-10:00: 105 summed minutes but 60 of his time — no 90-minute run, no factor
        var d = DemandCalculator.day(List.of(meeting(0, 60), meeting(15, 45)), P);
        assertThat(d.units()).isCloseTo((60 + 45) / 60.0 * 4.0 / 3, within(1e-9));
    }

    @Test
    void aMeetingInsideALongerOneOpensNoGap() {
        // A 09:00-10:30, B 09:15-09:30 inside A, C 10:30-11:00: one unbroken 120-minute run, no gap credit
        var d = DemandCalculator.day(List.of(meeting(0, 90), meeting(15, 15), meeting(90, 30)), P);
        assertThat(d.units()).isCloseTo((90 + 15 + 30) / 60.0 * 4.0 / 3 * 1.3, within(1e-9));
    }
}
