package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.train.service.SessionTimingCalculator;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;

/** Pure decision logic — plain unit test, no Spring (precedent: ProgressionDeciderTest). */
class SessionTimingCalculatorTest {

    private static final Instant T = Instant.parse("2026-09-02T17:00:00Z");
    private static final int GAP_CAP = 300;
    private static final int LEAD_CAP = 900;

    @Test
    void testActiveSeconds_shouldReturnNull_whenNoSetsWereLogged() {
        assertThat(SessionTimingCalculator.activeSeconds(T, List.of(), GAP_CAP, LEAD_CAP)).isNull();
    }

    @Test
    void testActiveSeconds_shouldSumIntervals_whenAllGapsAreUnderTheCap() {
        List<Instant> done = List.of(T.plusSeconds(120), T.plusSeconds(300), T.plusSeconds(500));
        // lead-in 120 + 180 + 200
        assertThat(SessionTimingCalculator.activeSeconds(T, done, GAP_CAP, LEAD_CAP)).isEqualTo(500);
    }

    @Test
    void testActiveSeconds_shouldClipTheInterval_whenAGapExceedsTheCap() {
        List<Instant> done = List.of(T.plusSeconds(60), T.plusSeconds(1260));
        // lead-in 60 + min(1200, 300)
        assertThat(SessionTimingCalculator.activeSeconds(T, done, GAP_CAP, LEAD_CAP)).isEqualTo(360);
    }

    @Test
    void testActiveSeconds_shouldClipTheLeadIn_whenTheFirstSetIsFarFromTheStart() {
        List<Instant> done = List.of(T.plusSeconds(5000), T.plusSeconds(5100));
        assertThat(SessionTimingCalculator.activeSeconds(T, done, GAP_CAP, LEAD_CAP)).isEqualTo(1000);
    }

    @Test
    void testActiveSeconds_shouldCountOnlyTheLeadIn_whenExactlyOneSetWasLogged() {
        assertThat(SessionTimingCalculator.activeSeconds(T, List.of(T.plusSeconds(200)), GAP_CAP, LEAD_CAP))
            .isEqualTo(200);
    }

    @Test
    void testActiveSeconds_shouldSkipTheLeadIn_whenStartedAtIsNull() {
        List<Instant> done = List.of(T.plusSeconds(120), T.plusSeconds(300));
        assertThat(SessionTimingCalculator.activeSeconds(null, done, GAP_CAP, LEAD_CAP)).isEqualTo(180);
    }

    @Test
    void testActiveSeconds_shouldSortInput_whenTimestampsArriveOutOfOrder() {
        List<Instant> done = List.of(T.plusSeconds(300), T.plusSeconds(120));
        assertThat(SessionTimingCalculator.activeSeconds(T, done, GAP_CAP, LEAD_CAP)).isEqualTo(300);
    }
}
