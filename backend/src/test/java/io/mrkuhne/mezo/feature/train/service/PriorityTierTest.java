package io.mrkuhne.mezo.feature.train.service;

import static org.assertj.core.api.Assertions.assertThat;
import java.util.Map;
import org.junit.jupiter.api.Test;

class PriorityTierTest {
    @Test void ofNullMap_defaultsToGrow() {
        PriorityTier tier = PriorityTier.of(null, "back");
        assertThat(tier).isEqualTo(PriorityTier.GROW);
    }
    @Test void ofAbsentKey_defaultsToGrow() {
        PriorityTier tier = PriorityTier.of(Map.of("leg", "emphasize"), "back");
        assertThat(tier).isEqualTo(PriorityTier.GROW);
    }
    @Test void ofEmphasizeValue_resolvesEmphasize() {
        PriorityTier tier = PriorityTier.of(Map.of("back", "emphasize"), "back");
        assertThat(tier).isEqualTo(PriorityTier.EMPHASIZE);
    }
    @Test void ofMaintainValue_resolveMaintain() {
        PriorityTier tier = PriorityTier.of(Map.of("back", "maintain"), "back");
        assertThat(tier).isEqualTo(PriorityTier.MAINTAIN);
    }
    @Test void ofGrowValue_resolvesGrow() {
        PriorityTier tier = PriorityTier.of(Map.of("back", "grow"), "back");
        assertThat(tier).isEqualTo(PriorityTier.GROW);
    }
    @Test void ofUnknownValue_defaultsToGrow() {
        PriorityTier tier = PriorityTier.of(Map.of("back", "typo"), "back");
        assertThat(tier).isEqualTo(PriorityTier.GROW);
    }
    @Test void emphasizeCeiling_returnsMrv() {
        int ceiling = PriorityTier.EMPHASIZE.ceiling(8, 14, 20);
        assertThat(ceiling).isEqualTo(20);
    }
    @Test void growCeiling_returnsMav() {
        int ceiling = PriorityTier.GROW.ceiling(8, 14, 20);
        assertThat(ceiling).isEqualTo(14);
    }
    @Test void maintainCeiling_returnsMev() {
        int ceiling = PriorityTier.MAINTAIN.ceiling(8, 14, 20);
        assertThat(ceiling).isEqualTo(8);
    }
    @Test void rampEnabledFalseOnlyForMaintain() {
        assertThat(PriorityTier.EMPHASIZE.rampEnabled()).isTrue();
        assertThat(PriorityTier.GROW.rampEnabled()).isTrue();
        assertThat(PriorityTier.MAINTAIN.rampEnabled()).isFalse();
    }
}
