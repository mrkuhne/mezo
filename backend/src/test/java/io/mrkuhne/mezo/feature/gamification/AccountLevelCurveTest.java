package io.mrkuhne.mezo.feature.gamification;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.gamification.AccountLevelCurve.LevelInfo;
import org.junit.jupiter.api.Test;

/**
 * Pure logic: no Spring context. Pins the exact numbers
 * frontend/src/data/gamification/levelCurve.test.ts asserts against the FE curve
 * (xpToNext(n) = 80 + 40·(n-1)) — the Java port must walk the identical thresholds.
 */
class AccountLevelCurveTest {

    @Test
    void testXpToNext_shouldGrowLinearlyFrom80By40PerLevel() {
        assertThat(AccountLevelCurve.xpToNext(1)).isEqualTo(80L);
        assertThat(AccountLevelCurve.xpToNext(2)).isEqualTo(120L);
        assertThat(AccountLevelCurve.xpToNext(12)).isEqualTo(520L);
    }

    @Test
    void testLevelFor_shouldWalkCumulativeThresholds_whenGivenTotalXp() {
        assertThat(AccountLevelCurve.levelFor(0L)).isEqualTo(new LevelInfo(1, 0L, 80L));
        assertThat(AccountLevelCurve.levelFor(79L)).isEqualTo(new LevelInfo(1, 79L, 80L));
        assertThat(AccountLevelCurve.levelFor(80L)).isEqualTo(new LevelInfo(2, 0L, 120L));
        assertThat(AccountLevelCurve.levelFor(560L)).isEqualTo(new LevelInfo(5, 0L, 240L));
        // FE mock fixture (levelCurve.test.ts): 3140 total XP -> Lv 12, 60 XP into the level.
        assertThat(AccountLevelCurve.levelFor(3140L)).isEqualTo(new LevelInfo(12, 60L, 520L));
    }
}
