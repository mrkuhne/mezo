package io.mrkuhne.mezo.feature.penz.service.practice;

import io.mrkuhne.mezo.feature.penz.service.PenzErrors;
import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * The arithmetic of one paper trade (Boop Pénz L7, mezo-r36n9.105, build notes call 4). Every price is minor units
 * of the instrument's own currency per unit; {@code quantity} is units. Risk = |entry − stop| × qty; P/L long =
 * (exit − entry) × qty, short = (entry − exit) × qty; R = P/L ÷ risk (the quantity cancels, so R is computed
 * from the prices exactly), 2 decimals HALF_UP. A long needs its stop below the entry, a short above it.
 */
public final class PaperTradeMath {

    public static final int R_SCALE = 2;

    private PaperTradeMath() {
    }

    /** long | short. */
    public enum Direction {
        LONG, SHORT;

        public String wire() {
            return name().toLowerCase(java.util.Locale.ROOT);
        }

        public static Direction of(String wire) {
            if ("long".equals(wire)) {
                return LONG;
            }
            if ("short".equals(wire)) {
                return SHORT;
            }
            throw PenzErrors.field("direction");
        }
    }

    /** The stop is on the losing side of the entry (risk &gt; 0). */
    public static boolean validStop(Direction d, long entryMinor, long stopMinor) {
        return d == Direction.LONG ? stopMinor < entryMinor : stopMinor > entryMinor;
    }

    /** |entry − stop| × qty, HALF_UP to a whole minor unit. */
    public static long riskMinor(long entryMinor, long stopMinor, BigDecimal quantity) {
        return times(Math.abs(entryMinor - stopMinor), quantity);
    }

    /** entry × qty, HALF_UP to a whole minor unit. */
    public static long costMinor(long entryMinor, BigDecimal quantity) {
        return times(entryMinor, quantity);
    }

    /** Signed P/L by direction, HALF_UP to a whole minor unit. */
    public static long pnlMinor(Direction d, long entryMinor, long exitMinor, BigDecimal quantity) {
        return times(move(d, entryMinor, exitMinor), quantity);
    }

    /** P/L ÷ risk, 2 decimals HALF_UP; null when the stop sits on the entry (no risk). */
    public static BigDecimal rMultiple(Direction d, long entryMinor, long stopMinor, long exitMinor) {
        long risk = Math.abs(entryMinor - stopMinor);
        if (risk == 0) {
            return null;
        }
        return BigDecimal.valueOf(move(d, entryMinor, exitMinor))
            .divide(BigDecimal.valueOf(risk), R_SCALE, RoundingMode.HALF_UP);
    }

    /** False only when the exit went beyond the stop (the loss grew past the plan). */
    public static boolean stopRespected(Direction d, long stopMinor, long exitMinor) {
        return d == Direction.LONG ? exitMinor >= stopMinor : exitMinor <= stopMinor;
    }

    private static long move(Direction d, long entryMinor, long exitMinor) {
        return d == Direction.LONG ? exitMinor - entryMinor : entryMinor - exitMinor;
    }

    private static long times(long perUnitMinor, BigDecimal quantity) {
        try {
            return BigDecimal.valueOf(perUnitMinor).multiply(quantity).setScale(0, RoundingMode.HALF_UP)
                .longValueExact();
        } catch (ArithmeticException overflow) {
            throw PenzErrors.field("quantity");
        }
    }
}
