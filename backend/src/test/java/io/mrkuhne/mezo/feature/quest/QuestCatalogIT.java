package io.mrkuhne.mezo.feature.quest;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/** Catalog content loads, validates fail-fast, and stays inside the ADR-0010 XP band. */
class QuestCatalogIT extends AbstractIntegrationTest {

    @Autowired private QuestCatalog catalog;

    @Test
    void testLoad_shouldExposeBothSlots_whenContentLoaded() {
        assertThat(catalog.all()).isNotEmpty();
        assertThat(catalog.all()).extracting(QuestCatalog.QuestDef::slot)
            .contains("BODY", "FUELBIO");
        // ADR 0010: quest XP band 15–40
        assertThat(catalog.all()).allSatisfy(d -> assertThat(d.xp()).isBetween(15, 40));
        // E1: coins prepared but always 0 (unspendable currency is a broken promise)
        assertThat(catalog.all()).allSatisfy(d -> assertThat(d.coins()).isZero());
    }
}
