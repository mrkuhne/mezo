package io.mrkuhne.mezo.feature.pantry;

import io.mrkuhne.mezo.feature.nutrition.service.AllergenState;
import io.mrkuhne.mezo.feature.pantry.entity.PantryCatalogEntity;
import io.mrkuhne.mezo.feature.pantry.repository.PantryCatalogRepository;
import io.mrkuhne.mezo.feature.pantry.service.CatalogAllergenDefaults;
import java.util.HashMap;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Egyszeri adatjavítás (mezo-r36n9.48, owner decision 2026-11-13): a katalógus allergén-rovata
 * minden élő soron ÜRES volt (448/448, éles ellenőrzés 2026-11-13), ezért egy halas vagy tojásos
 * recept allergénmentesnek összegződött. Ez a futó kitölti azt, amit a polc — és ahol a polc
 * vegyes, a név — biztosan megmond; a szabályok a {@link CatalogAllergenDefaults}-ban élnek, és
 * ugyanazok szolgálják a később felvitt sorokat is.
 *
 * <p><b>Idempotens és fill-only.</b> Csak az a sor változik, amelyik még semmit nem mond: egy
 * vonalkódról beolvasott, importált vagy kézzel megadott allergén-állapot mindig erősebb annál,
 * amit a kategória sejtet, ezért érintetlen marad. Soha nem ír „nem tartalmaz"-t semmiről: amit nem
 * nevez meg, az hiányzik, azt pedig minden olvasó „nincs adat"-ként kezeli.
 *
 * <p>{@code @Order(52)}: a {@link PantryCatalogLoader} (50) és a
 * {@link PantryTwinSaturatedFatRunner} (51) UTÁN — előbb legyen mit címkézni —, és a
 * {@code RecipeAllergenRecomputeRunner} (53) ELŐTT, amely az így feltöltött katalógusból számolja
 * újra a már mentett receptek összegzését. Egy indulás, teljes lánc.
 */
@Slf4j
@Component
@Profile("demodata")
@Order(52)
@RequiredArgsConstructor
public class PantryCatalogAllergenBaselineRunner implements CommandLineRunner {

    private final PantryCatalogRepository repository;

    // @Transactional a belépési ponton is: a `backfill()` innen self-invocation, ami megkerüli a
    // proxyt (a PantryTwinSaturatedFatRunner / mezo-1f7b tanulsága).
    @Override
    @Transactional
    public void run(String... args) {
        backfill();
    }

    /** No-arg, tranzakciós overload — az integrációs teszt belépési pontja. Visszaadja a módosított sorok számát. */
    @Transactional
    public int backfill() {
        int allergens = 0;
        int lactoseFree = 0;
        for (PantryCatalogEntity row : repository.findAll()) {
            boolean changed = false;
            if (row.getAllergens() == null || row.getAllergens().isEmpty()) {
                Map<String, AllergenState> derived =
                    CatalogAllergenDefaults.derive(row.getCategory(), row.getName());
                if (!derived.isEmpty()) {
                    row.setAllergens(new HashMap<>(derived));
                    allergens++;
                    changed = true;
                }
            }
            if (!row.isLactoseFree() && CatalogAllergenDefaults.isLactoseFree(row.getName())) {
                row.setLactoseFree(true);
                lactoseFree++;
                changed = true;
            }
            if (changed) {
                repository.save(row);
            }
        }
        if (allergens > 0 || lactoseFree > 0) {
            // Flush HERE, not at the caller's commit: the recipe recompute that follows reads these
            // rows back, and a caller that keeps the persistence context open (an integration test)
            // would otherwise see the pre-backfill catalog.
            repository.flush();
            log.info("pantry catalog: {} sor kapott alap-allergént a polcából, {} sor laktózmentes "
                + "jelölést a nevéből (mezo-r36n9.48)", allergens, lactoseFree);
        }
        return allergens + lactoseFree;
    }
}
