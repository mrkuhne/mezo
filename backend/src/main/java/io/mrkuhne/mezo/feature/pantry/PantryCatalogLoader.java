package io.mrkuhne.mezo.feature.pantry;

import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.auth.entity.AppUserEntity;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.pantry.entity.PantryItemEntity;
import io.mrkuhne.mezo.feature.pantry.repository.PantryItemRepository;
import java.io.IOException;
import java.io.InputStream;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.core.annotation.Order;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

/**
 * Seeds the owner's pantry with the imported real-world catalog ({@code seed/pantry-catalog.json},
 * 146 items exported from the user's previous app) on startup. {@code @Profile("demodata")} — the
 * profile prod runs — so the catalog lands in prod for the single owner. Idempotent: only seeds when
 * the owner currently has no pantry items, so a restart never duplicates and a user who has since
 * curated their shelf is left untouched. Runs after {@link io.mrkuhne.mezo.feature.auth.OwnerSeedData}
 * (Order 0) so the owner exists.
 */
@Component
@Profile("demodata")
@Order(60)
@RequiredArgsConstructor
public class PantryCatalogLoader implements CommandLineRunner {

    private final PantryItemRepository repository;
    private final AppUserRepository appUserRepository;
    private final OwnerProperties ownerProperties;
    private final ObjectMapper objectMapper; // SB4 Jackson 3 (tools.jackson)

    /** One catalog row as authored in seed/pantry-catalog.json. */
    public record CatalogRow(
        String name, String kind, String source, String category,
        BigDecimal per, String unit,
        BigDecimal kcal, BigDecimal proteinG, BigDecimal carbsG, BigDecimal fatG,
        BigDecimal fiberG, BigDecimal sugarG, BigDecimal saltG, BigDecimal saturatedFatG,
        Integer priceHuf, String packageLabel,
        BigDecimal stockQty, String stockUnit) {}

    @Override
    @Transactional
    public void run(String... args) {
        run();
    }

    /** No-arg overload — used by the integration test to re-run against a clean DB. */
    @Transactional
    public void run() {
        AppUserEntity owner = appUserRepository.findByEmail(ownerProperties.ownerEmail()).orElse(null);
        if (owner == null) {
            return; // no owner yet (non-demodata path) — nothing to seed
        }
        UUID ownerId = owner.getId();
        if (!repository.findByCreatedByAndDeletedFalseOrderByNameAsc(ownerId).isEmpty()) {
            return; // owner already has a pantry — leave it untouched (idempotent)
        }
        for (CatalogRow row : readCatalog()) {
            repository.save(toEntity(ownerId, row));
        }
    }

    private List<CatalogRow> readCatalog() {
        try (InputStream in = new ClassPathResource("seed/pantry-catalog.json").getInputStream()) {
            return objectMapper.readValue(in,
                objectMapper.getTypeFactory().constructCollectionType(List.class, CatalogRow.class));
        } catch (IOException e) {
            throw new IllegalStateException("seed/pantry-catalog.json is unreadable", e);
        }
    }

    private PantryItemEntity toEntity(UUID ownerId, CatalogRow r) {
        PantryItemEntity e = new PantryItemEntity();
        e.setCreatedBy(ownerId);
        e.setKind(r.kind());
        e.setName(r.name());
        e.setSource(r.source());
        e.setCategory(r.category());
        e.setServingAmount(r.per());
        e.setServingUnit(r.unit());
        e.setKcal(r.kcal());
        e.setProteinG(r.proteinG());
        e.setCarbsG(r.carbsG());
        e.setFatG(r.fatG());
        e.setFiberG(r.fiberG());
        e.setSugarG(r.sugarG());
        e.setSaltG(r.saltG());
        e.setSaturatedFatG(r.saturatedFatG());
        e.setPriceHuf(r.priceHuf());
        e.setPackageLabel(r.packageLabel());
        e.setStockQty(r.stockQty());
        e.setStockUnit(r.stockUnit());
        return e;
    }
}
