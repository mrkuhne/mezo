package io.mrkuhne.mezo.feature.capacity.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;

class CapacityContextRendererTest {

    private final CapacityContextRenderer renderer = new CapacityContextRenderer();

    private static CapacityDay day(LocalDate d, String verdict, boolean tanulo, boolean calendarKnown, String reason) {
        return new CapacityDay(d, verdict, 0.95, tanulo, 20, 6, calendarKnown, null, null, reason);
    }

    @Test
    void rendersVerdictAndReason() {
        CapacityDay d = day(LocalDate.of(2026, 11, 23), "szoros", true, true, "rövid éjszaka · 4 megbeszélés délelőtt");

        assertThat(renderer.today(d))
            .isEqualTo("[Kapacitás] ma: szoros (rövid éjszaka · 4 megbeszélés délelőtt) · tanuló");
        assertThat(renderer.today(day(LocalDate.of(2026, 11, 23), "laza", false, true, "")))
            .isEqualTo("[Kapacitás] ma: laza");
    }

    @Test
    void saysWhenTheCalendarIsMissing() {
        assertThat(renderer.today(day(LocalDate.of(2026, 11, 23), "rendben", false, false, "")))
            .isEqualTo("[Kapacitás] ma: rendben · naptár nélkül");
    }

    @Test
    void emptyWithoutData() {
        assertThat(renderer.today(null)).isEmpty();
        assertThat(renderer.week(null)).isEmpty();
        assertThat(renderer.week(List.of())).isEmpty();
    }

    @Test
    void weekIsOneLinePerDayMondayFirst() {
        String out = renderer.week(List.of(
            day(LocalDate.of(2026, 11, 23), "szoros", false, true, "edzés a napban"),
            day(LocalDate.of(2026, 11, 24), "laza", false, true, "")));

        assertThat(out.lines().toList()).containsExactly(
            "[Kapacitás] hétfő (11-23): szoros (edzés a napban)", "[Kapacitás] kedd (11-24): laza");
    }
}
