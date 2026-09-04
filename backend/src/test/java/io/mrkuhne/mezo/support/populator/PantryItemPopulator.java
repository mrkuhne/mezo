package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.pantry.entity.MicroFact;
import io.mrkuhne.mezo.feature.pantry.entity.PantryCatalogEntity;
import io.mrkuhne.mezo.feature.pantry.entity.PantryItemEntity;
import io.mrkuhne.mezo.feature.pantry.repository.PantryCatalogRepository;
import io.mrkuhne.mezo.feature.pantry.repository.PantryItemRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import java.util.function.Consumer;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;

/** Test data factory for the PantryItem aggregate — persists via {@code saveAndFlush} so DB CHECKs fire.
 *  Since S4 (mezo-qw37.4) each factory splits into a shared {@link PantryCatalogEntity} definition
 *  (find-or-create by natural key) plus the owner's {@link PantryItemEntity} state row. */
@TestComponent
@RequiredArgsConstructor
public class PantryItemPopulator {

    private final PantryItemRepository repository;
    private final PantryCatalogRepository catalogRepository;

    /** Find-or-create the definition by natural key (user-authored by {@code owner}); the configurer fills a NEW row only. */
    private PantryCatalogEntity catalogFor(UUID owner, String name, String brand, Consumer<PantryCatalogEntity> definition) {
        return catalogRepository.findByNaturalKey(name, brand).orElseGet(() -> {
            PantryCatalogEntity c = new PantryCatalogEntity();
            c.setCreatedBy(owner);
            c.setName(name);
            c.setBrand(brand);
            definition.accept(c);
            return catalogRepository.saveAndFlush(c);
        });
    }

    /** Find-or-create the owner's LIVE item for the definition (uq_pantry_item_created_by_catalog_id); state fields fill a NEW row only. */
    private PantryItemEntity itemFor(UUID owner, PantryCatalogEntity catalog, Consumer<PantryItemEntity> state) {
        return repository.findByCreatedByAndCatalog_IdAndDeletedFalse(owner, catalog.getId()).orElseGet(() -> {
            PantryItemEntity e = new PantryItemEntity();
            e.setCreatedBy(owner);
            e.setCatalog(catalog);
            state.accept(e);
            return repository.saveAndFlush(e);
        });
    }

    /** A food row with macros, stock + expiry, NOVA, and one micro. */
    public PantryItemEntity createFood(UUID owner, String name, LocalDate expires) {
        PantryCatalogEntity catalog = catalogFor(owner, name, "Bonafarm", c -> {
            c.setKind("food");
            c.setSource("kifli.hu");
            c.setCategory("meat"); // valid ck_pantry_catalog_category enum value
            c.setServingAmount(new BigDecimal("100"));
            c.setServingUnit("g");
            c.setKcal(new BigDecimal("110"));
            c.setProteinG(new BigDecimal("23.0"));
            c.setCarbsG(BigDecimal.ZERO);
            c.setFatG(new BigDecimal("1.5"));
            c.setNova((short) 1);
            c.setMicros(List.of(new MicroFact("B6", 92)));
        });
        return itemFor(owner, catalog, e -> {
            e.setStockQty(new BigDecimal("400"));
            e.setStockUnit("g");
            e.setStockExpires(expires);
        });
    }

    /** A food row that DOES carry the four nutrition-quality facts per 100 g (mezo-m6uv). The plain
     *  {@link #createFood} stays fact-less on purpose — it is the null-arm fixture. */
    public PantryItemEntity createFoodWithNutrients(UUID owner, String name) {
        PantryCatalogEntity catalog = catalogFor(owner, name, null, c -> {
            c.setKind("food");
            c.setSource("manual");
            c.setCategory("dairy"); // valid ck_pantry_catalog_category enum value
            c.setServingAmount(new BigDecimal("100"));
            c.setServingUnit("g");
            c.setKcal(new BigDecimal("110"));
            c.setProteinG(new BigDecimal("13.0"));
            c.setCarbsG(new BigDecimal("4.0"));
            c.setFatG(new BigDecimal("4.5"));
            c.setFiberG(new BigDecimal("3.2"));
            c.setSugarG(new BigDecimal("4.1"));
            c.setSaltG(new BigDecimal("0.4"));
            c.setSaturatedFatG(new BigDecimal("2.8"));
            c.setNova((short) 1);
        });
        return itemFor(owner, catalog, e -> { });
    }

    /** A minimal food row with an explicit category, price and NOVA — the suggestion-heuristic fixture (P6). */
    public PantryItemEntity createPricedFood(UUID owner, String name, String category,
                                             Integer priceHuf, String priceUnit, Short nova) {
        PantryCatalogEntity catalog = catalogFor(owner, name, null, c -> {
            c.setKind("food");
            c.setSource("manual");
            c.setCategory(category);
            c.setServingAmount(new BigDecimal("100"));
            c.setServingUnit("g");
            c.setKcal(new BigDecimal("100"));
            c.setNova(nova);
        });
        return itemFor(owner, catalog, e -> {
            e.setPriceHuf(priceHuf);
            e.setPriceUnit(priceUnit);
        });
    }

    /** A supplement row with dose + protocol + stock-as-doses. */
    public PantryItemEntity createSupplement(UUID owner, String name) {
        return createSupplement(owner, name, "morning");
    }

    /** A supplement row with an explicit timing override (including {@code null}) — for
     *  zone-placement tests that need to bypass the default 'morning' timing hint (mezo-vx9v),
     *  e.g. an unknown-name fixture whose timing must also be unset to reach the LLM/fallback path. */
    public PantryItemEntity createSupplement(UUID owner, String name, String timing) {
        PantryCatalogEntity catalog = catalogFor(owner, name, "MyProtein", c -> {
            c.setKind("supplement");
            c.setSource("myprotein.hu");
            c.setCategory("supplement"); // valid ck_pantry_catalog_category enum value
            c.setForm("por");
        });
        return itemFor(owner, catalog, e -> {
            e.setDose("5g");
            e.setProtocol("Naponta egy adag");
            e.setTiming(timing);
            e.setStockQty(new BigDecimal("86"));
            e.setStockUnit("adag");
        });
    }

    /** A stim row (kind='stim') — the caffeine-timing fixture (habit stim-intake tests). Copy of
     *  {@code createSupplement} with only {@code kind} changed; category enum stays valid. */
    public PantryItemEntity createStim(UUID owner, String name) {
        PantryCatalogEntity catalog = catalogFor(owner, name, "MyProtein", c -> {
            c.setKind("stim");
            c.setSource("myprotein.hu");
            c.setCategory("supplement"); // valid ck_pantry_catalog_category enum value
            c.setForm("por");
        });
        return itemFor(owner, catalog, e -> {
            e.setDose("5g");
            e.setProtocol("Naponta egy adag");
            e.setTiming("morning");
            e.setStockQty(new BigDecimal("86"));
            e.setStockUnit("adag");
        });
    }
}
