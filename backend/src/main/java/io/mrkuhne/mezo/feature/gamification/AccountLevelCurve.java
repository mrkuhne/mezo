package io.mrkuhne.mezo.feature.gamification;

/**
 * Pure account-level math (bd mezo-huzd): Lv n→n+1 costs 80 + 40·(n-1) XP. Ported 1:1 from the
 * FE mock (frontend/src/data/gamification/levelCurve.ts) — identical thresholds, identical
 * cumulative walk. Static utility, no Spring bean, no state, no DB: totalXp is always a
 * server-summed ledger total (never raw client input), so the unbounded walk below is not
 * exposed to adversarial magnitudes.
 */
public final class AccountLevelCurve {

    private AccountLevelCurve() {}

    /** Account-level snapshot for a given cumulative XP total. */
    public record LevelInfo(int level, long xpInLevel, long xpForNext) {}

    /** Cumulative XP cost to go from level {@code level} to {@code level + 1}. */
    public static long xpToNext(int level) {
        return 80L + 40L * (level - 1);
    }

    /** Walks the cumulative thresholds to find the level a given total XP lands in. */
    public static LevelInfo levelFor(long totalXp) {
        int level = 1;
        long rest = totalXp;
        while (rest >= xpToNext(level)) {
            rest -= xpToNext(level);
            level++;
        }
        return new LevelInfo(level, rest, xpToNext(level));
    }
}
