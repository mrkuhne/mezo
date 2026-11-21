package io.mrkuhne.mezo.feature.capacity.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import io.mrkuhne.mezo.feature.capacity.config.CapacityProperties;
import io.mrkuhne.mezo.feature.capacity.service.DemandCalculator.TimedDemand;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

class DemandCalculatorTest {

    private static final CapacityProperties P = new CapacityProperties(true, new CapacityProperties.Verdict(0.6, 0.9, 1.0),
            1.25, 1.3, 90, 15, new CapacityProperties.Learning(14, 5), null, null, null, 2000);
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
}
