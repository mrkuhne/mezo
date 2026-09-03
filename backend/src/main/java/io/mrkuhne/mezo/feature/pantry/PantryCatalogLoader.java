package io.mrkuhne.mezo.feature.pantry;

import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.auth.entity.AppUserEntity;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.pantry.entity.PantryCatalogEntity;
import io.mrkuhne.mezo.feature.pantry.entity.PantryItemEntity;
import io.mrkuhne.mezo.feature.pantry.repository.PantryCatalogRepository;
import io.mrkuhne.mezo.feature.pantry.repository.PantryItemRepository;
import java.io.IOException;
import java.io.InputStream;
import java.math.BigDecimal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
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
@Slf4j
@Component
@Profile("demodata")
@Order(60)
@RequiredArgsConstructor
public class PantryCatalogLoader implements CommandLineRunner {

    private final PantryItemRepository repository;
    private final PantryCatalogRepository catalogRepository;
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
        BigDecimal stockQty, String stockUnit,
        Short nova) {}

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
        List<PantryItemEntity> existing = repository.findByCreatedByAndDeletedFalseOrderByNameAsc(ownerId);
        if (!existing.isEmpty()) {
            backfillNova(existing); // curated shelf stays untouched EXCEPT the additive nova backfill
            return;
        }
        for (CatalogRow row : readCatalog()) {
            repository.save(toEntity(ownerId, row));
        }
    }

    /**
     * mezo-32ko: the catalog originally shipped without NOVA classes, so live rows have
     * {@code nova = null} and both the meal score's NOVA dimension and the low-NOVA swap
     * suggestion degrade. Backfill is additive + idempotent: only rows whose name matches a
     * catalog row AND whose nova is still null get the catalog value — a user who has since
     * set/cleared nova by hand, renamed, or added items is never overwritten.
     */
    private void backfillNova(List<PantryItemEntity> existing) {
        Map<String, Short> catalogNova = new HashMap<>();
        for (CatalogRow row : readCatalog()) {
            if (row.nova() != null) catalogNova.put(row.name(), row.nova());
        }
        int updated = 0;
        for (PantryItemEntity e : existing) {
            Short nova = catalogNova.get(e.getCatalog().getName());
            if (e.getCatalog().getNova() == null && nova != null) {
                e.getCatalog().setNova(nova);
                catalogRepository.save(e.getCatalog());
                updated++;
            }
        }
        if (updated > 0) {
            log.info("pantry catalog nova backfill: {} row(s) updated (mezo-32ko)", updated);
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
        // Inline find-or-create by natural key — Task 5 swaps this for PantryCatalogService.
        PantryCatalogEntity catalogCandidate = new PantryCatalogEntity();
        catalogCandidate.setKind(r.kind());
        catalogCandidate.setName(r.name());
        catalogCandidate.setSource(r.source());
        catalogCandidate.setCategory(r.category());
        catalogCandidate.setServingAmount(r.per());
        catalogCandidate.setServingUnit(r.unit());
        catalogCandidate.setKcal(r.kcal());
        catalogCandidate.setProteinG(r.proteinG());
        catalogCandidate.setCarbsG(r.carbsG());
        catalogCandidate.setFatG(r.fatG());
        catalogCandidate.setFiberG(r.fiberG());
        catalogCandidate.setSugarG(r.sugarG());
        catalogCandidate.setSaltG(r.saltG());
        catalogCandidate.setSaturatedFatG(r.saturatedFatG());
        catalogCandidate.setPackageLabel(r.packageLabel());
        catalogCandidate.setNova(r.nova());
        PantryCatalogEntity catalog = catalogRepository
            .findByNaturalKey(catalogCandidate.getName(), catalogCandidate.getBrand())
            .orElseGet(() -> catalogRepository.save(catalogCandidate));

        PantryItemEntity e = new PantryItemEntity();
        e.setCreatedBy(ownerId);
        e.setCatalog(catalog);
        e.setPriceHuf(r.priceHuf());
        e.setStockQty(r.stockQty());
        e.setStockUnit(r.stockUnit());
        return e;
    }
}
