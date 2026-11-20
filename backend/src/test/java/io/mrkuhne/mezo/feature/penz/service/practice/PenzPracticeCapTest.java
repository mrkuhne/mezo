package io.mrkuhne.mezo.feature.penz.service.practice;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.junit.jupiter.api.Test;

/**
 * L7 build notes call 6: used = Σ cost of open trades + max(0, −Σ P/L closed this month); left = max(0, C − used);
 * gains never raise the cap. HUF minor units, invented.
 */
class PenzPracticeCapTest {

    private static final long CAP = 2_000_000L; // 20 000 Ft

    @Test
    void testOf_shouldCountOpenCostsAndTheMonthsNetLoss() {
        PracticeCap cap = PracticeCap.of(CAP, List.of(500_000L, 300_000L), List.of(-200_000L, 50_000L));
        assertThat(cap.capHufMinor()).isEqualTo(CAP);
        assertThat(cap.usedHufMinor()).isEqualTo(950_000L);
        assertThat(cap.leftHufMinor()).isEqualTo(1_050_000L);
    }

    @Test
    void testOf_shouldNotRaiseTheCap_whenTheMonthIsInProfit() {
        PracticeCap cap = PracticeCap.of(CAP, List.of(500_000L), List.of(900_000L));
        assertThat(cap.usedHufMinor()).isEqualTo(500_000L);
        assertThat(cap.leftHufMinor()).isEqualTo(1_500_000L);
    }

    @Test
    void testOf_shouldFloorLeftAtZero_whenOverspent() {
        PracticeCap cap = PracticeCap.of(CAP, List.of(1_500_000L), List.of(-900_000L));
        assertThat(cap.usedHufMinor()).isEqualTo(2_400_000L);
        assertThat(cap.leftHufMinor()).isZero();
    }

    @Test
    void testAllows_shouldAcceptExactlyLeftAndRefuseAbove() {
        PracticeCap cap = PracticeCap.of(CAP, List.of(1_000_000L), List.of());
        assertThat(cap.allows(1_000_000L)).isTrue();
        assertThat(cap.allows(1_000_001L)).isFalse();
        assertThat(PracticeCap.of(0, List.of(), List.of()).allows(1)).isFalse();
    }
}
