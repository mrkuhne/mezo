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
 *
 * <p><b>It proved the wrong bound once (mezo-wsnu).</b> Walking all 86400 inputs is worthless if
 * the bound walked against is too wide: this test asserted {@code ±18h} — {@code ZoneOffset}'s
 * limit — while the offsets actually reach PostgreSQL {@code timestamptz} columns, which reject
 * anything past {@code ±15:59:59}. Every input in the {@code (57599, 64200]} band passed here and
 * failed the INSERT, reddening main for ~1h50m every day. Both assertions now read the bound from
 * {@link JournalMidnightCrossingIT#MAX_OFFSET_SECONDS}, and
 * {@link #testMaxOffsetSeconds_shouldNotExceedThePostgresDisplacementLimit()} pins that constant
 * to the database's limit — so widening it cannot quietly re-green this proof.
 */
class JournalMidnightCrossingOffsetArithmeticTest {


    /**
     * PostgreSQL accepts a time zone displacement of at most {@code ±15:59:59} (it stores the
     * offset in a bounded field); anything wider fails the INSERT with
     * {@code ERROR: time zone displacement out of range}. Java's {@code ZoneOffset} allows ±18h, so
     * the JVM is NOT the binding constraint and must not be used as the bound.
     */
    private static final int POSTGRES_MAX_DISPLACEMENT_SECONDS = 15 * 3600 + 59 * 60 + 59;

    @Test
    void testMaxOffsetSeconds_shouldNotExceedThePostgresDisplacementLimit() {
        assertThat(JournalMidnightCrossingIT.MAX_OFFSET_SECONDS)
            .as("the wrap bound must stay within what PostgreSQL will store, not merely what "
                + "ZoneOffset will construct — widening it re-opens mezo-wsnu")
            .isLessThanOrEqualTo(POSTGRES_MAX_DISPLACEMENT_SECONDS);
    }

    @Test
    void testComputeParkedOffset_shouldKeepBothOffsetsInRangeWithNoWrapOnTheShift_forEveryUtcSecondOfDay() {
        for (int utcNowSecondOfDay = 0; utcNowSecondOfDay < 86400; utcNowSecondOfDay++) {
            int parked = JournalMidnightCrossingIT.computeParkedOffset(utcNowSecondOfDay);
            int shifted = parked + JournalMidnightCrossingIT.CROSSING_SHIFT_SECONDS;

            assertThat(parked).as("parked offset for utcNowSecondOfDay=%d", utcNowSecondOfDay)
                .isBetween(-JournalMidnightCrossingIT.MAX_OFFSET_SECONDS,
                    JournalMidnightCrossingIT.MAX_OFFSET_SECONDS);
            // in range ⇒ ZoneOffset.ofTotalSeconds(shifted) needs no further ±86400 wrap at all,
            // which is the actual invariant: the shift never gets cancelled by a day-wrap
            assertThat(shifted).as("shifted offset for utcNowSecondOfDay=%d must stay in range with no wrap",
                    utcNowSecondOfDay)
                .isBetween(-JournalMidnightCrossingIT.MAX_OFFSET_SECONDS,
                    JournalMidnightCrossingIT.MAX_OFFSET_SECONDS);
        }
    }
}
