package io.mrkuhne.mezo.feature.companion.quarterly.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import org.junit.jupiter.api.Test;

/** Pure calendar arithmetic (W5.3, mezo-b3pp.20) — the GraphEdgeLineRendererTest idiom. */
class QuartersTest {

    @Test
    void testStartOf_shouldReturnFirstDayOfQuarter_whenAnyDayGiven() {
        assertThat(Quarters.startOf(LocalDate.of(2026, 8, 26))).isEqualTo(LocalDate.of(2026, 7, 1));
        assertThat(Quarters.startOf(LocalDate.of(2026, 1, 1))).isEqualTo(LocalDate.of(2026, 1, 1));
        assertThat(Quarters.startOf(LocalDate.of(2026, 12, 31))).isEqualTo(LocalDate.of(2026, 10, 1));
    }

    @Test
    void testPrevious_shouldCrossTheYearBoundary_whenQ1Given() {
        assertThat(Quarters.previous(LocalDate.of(2026, 1, 1))).isEqualTo(LocalDate.of(2025, 10, 1));
        assertThat(Quarters.previous(LocalDate.of(2026, 7, 1))).isEqualTo(LocalDate.of(2026, 4, 1));
    }

    @Test
    void testEndOf_shouldReturnInclusiveLastDay_whenQuarterStartGiven() {
        assertThat(Quarters.endOf(LocalDate.of(2026, 7, 1))).isEqualTo(LocalDate.of(2026, 9, 30));
        assertThat(Quarters.endOf(LocalDate.of(2026, 1, 1))).isEqualTo(LocalDate.of(2026, 3, 31));
    }

    @Test
    void testLabel_shouldRenderIsoQuarter_whenQuarterStartGiven() {
        assertThat(Quarters.label(LocalDate.of(2026, 7, 1))).isEqualTo("2026-Q3");
        assertThat(Quarters.label(LocalDate.of(2025, 10, 1))).isEqualTo("2025-Q4");
    }

    @Test
    void testParse_shouldAcceptQuarterAndMonth_whenWellFormed() {
        assertThat(Quarters.parse("2026-Q3")).isEqualTo(LocalDate.of(2026, 7, 1));
        assertThat(Quarters.parse("2026-q3")).isEqualTo(LocalDate.of(2026, 7, 1));
        assertThat(Quarters.parse(" 2026-07 ")).isEqualTo(LocalDate.of(2026, 7, 1));
    }

    @Test
    void testParse_shouldReturnNull_whenUnparseable() {
        assertThat(Quarters.parse(null)).isNull();
        assertThat(Quarters.parse("")).isNull();
        assertThat(Quarters.parse("tavaly nyar")).isNull();
        assertThat(Quarters.parse("2026-Q5")).isNull();
        assertThat(Quarters.parse("2026-13")).isNull();
    }

    @Test
    void testIsQuarter_shouldDistinguishQuarterFromMonth_whenParsed() {
        assertThat(Quarters.isQuarter("2026-Q3")).isTrue();
        assertThat(Quarters.isQuarter("2026-07")).isFalse();
    }
}
