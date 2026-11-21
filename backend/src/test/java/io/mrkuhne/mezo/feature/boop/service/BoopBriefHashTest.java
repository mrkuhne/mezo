package io.mrkuhne.mezo.feature.boop.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.boop.port.BoopCapacityPort;
import java.time.LocalTime;
import java.util.List;
import org.junit.jupiter.api.Test;

/** Boop B7 K1 final fix (mezo-r36n9.17): what of the capacity block re-generates the brief. */
class BoopBriefHashTest {

    private static final LocalTime MORNING = LocalTime.of(8, 30);

    private static BoopCapacityPort.View view(double ratio, List<BoopCapacityPort.Factor> factors) {
        return new BoopCapacityPort.View("rendben", ratio, true, 0, true, 4.0, new double[19], List.of(), factors, "");
    }

    private static String hash(BoopCapacityPort.View v) {
        return BoopBriefService.inputHash(BoopBriefFixtures.day(null, null, List.of()), MORNING, v);
    }

    @Test
    void ratioChangesTheHashInFivePercentSteps() {
        List<BoopCapacityPort.Factor> none = List.of();
        assertThat(hash(view(0.80, none))).isNotEqualTo(hash(view(0.86, none)));
        assertThat(hash(view(0.80, none))).isEqualTo(hash(view(0.81, none)));
    }

    @Test
    void factorKeysAndEffectsChangeTheHash() {
        var sleepBad = new BoopCapacityPort.Factor("sleep", "Alvás", "6 ó", "rossz");
        var sleepOk = new BoopCapacityPort.Factor("sleep", "Alvás", "6 ó", "semleges");
        var hrvBad = new BoopCapacityPort.Factor("hrv", "HRV", "40 ms", "rossz");
        assertThat(hash(view(0.8, List.of(sleepBad)))).isNotEqualTo(hash(view(0.8, List.of(sleepOk))));
        assertThat(hash(view(0.8, List.of(sleepBad)))).isNotEqualTo(hash(view(0.8, List.of(hrvBad))));
        assertThat(hash(view(0.8, List.of(sleepBad)))).isNotEqualTo(hash(view(0.8, List.of())));
    }

    @Test
    void anEventLabelChangesTheHashEvenWhenUnitsRoundTheSame() {
        var drains = new BoopCapacityPort.Item("Tervezés", "meeting", java.time.Instant.parse("2026-11-23T08:00:00Z"),
            "kozepes", "cal-1");
        var feeds = new BoopCapacityPort.Item("Tervezés", "meeting", java.time.Instant.parse("2026-11-23T08:00:00Z"),
            "tolt", "cal-1");
        var a = new BoopCapacityPort.View("rendben", 0.8, true, 0, true, 4.0, new double[19], List.of(drains),
            List.of(), "");
        var b = new BoopCapacityPort.View("rendben", 0.8, true, 0, true, 4.0, new double[19], List.of(feeds),
            List.of(), "");
        assertThat(hash(a)).isNotEqualTo(hash(b));
    }
}
