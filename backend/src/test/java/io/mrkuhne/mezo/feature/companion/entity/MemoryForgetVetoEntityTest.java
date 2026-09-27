package io.mrkuhne.mezo.feature.companion.entity;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class MemoryForgetVetoEntityTest {

    @Test
    void normalizeFactText_shouldTrimLowercaseAndCollapseWhitespace() {
        assertThat(MemoryForgetVetoEntity.normalizeFactText("  Laktózérzékeny   VAGY\n\tsajnos "))
                .isEqualTo("laktózérzékeny vagy sajnos");
    }

    @Test
    void normalizeFactText_shouldMatchTheExtractionDedupeRule() {
        // FactExtractionService.normalize and WeeklyLessonService.normalize use exactly this rule —
        // a veto that normalized differently would silently never match.
        String raw = "Reggel  7-kor edzel.";
        assertThat(MemoryForgetVetoEntity.normalizeFactText(raw))
                .isEqualTo(raw.trim().toLowerCase().replaceAll("\\s+", " "));
    }
}
