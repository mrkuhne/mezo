package io.mrkuhne.mezo.feature.pantry;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.nutrition.service.AllergenState;
import io.mrkuhne.mezo.feature.pantry.entity.PantryCatalogEntity;
import io.mrkuhne.mezo.feature.pantry.repository.PantryCatalogRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import jakarta.persistence.EntityManager;
import java.math.BigDecimal;
import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

/**
 * mezo-r36n9.48: the catalog's allergen column was empty on every live row, so a cod or egg recipe
 * rolled up to no allergens at all. The runner fills in what the shelf states with certainty. The
 * runner is {@code @Profile("demodata")}, hence the {@code @ActiveProfiles}; the no-arg
 * {@code backfill()} overload is the entry point, as with its sibling runners.
 */
@Transactional
@ActiveProfiles("demodata")
class PantryCatalogAllergenBaselineRunnerIT extends AbstractIntegrationTest {

    @Autowired private PantryCatalogRepository repository;
    @Autowired private PantryCatalogAllergenBaselineRunner runner;
    @Autowired private EntityManager entityManager;

    // Master rows (created_by NULL): no app_user FK to satisfy, and the "ITX" prefix keeps the
    // names clear of uq_pantry_catalog_natural collisions with seeded content.

    @Test
    void backfill_shouldFillWhatTheShelfStates() {
        PantryCatalogEntity cod = row("ITX tőkehal", "fish", null);
        PantryCatalogEntity egg = row("ITX tojás", "eggs", null);
        PantryCatalogEntity skyr = row("ITX skyr", "dairy", null);
        PantryCatalogEntity cashew = row("ITX kesudió", "nuts_seeds", null);

        runner.backfill();
        entityManager.clear();

        assertThat(reload(cod).getAllergens()).containsEntry("fish", AllergenState.CONTAINS);
        assertThat(reload(egg).getAllergens()).containsEntry("eggs", AllergenState.CONTAINS);
        assertThat(reload(skyr).getAllergens()).containsEntry("milk", AllergenState.CONTAINS);
        assertThat(reload(cashew).getAllergens()).containsEntry("nuts", AllergenState.CONTAINS);
    }

    /** The plant drinks share the dairy shelf: neither may be labelled a milk product. */
    @Test
    void backfill_shouldNotCallAPlantDrinkAMilkProduct() {
        PantryCatalogEntity almond = row("ITX mandulaital", "dairy", null);
        PantryCatalogEntity coconut = row("ITX kókusztej", "dairy", null);

        runner.backfill();
        entityManager.clear();

        assertThat(reload(almond).getAllergens())
            .containsEntry("nuts", AllergenState.CONTAINS)
            .doesNotContainKey("milk");
        // Coconut is not an EU-14 allergen: the row stays silent rather than guessing.
        assertThat(reload(coconut).getAllergens()).isEmpty();
    }

    /** A seed mix does not say which seed, so it must stay unknown instead of being guessed at. */
    @Test
    void backfill_shouldLeaveAnAmbiguousRowUnknown() {
        PantryCatalogEntity mix = row("ITX magkeverék", "nuts_seeds", null);

        runner.backfill();
        entityManager.clear();

        assertThat(reload(mix).getAllergens()).isEmpty();
    }

    /** A real declaration always outranks what the category implies — and the run is idempotent. */
    @Test
    void backfill_shouldLeaveADeclaredStateAlone_andBeIdempotent() {
        Map<String, AllergenState> declared = new HashMap<>(Map.of("fish", AllergenState.TRACES));
        PantryCatalogEntity scanned = row("ITX halrudak", "fish", declared);

        runner.backfill();
        runner.backfill();
        entityManager.clear();

        assertThat(reload(scanned).getAllergens()).containsEntry("fish", AllergenState.TRACES);
    }

    /** The owner's own lactose-free products are recognised from the name, dairy allergen intact. */
    @Test
    void backfill_shouldMarkLactoseFreeProducts() {
        PantryCatalogEntity lactoseFree = row("ITX laktózmentes túró", "cheese", null);
        PantryCatalogEntity plain = row("ITX túró", "cheese", null);

        runner.backfill();
        entityManager.clear();

        assertThat(reload(lactoseFree).isLactoseFree()).isTrue();
        assertThat(reload(lactoseFree).getAllergens()).containsEntry("milk", AllergenState.CONTAINS);
        assertThat(reload(plain).isLactoseFree()).isFalse();
    }

    private PantryCatalogEntity row(String name, String category, Map<String, AllergenState> allergens) {
        PantryCatalogEntity e = new PantryCatalogEntity();
        e.setKind("food");
        e.setName(name);
        e.setSource("manual");
        e.setCategory(category);
        e.setServingAmount(new BigDecimal("100"));
        e.setServingUnit("g");
        e.setKcal(BigDecimal.valueOf(100));
        e.setNova((short) 1);
        if (allergens != null) {
            e.setAllergens(allergens);
        }
        return repository.saveAndFlush(e);
    }

    private PantryCatalogEntity reload(PantryCatalogEntity e) {
        return repository.findById(e.getId()).orElseThrow();
    }
}
