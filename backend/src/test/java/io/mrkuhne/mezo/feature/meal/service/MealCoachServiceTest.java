package io.mrkuhne.mezo.feature.meal.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.meal.service.MealCoachService.ExtractedVerdict;
import io.mrkuhne.mezo.feature.nutrition.entity.MealBreakdownJson;
import io.mrkuhne.mezo.feature.nutrition.entity.MealBreakdownJson.Dimension;
import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/**
 * Pure unit coverage for the coach's per-dimension note handling (mezo-jcpt): the null/blank
 * filtering and 240-char trim in {@link MealCoachService#notes} plus the id-match/unknown-drop
 * merge in {@link MealCoachStore#mergeDimensionNotes}. Both are plain static methods — no Spring,
 * no LLM — so this is the fast, always-runnable half of the coverage; the end-to-end "notes land
 * in the stored envelope" behavior is {@code MealCoachServiceIT}.
 */
class MealCoachServiceTest {

    private static ExtractedVerdict verdict(Map<String, String> dimensionNotes) {
        return new ExtractedVerdict("11111111-1111-1111-1111-111111111111", "Tagline", "Summary",
            List.of(), dimensionNotes);
    }

    private static Dimension dim(String id, String note) {
        return new Dimension(id, "Label", BigDecimal.ONE, new BigDecimal("0.5"), "detail",
            null, null, null, null, note);
    }

    @Test
    void notes_shouldReturnEmptyMap_whenTheAnswerCarriesNoDimensionNotes() {
        assertThat(MealCoachService.notes(verdict(null))).isEmpty();
    }

    @Test
    void notes_shouldDropBlankAndNullValues() {
        Map<String, String> raw = new LinkedHashMap<>();
        raw.put("macro", "A fehérje erős ehhez az adaghoz.");
        raw.put("micro", "");
        raw.put("nova", "   ");
        raw.put("who", null);

        Map<String, String> result = MealCoachService.notes(verdict(raw));

        assertThat(result).containsOnlyKeys("macro")
            .containsEntry("macro", "A fehérje erős ehhez az adaghoz.");
    }

    @Test
    void notes_shouldTrimAnOverlongNoteTo240Characters() {
        String tooLong = "a".repeat(300);

        Map<String, String> result = MealCoachService.notes(verdict(Map.of("macro", tooLong)));

        assertThat(result.get("macro")).hasSize(240).isEqualTo("a".repeat(240));
    }

    @Test
    void mergeDimensionNotes_shouldWriteTheNoteIntoTheMatchingDimension_byId() {
        List<Dimension> dimensions = List.of(dim("macro", null), dim("nova", null));

        List<Dimension> merged = MealCoachStore.mergeDimensionNotes(dimensions,
            Map.of("macro", "A fehérje erős ehhez az adaghoz."));

        assertThat(merged).extracting(Dimension::id, Dimension::note)
            .containsExactly(
                org.assertj.core.groups.Tuple.tuple("macro", "A fehérje erős ehhez az adaghoz."),
                org.assertj.core.groups.Tuple.tuple("nova", null));
    }

    @Test
    void mergeDimensionNotes_shouldSilentlyDropAnUnknownDimensionId() {
        List<Dimension> dimensions = List.of(dim("macro", null));

        List<Dimension> merged = MealCoachStore.mergeDimensionNotes(dimensions,
            Map.of("bogus", "eldobandó"));

        assertThat(merged).extracting(Dimension::note).containsOnlyNulls();
        assertThat(merged.stream().map(Dimension::note)).doesNotContain("eldobandó");
    }

    @Test
    void mergeDimensionNotes_shouldPreserveEveryOtherFieldOfTheDimension() {
        Dimension original = dim("macro", null);
        List<Dimension> merged = MealCoachStore.mergeDimensionNotes(List.of(original),
            Map.of("macro", "Note"));

        Dimension updated = merged.getFirst();
        assertThat(updated.label()).isEqualTo(original.label());
        assertThat(updated.weight()).isEqualByComparingTo(original.weight());
        assertThat(updated.score()).isEqualByComparingTo(original.score());
        assertThat(updated.detail()).isEqualTo(original.detail());
    }
}
