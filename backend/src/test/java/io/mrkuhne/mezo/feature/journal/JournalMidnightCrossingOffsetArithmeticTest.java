package io.mrkuhne.mezo.feature.journal;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

/**
 * Exhaustive proof for the offset arithmetic that {@link JournalMidnightCrossingIT} relies on to
 * force a midnight crossing without a {@code Clock} bean (spec §5). Fix round 2 was rejected for
 * being proven on a single boundary case only; this walks all 86400 possible UTC seconds-of-day —
 * not a sample — so the invariant is checked for every real input, not just the one the wall clock
 * happened to show when someone ran the IT.
 *
 * <p>Kept as a real (fast, no-Spring, no-Testcontainers) unit test rather than a throwaway probe:
 * the arithmetic is a small pure function extracted specifically so it can be driven this way, the
 * loop costs microseconds, and a future edit to {@code CROSSING_SHIFT_SECONDS} or the wrap
 * threshold re-runs this proof on every build instead of only when someone remembers to.
 */
class JournalMidnightCrossingOffsetArithmeticTest {

    @Test
    void testComputeParkedOffset_shouldKeepBothOffsetsInRangeWithNoWrapOnTheShift_forEveryUtcSecondOfDay() {
        for (int utcNowSecondOfDay = 0; utcNowSecondOfDay < 86400; utcNowSecondOfDay++) {
            int parked = JournalMidnightCrossingIT.computeParkedOffset(utcNowSecondOfDay);
            int shifted = parked + JournalMidnightCrossingIT.CROSSING_SHIFT_SECONDS;

            assertThat(parked).as("parked offset for utcNowSecondOfDay=%d", utcNowSecondOfDay)
                .isBetween(-JournalMidnightCrossingIT.MAX_OFFSET_SECONDS, JournalMidnightCrossingIT.MAX_OFFSET_SECONDS);
            // in range ⇒ ZoneOffset.ofTotalSeconds(shifted) needs no further ±86400 wrap at all,
            // which is the actual invariant: the shift never gets cancelled by a day-wrap
            assertThat(shifted).as("shifted offset for utcNowSecondOfDay=%d must stay in range with no wrap",
                    utcNowSecondOfDay)
                .isBetween(-JournalMidnightCrossingIT.MAX_OFFSET_SECONDS, JournalMidnightCrossingIT.MAX_OFFSET_SECONDS);
        }
    }
}
