package io.mrkuhne.mezo.feature.biometrics.checkin.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import java.util.Random;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/**
 * The per-(user, date, slot) seed must decorrelate neighbouring days (mezo-x6t01): a raw
 * {@code 31 * h + epochDay} seed moves {@link Random}'s first output by only ~0.003 per day, so a
 * user whose first draw landed below the random share got RANDOM picks for weeks in a row.
 */
class CheckInPlanSeedTest {

    private static final LocalDate DAY = LocalDate.parse("2026-06-15");
    private static final double RANDOM_SHARE = 0.2;

    @Test
    void testSeed_shouldDecorrelateConsecutiveDays_whenFirstDrawCompared() {
        Random users = new Random(42);
        int streaks = 0;
        int n = 2_000;
        for (int u = 0; u < n; u++) {
            UUID user = new UUID(users.nextLong(), users.nextLong());
            boolean allRandom = true;
            for (int d = 0; d < 11 && allRandom; d++) {
                allRandom = new Random(CheckInPlanService.seed(user, DAY.plusDays(d), "14:00"))
                    .nextDouble() < RANDOM_SHARE;
            }
            if (allRandom) streaks++;
        }
        // Independent draws: P(11 random in a row) = 0.2^11 ≈ 2e-8 → expect 0 of 2000.
        assertThat(streaks).isZero();
    }

    @Test
    void testSeed_shouldBeDeterministic_whenSameInputs() {
        UUID user = UUID.fromString("00000000-0000-0000-0000-000000000001");
        assertThat(CheckInPlanService.seed(user, DAY, "06:30"))
            .isEqualTo(CheckInPlanService.seed(user, DAY, "06:30"))
            .isNotEqualTo(CheckInPlanService.seed(user, DAY.plusDays(1), "06:30"));
    }
}
