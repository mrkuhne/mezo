package io.mrkuhne.mezo.feature.train.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.train.entity.json.GymExerciseJson;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/** Carry-over of omitted style fields (mezo-r36n9.79): identity match, first unmatched, positional 1:1. */
class ExerciseStylerCarryTest {

    private static final UUID PRESS = UUID.randomUUID();

    private static GymExerciseJson ex(UUID catalogId, String name, String style, Integer restSec, List<String> overrides) {
        return new GymExerciseJson(UUID.randomUUID(), name, "chest-mid", 1, 3, 8, 12, 2, null, "compound", null,
            catalogId, true, style, restSec, overrides, null, null, null);
    }

    @Test
    void duplicateIdentitiesPairPositionallyAndAThirdGetsNothing() {
        List<GymExerciseJson> stored = List.of(
            ex(PRESS, "Press", "heavy", 200, List.of("restSec")),
            ex(PRESS, "Press", null, 120, List.of("repRange")));
        List<GymExerciseJson> incoming = List.of(
            ex(PRESS, "Press", null, null, null),
            ex(PRESS, "Press", null, null, null),
            ex(PRESS, "Press", null, null, null));

        List<GymExerciseJson> out = ExerciseStyler.carry(stored, incoming);

        assertThat(out.get(0).trainingStyle()).isEqualTo("heavy");
        assertThat(out.get(0).restSec()).isEqualTo(200);
        assertThat(out.get(0).overrides()).containsExactly("restSec");
        assertThat(out.get(1).trainingStyle()).isNull();
        assertThat(out.get(1).restSec()).isEqualTo(120);
        assertThat(out.get(1).overrides()).containsExactly("repRange");
        assertThat(out.get(2)).isSameAs(incoming.get(2));
    }

    @Test
    void overridesStayWhenTheClientSentAStyleField() {
        List<GymExerciseJson> out = ExerciseStyler.carry(
            List.of(ex(PRESS, "Press", "heavy", 200, List.of("restSec"))),
            List.of(ex(PRESS, "Press", null, 150, null)));

        assertThat(out.get(0).trainingStyle()).isEqualTo("heavy");
        assertThat(out.get(0).restSec()).isEqualTo(150);
        assertThat(out.get(0).overrides()).isNull();
    }

    @Test
    void identityIsCatalogIdElseExactName() {
        List<GymExerciseJson> out = ExerciseStyler.carry(
            List.of(ex(null, "Press", "heavy", 200, null), ex(null, "Own Row", "volume", 90, null)),
            List.of(ex(PRESS, "Press", null, null, null), ex(null, "Own Row", null, null, null)));

        assertThat(out.get(0).trainingStyle()).isNull(); // catalog id vs no catalog: no match
        assertThat(out.get(1).trainingStyle()).isEqualTo("volume");
        assertThat(out.get(1).restSec()).isEqualTo(90);
    }
}
