package io.mrkuhne.mezo.feature.progression;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class PerkCatalogIT extends AbstractIntegrationTest {

    @Autowired private PerkCatalog perkCatalog;

    @Test
    void testFind_shouldReturnPerk_whenSkillAndMilestoneMatchContent() {
        assertThat(perkCatalog.find("max_strength", 5))
            .get()
            .satisfies(p -> {
                assertThat(p.perkKey()).isNotBlank();
                assertThat(p.name()).isNotBlank();
                assertThat(p.effectCopy()).isNotBlank();
            });
    }

    @Test
    void testFind_shouldBeEmpty_whenNoPerkAtThatMilestone() {
        assertThat(perkCatalog.find("max_strength", 4)).isEmpty();
    }
}
