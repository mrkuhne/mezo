package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.pantry.entity.PantryCatalogEntity;
import io.mrkuhne.mezo.feature.pantry.repository.PantryCatalogRepository;
import java.math.BigDecimal;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;

/** Test data factory for the shared pantry definition (S4). Find-or-create by natural key — never collides on uq_pantry_catalog_natural. */
@TestComponent
@RequiredArgsConstructor
public class PantryCatalogPopulator {

    private final PantryCatalogRepository repository;

    /** A per-100 g food definition authored by {@code author} (null = master row). */
    public PantryCatalogEntity createFoodDefinition(UUID author, String name, String brand) {
        return repository.findByNaturalKey(name, brand).orElseGet(() -> {
            PantryCatalogEntity c = new PantryCatalogEntity();
            c.setCreatedBy(author);
            c.setKind("food");
            c.setName(name);
            c.setBrand(brand);
            c.setSource("manual");
            c.setCategory("other");
            c.setServingAmount(new BigDecimal("100"));
            c.setServingUnit("g");
            c.setKcal(new BigDecimal("110"));
            c.setProteinG(new BigDecimal("23.0"));
            c.setCarbsG(BigDecimal.ZERO);
            c.setFatG(new BigDecimal("1.5"));
            c.setNova((short) 1);
            return repository.saveAndFlush(c);
        });
    }

    /** A loader-style master row (created_by NULL) — survives ResetDatabase like the loader's own rows. */
    public PantryCatalogEntity createMasterFood(String name) {
        return createFoodDefinition(null, name, null);
    }
}
