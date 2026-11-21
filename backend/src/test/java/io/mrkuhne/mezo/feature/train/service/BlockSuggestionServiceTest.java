package io.mrkuhne.mezo.feature.train.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.SuggestionPrescription;
import io.mrkuhne.mezo.feature.train.entity.ExerciseCatalogEntity;
import io.mrkuhne.mezo.feature.train.service.StyleTable.Stamp;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/** The block day editor's pure pieces (mezo-r36n9.116): the suggestion prescription and the add slot's type. */
class BlockSuggestionServiceTest {

    private static ExerciseCatalogEntity row(String name, String muscle, String type) {
        ExerciseCatalogEntity c = new ExerciseCatalogEntity();
        c.setId(UUID.nameUUIDFromBytes(name.getBytes()));
        c.setName(name);
        c.setMuscle(muscle);
        c.setType(type);
        return c;
    }

    private static void assertMatches(SuggestionPrescription p, Stamp s) {
        assertThat(p.getRepMin()).isEqualTo(s.repMin());
        assertThat(p.getRepMax()).isEqualTo(s.repMax());
        assertThat(p.getTargetRIR()).isEqualTo(s.reserve());
        assertThat(p.getRestSec()).isEqualTo(s.restSec());
        assertThat(p.getWorkingSets()).isEqualTo(s.workingSets() == null ? 3 : s.workingSets());
    }

    @Test
    void prescription_shouldEqualTheStyleTable_forACompoundLegRow() {
        SuggestionPrescription p = BlockSuggestionService.prescription(
            row("Back Squat", "quad", "compound"), TrainingStyle.BALANCED, false, StyleTableTest.P);

        assertMatches(p, StyleTable.stamp(TrainingStyle.BALANCED, ExerciseClass.COMPOUND_FREE, false, true,
            StyleTableTest.P));
    }

    @Test
    void prescription_shouldEqualTheStyleTable_forAnIsolationRow() {
        SuggestionPrescription p = BlockSuggestionService.prescription(
            row("Cable Fly", "chest-mid", "isolation"), TrainingStyle.VOLUME, true, StyleTableTest.P);

        assertMatches(p, StyleTable.stamp(TrainingStyle.VOLUME, ExerciseClass.ISOLATION, true, false,
            StyleTableTest.P));
    }

    @Test
    void prescription_shouldBeNull_forAPlyoRowOrAnUnstyledBlock() {
        assertThat(BlockSuggestionService.prescription(row("Box Jump", "quad", "plyo"), TrainingStyle.BALANCED,
            false, StyleTableTest.P)).isNull();
        assertThat(BlockSuggestionService.prescription(row("Back Squat", "quad", "compound"), null,
            false, StyleTableTest.P)).isNull();
    }

    @Test
    void preferredType_shouldBeIsolation_onlyWhenTheDayHasACompoundOfTheGroup() {
        ExerciseCatalogEntity rowCompound = row("Seated Row", "back-mid", "compound");
        ExerciseCatalogEntity pullover = row("Cable Pullover", "back-wide", "isolation");
        List<ExerciseCatalogEntity> pool = List.of(rowCompound, pullover);

        assertThat(BlockSuggestionService.preferredType(pool, Set.of())).isEqualTo("compound");
        assertThat(BlockSuggestionService.preferredType(pool, Set.of(pullover.getId()))).isEqualTo("compound");
        assertThat(BlockSuggestionService.preferredType(pool, Set.of(rowCompound.getId()))).isEqualTo("isolation");
    }

    @Test
    void preferredType_shouldJudgeOnlyTheRowsOfTheAskedGroup() {
        ExerciseCatalogEntity rowCompound = row("Seated Row", "back-mid", "compound");
        ExerciseCatalogEntity legPress = row("Leg Press", "quad", "compound");
        List<ExerciseCatalogEntity> pool = List.of(rowCompound, legPress);
        Set<java.util.UUID> inDay = Set.of(rowCompound.getId());

        assertThat(BlockSuggestionService.preferredType(pool, inDay, "back")).isEqualTo("isolation");
        assertThat(BlockSuggestionService.preferredType(pool, inDay, "quad")).isEqualTo("compound");
    }
}
