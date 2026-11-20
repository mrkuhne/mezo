package io.mrkuhne.mezo.feature.penz.service.proposal;

import io.mrkuhne.mezo.feature.penz.service.PenzErrors;
import io.mrkuhne.mezo.feature.penz.service.portfolio.Sleeve;
import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * The proposal split (Boop Pénz L7, mezo-r36n9.105, build notes call 11) — pure. Every rule is printed in "miért?"
 * ({@link ProposalFallbackCopy#rules}); the owner adjusts every number before accepting.
 *
 * <ol>
 *   <li>Emergency target = {@code emergencyMonths × fixedCosts} (the allowance engine's {@code fixedCosts} line of
 *       the current month; no or non-positive fixed costs → no target).</li>
 *   <li>The short sleeve (1–3 év) gets {@code min(A, max(0, target − shortValue))}.</li>
 *   <li>The remainder: {@value #MID_PCT} % mid (5–10 év), the rest long (10+ év).</li>
 *   <li>Short and mid round DOWN to 1 000 Ft; every rounding rest lands in long, so the three always sum to A.</li>
 * </ol>
 */
public final class ProposalSplitter {

    public static final int MID_PCT = 40;
    public static final int LONG_PCT = 60;
    /** 1 000 Ft. */
    public static final long ROUND_TO_MINOR = 100_000L;

    private ProposalSplitter() {
    }

    /**
     * @param amountMinor          A, the amount to split (HUF minor, > 0)
     * @param emergencyTargetMinor months × fixed costs, 0 when unknown
     * @param shortValueMinor      what the short sleeve holds now
     * @param shortfallMinor       max(0, target − shortValue)
     */
    public record Split(long amountMinor, int emergencyMonths, Long fixedCostsMinor, long emergencyTargetMinor,
                        long shortValueMinor, long shortfallMinor, long shortMinor, long midMinor, long longMinor) {

        public long amount(Sleeve s) {
            return switch (s) {
                case SHORT -> shortMinor;
                case MID -> midMinor;
                case LONG -> longMinor;
            };
        }

        /** The sleeve's share of A, percent, one decimal (HALF_UP). */
        public BigDecimal sharePct(Sleeve s) {
            if (amountMinor <= 0) {
                return BigDecimal.ZERO.setScale(1);
            }
            return BigDecimal.valueOf(amount(s)).multiply(BigDecimal.valueOf(100))
                .divide(BigDecimal.valueOf(amountMinor), 1, RoundingMode.HALF_UP);
        }

        public boolean targetKnown() {
            return emergencyTargetMinor > 0;
        }
    }

    public static Split split(long amountMinor, int emergencyMonths, Long fixedCostsMinor, long shortValueMinor) {
        if (amountMinor <= 0) {
            throw PenzErrors.badRequest(PenzErrors.PROPOSAL_AMOUNT_INVALID);
        }
        long target = fixedCostsMinor == null || fixedCostsMinor <= 0 || emergencyMonths <= 0 ? 0
            : Math.multiplyExact((long) emergencyMonths, fixedCostsMinor);
        long shortValue = Math.max(0, shortValueMinor);
        long shortfall = Math.max(0, target - shortValue);
        long shortPart = floor(Math.min(amountMinor, shortfall));
        long rest = amountMinor - shortPart;
        long mid = floor(Math.floorDiv(Math.multiplyExact(rest, (long) MID_PCT), 100L));
        long longPart = amountMinor - shortPart - mid;
        return new Split(amountMinor, emergencyMonths, fixedCostsMinor, target, shortValue, shortfall, shortPart, mid,
            longPart);
    }

    private static long floor(long minor) {
        return Math.floorDiv(minor, ROUND_TO_MINOR) * ROUND_TO_MINOR;
    }
}
