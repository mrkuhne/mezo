package io.mrkuhne.mezo.feature.train.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatExceptionOfType;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

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

    @Test
    void weekOneStart_shouldBeMevPlusTwoCappedAtMrv_whenEmphasize() {
        assertThat(PriorityTier.EMPHASIZE.weekOneStart(10, 16, 22)).isEqualTo(12);
        assertThat(PriorityTier.EMPHASIZE.weekOneStart(21, 21, 22)).isEqualTo(22);
    }

    @Test
    void weekOneStart_shouldBeMev_whenGrowOrMaintain() {
        assertThat(PriorityTier.GROW.weekOneStart(10, 16, 22)).isEqualTo(10);
        assertThat(PriorityTier.MAINTAIN.weekOneStart(10, 16, 22)).isEqualTo(10);
    }

    // === normalize() (mezo-ltk0, tier-review follow-up 2) ==========================

    @Test void normalizeNullMap_returnsEmptyMap() {
        assertThat(PriorityTier.normalize(null)).isEmpty();
    }

    @Test void normalizeEmptyMap_returnsEmptyMap() {
        assertThat(PriorityTier.normalize(Map.of())).isEmpty();
    }

    @Test void normalizeGrowValue_dropsTheEntry() {
        assertThat(PriorityTier.normalize(Map.of("back", "grow"))).isEmpty();
    }

    @Test void normalizeEmphasizeAndMaintainValues_keepsThem() {
        Map<String, String> normalized = PriorityTier.normalize(Map.of("back", "emphasize", "glute", "maintain"));
        assertThat(normalized).containsExactlyInAnyOrderEntriesOf(Map.of("back", "emphasize", "glute", "maintain"));
    }

    @Test void normalizeMixedMap_dropsOnlyGrow_keepsTheRest() {
        Map<String, String> normalized =
            PriorityTier.normalize(Map.of("back", "grow", "glute", "maintain", "chest", "emphasize"));
        assertThat(normalized).containsExactlyInAnyOrderEntriesOf(Map.of("glute", "maintain", "chest", "emphasize"));
    }

    @Test void normalizeUnknownValue_throws400() {
        assertThatExceptionOfType(SystemRuntimeErrorException.class)
            .isThrownBy(() -> PriorityTier.normalize(Map.of("back", "typo")))
            .satisfies(e -> {
                assertThat(e.getMessages()).hasSize(1);
                assertThat(e.getMessages().get(0).getCode()).isEqualTo("TRAIN_MUSCLE_PRIORITY_TIER_INVALID");
                assertThat(e.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST);
            });
    }

    @Test void normalizeNullValue_throws400_notNpe() {
        // Map.of() rejects null values outright, so a HashMap is needed to reproduce the shape
        // a plain Map<String,String> deserializes a client's `{"back": null}` into.
        Map<String, String> withNullValue = new HashMap<>();
        withNullValue.put("back", null);

        assertThatExceptionOfType(SystemRuntimeErrorException.class)
            .isThrownBy(() -> PriorityTier.normalize(withNullValue))
            .satisfies(e -> {
                assertThat(e.getMessages()).hasSize(1);
                assertThat(e.getMessages().get(0).getCode()).isEqualTo("TRAIN_MUSCLE_PRIORITY_TIER_INVALID");
                assertThat(e.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST);
            });
    }
}
