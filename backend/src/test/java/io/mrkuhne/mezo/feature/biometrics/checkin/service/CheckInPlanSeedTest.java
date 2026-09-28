package io.mrkuhne.mezo.feature.biometrics.checkin.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import java.util.Random;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/**
 * The per-(user, day, slot) seed must decorrelate consecutive days: {@link Random}'s first draw
 * from near-neighbour seeds is nearly identical, which once pinned about one user in eight to the
 * random pick on every day (mezo-ck2 follow-up).
 */
class CheckInPlanSeedTest {

    private static final LocalDate DAY = LocalDate.parse("2026-06-15");

    @Test
    void testSeed_shouldDecorrelateConsecutiveDays_whenSameUserAndSlot() {
        Random users = new Random(42);
        int stuck = 0;
        for (int u = 0; u < 2_000; u++) {
            UUID user = new UUID(users.nextLong(), users.nextLong());
            boolean allBelow = true;
            for (int d = 0; d < 7 && allBelow; d++) {
                double first = new Random(CheckInPlanService.seed(user, DAY.plusDays(d), "14:00")).nextDouble();
                allBelow = first < 0.2;
            }
            if (allBelow) {
                stuck++;
            }
        }
        // Independent draws: 0.2^7 ≈ 1.3e-5 per user, so none of 2 000; correlated seeds gave ~12%.
        assertThat(stuck).isZero();
    }

    @Test
    void testSeed_shouldBeStable_whenSameInputs() {
        UUID user = UUID.fromString("1650d7e2-e921-43a2-8c7f-d83c164d47f0");
        assertThat(CheckInPlanService.seed(user, DAY, "14:00"))
            .isEqualTo(CheckInPlanService.seed(user, DAY, "14:00"))
            .isNotEqualTo(CheckInPlanService.seed(user, DAY.plusDays(1), "14:00"));
    }
}
