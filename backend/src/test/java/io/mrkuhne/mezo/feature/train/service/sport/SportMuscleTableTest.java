package io.mrkuhne.mezo.feature.train.service.sport;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.train.ExerciseCatalogLoader;
import java.util.List;
import org.junit.jupiter.api.Test;

/** Boop Sport S2 (mezo-r36n9.202): the sport → muscle-load table. */
class SportMuscleTableTest {

    @Test
    void volleyballWorksTheSpecsMuscles() {
        assertThat(SportMuscleTable.weights("volleyball"))
            .containsKeys("shoulder-side", "quad", "calf", "core", "glute");
        assertThat(SportMuscleTable.weights("Volleyball")).isEqualTo(SportMuscleTable.weights("volleyball"));
    }

    @Test
    void otherAndUnknownKindsHaveNoHeat() {
        assertThat(SportMuscleTable.weights("other")).isEmpty();
        assertThat(SportMuscleTable.weights("curling")).isEmpty();
        assertThat(SportMuscleTable.weights(null)).isEmpty();
    }

    @Test
    void everyMappedKindUsesCatalogueTokensAndWeightsInRange() {
        for (String kind : List.of("volleyball", "basketball", "football", "tennis", "running", "bike", "swim",
                "hike", "cross", "trx")) {
            assertThat(SportMuscleTable.weights(kind)).as(kind).isNotEmpty().allSatisfy((muscle, w) -> {
                assertThat(ExerciseCatalogLoader.MUSCLES).as(kind + " " + muscle).contains(muscle);
                assertThat(w).isBetween(0.0, 1.0);
            });
        }
    }
}
