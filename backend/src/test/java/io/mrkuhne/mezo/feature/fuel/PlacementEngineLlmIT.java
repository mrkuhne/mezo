package io.mrkuhne.mezo.feature.fuel;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.fuel.service.PlacementEngine;
import io.mrkuhne.mezo.feature.pantry.entity.PantryItemEntity;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.PantryItemPopulator;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

/**
 * Companion + stack-placement-llm are BOTH on by default (application.yml) — this class runs
 * against the deterministic {@code FakeCompanionLlm} (mezo-vx9v) to exercise the actual "llm"
 * success branch of {@code PlacementEngine.llmPlacement()} — JSON substring extraction,
 * {@code StackZone.fromKey} validation, {@code Placement} with source "llm" — that
 * {@code PlacementEngineIT} never reaches (it forces companion off to prove the deterministic
 * paths only). Mirrors {@code ActivityClassifierIT}'s shape (sentinel-scripted + garbage-answer
 * coverage) for the fuel-owned {@code StackPlacementLlm} port.
 */
@Transactional
@ActiveProfiles("companion-fake")
class PlacementEngineLlmIT extends AbstractIntegrationTest {

    @Autowired PlacementEngine engine;
    @Autowired PantryItemPopulator pantryPop;
    @Autowired io.mrkuhne.mezo.support.DatabasePopulator databasePopulator;

    @Test
    void testPlace_shouldUseLlm_whenUnknownItemAndLlmAvailable() {
        UUID owner = databasePopulator.populateUser("a@test.local");
        // no rule needle, no timing -> falls through to the LLM branch; no sentinel planted ->
        // FakeCompanionLlm answers its default minimal placement for the un-scripted happy path.
        PantryItemEntity item = pantryPop.createSupplement(owner, "Rejtélyes gyógynövény X", null);

        PlacementEngine.Placement p = engine.place(item);

        assertThat(p.source()).isEqualTo("llm");
        assertThat(p.slotKey()).isEqualTo("evening");
        assertThat(p.reasonHu()).isNotBlank();
    }

    @Test
    void testPlace_shouldFallBack_whenLlmAnswersGarbage() {
        UUID owner = databasePopulator.populateUser("a@test.local");
        // [fake-stack-placement:...] planted in the NAME reaches the prompt's user message
        // verbatim (PlacementEngine calls port.complete(SYSTEM_PROMPT, item.getName())); the
        // scripted answer is not JSON, so llmPlacement's substring/parse throws and is caught.
        PantryItemEntity item = pantryPop.createSupplement(owner,
            "Rejtélyes gyógynövény Y [fake-stack-placement:ez nem json]", null);

        PlacementEngine.Placement p = engine.place(item);

        assertThat(p.source()).isEqualTo("fallback");
        assertThat(p.slotKey()).isEqualTo("breakfast");
    }
}
