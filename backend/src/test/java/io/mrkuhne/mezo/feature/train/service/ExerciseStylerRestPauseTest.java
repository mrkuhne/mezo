package io.mrkuhne.mezo.feature.train.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.train.entity.json.GymExerciseJson;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/** The owner's fixed rest-pause pins the whole exercise to 20 reps (mezo-r36n9.125). */
class ExerciseStylerRestPauseTest {

    private static GymExerciseJson ex(String technique, List<String> overrides) {
        return new GymExerciseJson(UUID.randomUUID(), "Leg Extension", "quads", 1, 3, 8, 12, 2, 40.0, "isolation",
            null, UUID.randomUUID(), true, null, 90, overrides, null, null, null)
            .withTechnique(technique, "owner", false);
    }

    @Test
    void restPausePinsTheRangeAndMarksItHis() {
        GymExerciseJson out = ExerciseStyler.pinRestPause(ex("rest_pause", List.of("restSec")), 20);
        assertThat(out.repMin()).isEqualTo(20);
        assertThat(out.repMax()).isEqualTo(20);
        assertThat(out.overrides()).containsExactly("restSec", "repRange");
        assertThat(out.workingSets()).isEqualTo(3);
        assertThat(out.technique()).isEqualTo("rest_pause");
        assertThat(out.techniqueSource()).isEqualTo("owner");
    }

    @Test
    void alreadyMarkedRangeIsNotDuplicated() {
        GymExerciseJson out = ExerciseStyler.pinRestPause(ex("rest_pause", List.of("repRange")), 20);
        assertThat(out.overrides()).containsExactly("repRange");
    }

    @Test
    void otherTechniquesAreUntouched() {
        GymExerciseJson myo = ex("myo", null);
        assertThat(ExerciseStyler.pinRestPause(myo, 20)).isSameAs(myo);
        GymExerciseJson none = ex(null, null);
        assertThat(ExerciseStyler.pinRestPause(none, 20)).isSameAs(none);
    }
}
