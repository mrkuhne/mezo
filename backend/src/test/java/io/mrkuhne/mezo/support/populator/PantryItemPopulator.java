package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.pantry.entity.MicroFact;
import io.mrkuhne.mezo.feature.pantry.entity.PantryItemEntity;
import io.mrkuhne.mezo.feature.pantry.repository.PantryItemRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;

/** Test data factory for the PantryItem aggregate — persists via {@code saveAndFlush} so DB CHECKs fire. */
@TestComponent
@RequiredArgsConstructor
public class PantryItemPopulator {

    private final PantryItemRepository repository;

    /** A food row with macros, stock + expiry, NOVA, and one micro. */
    public PantryItemEntity createFood(UUID owner, String name, LocalDate expires) {
        PantryItemEntity e = new PantryItemEntity();
        e.setCreatedBy(owner);
        e.setKind("food");
        e.setName(name);
        e.setBrand("Bonafarm");
        e.setSource("kifli.hu");
        e.setCategory("meat"); // valid ck_pantry_item_category enum value
        e.setServingAmount(new BigDecimal("100"));
        e.setServingUnit("g");
        e.setKcal(new BigDecimal("110"));
        e.setProteinG(new BigDecimal("23.0"));
        e.setCarbsG(BigDecimal.ZERO);
        e.setFatG(new BigDecimal("1.5"));
        e.setNova((short) 1);
        e.setMicros(List.of(new MicroFact("B6", 92)));
        e.setStockQty(new BigDecimal("400"));
        e.setStockUnit("g");
        e.setStockExpires(expires);
        return repository.saveAndFlush(e);
    }

    /** A minimal food row with an explicit category, price and NOVA — the suggestion-heuristic fixture (P6). */
    public PantryItemEntity createPricedFood(UUID owner, String name, String category,
                                             Integer priceHuf, String priceUnit, Short nova) {
        PantryItemEntity e = new PantryItemEntity();
        e.setCreatedBy(owner);
        e.setKind("food");
        e.setName(name);
        e.setSource("manual");
        e.setCategory(category);
        e.setServingAmount(new BigDecimal("100"));
        e.setServingUnit("g");
        e.setKcal(new BigDecimal("100"));
        e.setPriceHuf(priceHuf);
        e.setPriceUnit(priceUnit);
        e.setNova(nova);
        return repository.saveAndFlush(e);
    }

    /** A supplement row with dose + protocol + stock-as-doses. */
    public PantryItemEntity createSupplement(UUID owner, String name) {
        PantryItemEntity e = new PantryItemEntity();
        e.setCreatedBy(owner);
        e.setKind("supplement");
        e.setName(name);
        e.setBrand("MyProtein");
        e.setSource("myprotein.hu");
        e.setCategory("supplement"); // valid ck_pantry_item_category enum value
        e.setDose("5g");
        e.setForm("por");
        e.setProtocol("Naponta egy adag");
        e.setTiming("morning");
        e.setStockQty(new BigDecimal("86"));
        e.setStockUnit("adag");
        return repository.saveAndFlush(e);
    }
}
