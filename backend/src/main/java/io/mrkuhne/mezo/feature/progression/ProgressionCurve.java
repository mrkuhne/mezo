package io.mrkuhne.mezo.feature.progression;

import io.mrkuhne.mezo.feature.progression.config.ProgressionProperties;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * Pure level math derived from cumulative XP. A skill with 0 XP is level 1; xpThreshold(n)
 * is the cumulative XP required to BE at level n. No state, no DB.
 */
@Component
@RequiredArgsConstructor
public class ProgressionCurve {

    private static final int MAX_LEVEL = 200; // safety cap for the levelFor scan

    private final ProgressionProperties properties;

    /** Cumulative XP required to be AT {@code level}. xpThreshold(1) = 0. */
    public long xpThreshold(int level) {
        if (level <= 1) {
            return 0L;
        }
        ProgressionProperties.Curve c = properties.curve();
        return Math.round(c.base() * Math.pow(level - 1, c.exp()));
    }

    /** Highest level n whose threshold ≤ cumulativeXp (≥ 1). */
    public int levelFor(long cumulativeXp) {
        int level = 1;
        while (level < MAX_LEVEL && xpThreshold(level + 1) <= cumulativeXp) {
            level++;
        }
        return level;
    }

    /** Within-level fill 0..100 for a skill at {@code level} holding {@code cumulativeXp}. */
    public double progressPct(long cumulativeXp, int level) {
        long floor = xpThreshold(level);
        long ceil = xpThreshold(level + 1);
        if (ceil <= floor) {
            return 100.0;
        }
        double pct = (double) (cumulativeXp - floor) / (ceil - floor) * 100.0;
        return Math.max(0.0, Math.min(100.0, pct));
    }
}
