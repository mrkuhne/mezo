package io.mrkuhne.mezo.feature.pantry;

import io.mrkuhne.mezo.feature.pantry.entity.PantryCatalogEntity;
import io.mrkuhne.mezo.feature.pantry.repository.PantryCatalogRepository;
import java.io.IOException;
import java.io.InputStream;
import java.math.BigDecimal;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.function.Consumer;
import java.util.function.Supplier;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

/**
 * Master-content loader for the shared pantry catalog (S4, mezo-qw37.4 — the ExerciseCatalogLoader
 * shape): runs in EVERY profile, upserts {@code seed/pantry-catalog.json} (147 definitions) into
 * {@code pantry_catalog} by natural key with {@code created_by = NULL}. A natural-key hit is CLAIMED
 * as master (a migrated owner row, or a user who typed the same food) and only its NULL definition
 * fields are filled — a curated value is never overwritten. It never creates a {@code pantry_item}:
 * a user's shelf starts empty and grows from the catalog ("Hozzáadás a közösből").
 */
@Slf4j
@Component
@Order(50)
@RequiredArgsConstructor
public class PantryCatalogLoader implements CommandLineRunner {

    private final PantryCatalogRepository repository;
    private final ObjectMapper objectMapper; // SB4 Jackson 3 (tools.jackson)

    /** One row as authored in seed/pantry-catalog.json. priceHuf/stockQty/stockUnit are per-user facts — read, ignored. */
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

    /** No-arg overload — used by the IT to re-run against a drifted DB. */
    @Transactional
    public void run() {
        Map<String, PantryCatalogEntity> byKey = new HashMap<>();
        repository.findAll().forEach(c -> byKey.put(naturalKey(c.getName(), c.getBrand()), c));
        int inserted = 0;
        int claimed = 0;
        for (CatalogRow row : readCatalog()) {
            String key = naturalKey(row.name(), null);
            PantryCatalogEntity hit = byKey.get(key);
            if (hit == null) {
                PantryCatalogEntity c = new PantryCatalogEntity();
                c.setName(row.name());
                fill(c, row, true);
                byKey.put(key, repository.save(c));
                inserted++;
                continue;
            }
            if (!hit.isMaster() || hit.isDeleted()) {
                hit.setCreatedBy(null);
                hit.setDeleted(false);
                claimed++;
            }
            fill(hit, row, false); // NULL-only backfill (the mezo-32ko nova rule, generalized)
            repository.save(hit);
        }
        if (inserted > 0 || claimed > 0) {
            log.info("pantry catalog: {} master row(s) inserted, {} claimed (mezo-qw37.4)", inserted, claimed);
        }
    }

    /** {@code overwrite=true} for a new row; otherwise only NULL fields take the seed value. */
    private static void fill(PantryCatalogEntity c, CatalogRow r, boolean overwrite) {
        set(overwrite, c::getKind, c::setKind, r.kind());
        set(overwrite, c::getSource, c::setSource, r.source());
        set(overwrite, c::getCategory, c::setCategory, r.category());
        set(overwrite, c::getServingAmount, c::setServingAmount, r.per());
        set(overwrite, c::getServingUnit, c::setServingUnit, r.unit());
        set(overwrite, c::getKcal, c::setKcal, r.kcal());
        set(overwrite, c::getProteinG, c::setProteinG, r.proteinG());
        set(overwrite, c::getCarbsG, c::setCarbsG, r.carbsG());
        set(overwrite, c::getFatG, c::setFatG, r.fatG());
        set(overwrite, c::getFiberG, c::setFiberG, r.fiberG());
        set(overwrite, c::getSugarG, c::setSugarG, r.sugarG());
        set(overwrite, c::getSaltG, c::setSaltG, r.saltG());
        set(overwrite, c::getSaturatedFatG, c::setSaturatedFatG, r.saturatedFatG());
        set(overwrite, c::getPackageLabel, c::setPackageLabel, r.packageLabel());
        set(overwrite, c::getNova, c::setNova, r.nova());
    }

    private static <T> void set(boolean overwrite, Supplier<T> getter, Consumer<T> setter, T seed) {
        if (seed == null) return;
        if (overwrite || getter.get() == null) setter.accept(seed);
    }

    /**
     * Mirrors {@code uq_pantry_catalog_natural}: {@code lower(name)} + {@code lower(coalesce(brand,''))}.
     * Uses {@link Locale#ROOT} deliberately — the default JVM locale (e.g. Turkish "i") lowercases
     * differently and would desync this key from the DB's SQL {@code lower()}.
     */
    static String naturalKey(String name, String brand) {
        return name.strip().toLowerCase(Locale.ROOT) + "|"
            + (brand == null ? "" : brand.strip().toLowerCase(Locale.ROOT));
    }

    private List<CatalogRow> readCatalog() {
        try (InputStream in = new ClassPathResource("seed/pantry-catalog.json").getInputStream()) {
            return objectMapper.readValue(in,
                objectMapper.getTypeFactory().constructCollectionType(List.class, CatalogRow.class));
        } catch (IOException e) {
            throw new IllegalStateException("seed/pantry-catalog.json is unreadable", e);
        }
    }
}
