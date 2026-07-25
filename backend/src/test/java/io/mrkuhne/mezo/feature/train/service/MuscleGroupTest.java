package io.mrkuhne.mezo.feature.train.service;

import static org.assertj.core.api.Assertions.assertThat;
import org.junit.jupiter.api.Test;

class MuscleGroupTest {
    @Test void of_collapsesChestZones() { assertThat(MuscleGroup.of("chest-upper")).isEqualTo("chest"); }
    @Test void of_collapsesBackZonesAndTraps() {
        assertThat(MuscleGroup.of("back-wide")).isEqualTo("back");
        assertThat(MuscleGroup.of("traps")).isEqualTo("back");
    }
    @Test void of_collapsesArms() {
        assertThat(MuscleGroup.of("biceps-long")).isEqualTo("biceps");
        assertThat(MuscleGroup.of("triceps-lateral")).isEqualTo("triceps");
    }
    @Test void of_passesThroughCoarseAndLegs() {
        assertThat(MuscleGroup.of("quad")).isEqualTo("quad");
        assertThat(MuscleGroup.of("chest")).isEqualTo("chest");   // legacy coarse
        assertThat(MuscleGroup.of("core")).isEqualTo("core");
    }
}
