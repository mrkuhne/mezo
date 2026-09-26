package io.mrkuhne.mezo.feature.companion.entity;

import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.assertThat;

class FactOwnerTest {
    @Test
    void testForCategory_shouldMapEachCategoryToItsCharacter() {
        assertThat(FactOwner.forCategory("train")).isEqualTo("mocor");
        assertThat(FactOwner.forCategory("fuel")).isEqualTo("falat");
        assertThat(FactOwner.forCategory("health")).isEqualTo("deru");
        assertThat(FactOwner.forCategory("life")).isEqualTo("mezo");
        assertThat(FactOwner.forCategory("bogus")).isEqualTo("mezo");
    }

    @Test
    void testResolve_shouldKeepValidProposal_andFallBackOnInvalid() {
        assertThat(FactOwner.resolve("szunya", "health")).isEqualTo("szunya");
        assertThat(FactOwner.resolve("SZUNYA", "health")).isEqualTo("szunya");
        assertThat(FactOwner.resolve("doki", "health")).isEqualTo("deru");
        assertThat(FactOwner.resolve(null, "fuel")).isEqualTo("falat");
    }

    @Test
    void testBackfill_shouldGiveSleepHealthFactsToSzunya() {
        assertThat(FactOwner.backfill("health", "Sleep target: 7.5h")).isEqualTo("szunya");
        assertThat(FactOwner.backfill("health", "Későn fekszem le hétvégén")).isEqualTo("szunya");
        assertThat(FactOwner.backfill("health", "Right shoulder niggle")).isEqualTo("deru");
        assertThat(FactOwner.backfill("fuel", "alvás előtt nem eszem")).isEqualTo("falat");
    }
}
