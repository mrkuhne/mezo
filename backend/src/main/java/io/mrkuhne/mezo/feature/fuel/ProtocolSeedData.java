package io.mrkuhne.mezo.feature.fuel;

import io.mrkuhne.mezo.api.dto.ProtocolItemCreateRequest;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.auth.entity.AppUserEntity;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.fuel.repository.ProtocolRepository;
import io.mrkuhne.mezo.feature.fuel.service.ProtocolService;
import io.mrkuhne.mezo.feature.pantry.entity.PantryCatalogEntity;
import io.mrkuhne.mezo.feature.pantry.entity.PantryItemEntity;
import io.mrkuhne.mezo.feature.pantry.service.PantryCatalogService;
import io.mrkuhne.mezo.feature.pantry.repository.PantryItemRepository;
import java.math.BigDecimal;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Seeds the owner's two real stim products (Tasty Dose gombakávé + Origin PWO) and — only when the
 * owner has no active protocol yet — adds each as a living-protocol occurrence, engine-placed
 * (mezo-67rb, spec D6; reworked onto {@link ProtocolService#addItem} in mezo-vx9v Task 10 —
 * there is no whole-selection activate step anymore). The rule table places "Tasty Dose gombakávé"
 * (matches the {@code kávé} needle) at {@code wake} and "Origin PWO" (matches the {@code pwo}
 * needle) at {@code pre_workout}. {@code @Profile("demofixtures")} (S2, mezo-qw37.2): opt-in demo
 * content for the OWNER's account only — a plain {@code demodata} (prod) boot seeds no pantry rows
 * or protocol, so a registered user starts with an empty Kamra/Stack. Run with
 * {@code --spring.profiles.active=demodata,demofixtures} to load it (needs the demodata owner).
 * Idempotent by NAME per item (the shelf is curated —
 * {@code PantryCatalogLoader}'s empty-shelf guard would never fire here) and by active-protocol
 * presence; an existing active protocol is never touched. Runs after {@code PantryCatalogLoader} (50).
 */
@Slf4j
@Component
@Profile("demofixtures")
@Order(65)
@RequiredArgsConstructor
public class ProtocolSeedData implements CommandLineRunner {

    static final String TASTY_DOSE_NAME = "Tasty Dose gombakávé";
    static final String ORIGIN_PWO_NAME = "Origin PWO";

    private final AppUserRepository appUserRepository;
    private final OwnerProperties ownerProperties;
    private final PantryItemRepository pantryItemRepository;
    private final PantryCatalogService pantryCatalogService;
    private final ProtocolRepository protocolRepository;
    private final ProtocolService protocolService;

    @Override
    @Transactional
    public void run(String... args) {
        run();
    }

    /** No-arg overload — used by the integration test to re-run against a reset DB. */
    @Transactional
    public void run() {
        AppUserEntity owner = appUserRepository.findByEmail(ownerProperties.ownerEmail()).orElse(null);
        if (owner == null) {
            return; // no owner yet (non-demodata path) — nothing to seed
        }
        UUID ownerId = owner.getId();
        UUID tastyDose = ensureItem(ownerId, tastyDoseCatalog(), tastyDoseState());
        UUID originPwo = ensureItem(ownerId, originPwoCatalog(), originPwoState());
        if (protocolRepository.findByCreatedByAndStatusAndDeletedFalse(ownerId, "active").isEmpty()) {
            protocolService.addItem(ownerId, new ProtocolItemCreateRequest().pantryItemId(tastyDose));
            protocolService.addItem(ownerId, new ProtocolItemCreateRequest().pantryItemId(originPwo));
            log.info("protocol seed: added Tasty Dose (wake) + Origin PWO (pre_workout) occurrences (mezo-67rb)");
        }
    }

    /** By-name idempotency: an item whose catalog NAME the owner still has (however its
     *  stock/notes are edited) is never re-seeded — a renamed item would be seeded again as a new
     *  row. The definition goes through {@link PantryCatalogService#findOrCreate} (natural key,
     *  authored by the OWNER — never {@code created_by == null}, which would silently promote these
     *  two products into the loader's master catalog) and the shelf row through
     *  {@link PantryCatalogService#ensureItem} (one live row per owner+definition). */
    private UUID ensureItem(UUID ownerId, PantryCatalogEntity catalogCandidate, PantryItemEntity stateTemplate) {
        return pantryItemRepository.findByCreatedByAndDeletedFalseOrderByNameAsc(ownerId).stream()
            .filter(p -> catalogCandidate.getName().equals(p.getCatalog().getName()))
            .findFirst()
            .map(PantryItemEntity::getId)
            .orElseGet(() -> {
                PantryCatalogEntity catalog = pantryCatalogService.findOrCreate(ownerId, catalogCandidate);
                PantryItemEntity item = pantryCatalogService.ensureItem(ownerId, catalog.getId());
                item.setDose(stateTemplate.getDose());
                item.setStockQty(stateTemplate.getStockQty());
                item.setStockUnit(stateTemplate.getStockUnit());
                item.setProtocol(stateTemplate.getProtocol());
                item.setTiming(stateTemplate.getTiming());
                item.setNotes(stateTemplate.getNotes());
                return pantryItemRepository.save(item).getId();
            });
    }

    private PantryCatalogEntity tastyDoseCatalog() {
        PantryCatalogEntity c = new PantryCatalogEntity();
        c.setKind("stim");
        c.setName(TASTY_DOSE_NAME);
        c.setBrand("Tasty Dose");
        c.setSource("manual");
        c.setCategory("supplement"); // valid ck_pantry_catalog_category member — caffeine semantics live in kind+caffeine flag
        c.setForm("por · 1 púpozott mérőkanál · 200 ml forró vízbe");
        c.setCaffeine(true);
        c.setServingAmount(new BigDecimal("8"));
        c.setServingUnit("g");
        return c;
    }

    private PantryItemEntity tastyDoseState() {
        PantryItemEntity e = new PantryItemEntity();
        e.setDose("8 g");
        e.setStockQty(new BigDecimal("30"));
        e.setStockUnit("adag");
        e.setProtocol("Reggel, súlymérés után · 100 mg koffein/adag (guarana) · 14:00 cutoff");
        e.setTiming("morning");
        e.setNotes("Gomba-blend/adag: Tremella 504 mg · Lion's Mane 400 mg · Shiitake 250 mg · "
            + "Maitake 200 mg · Samsoniella 200 mg · Reishi 100 mg · Cordyceps 48 mg; "
            + "ashwagandha 160 mg · L-tirozin 150 mg · rhodiola 100 mg · magnézium 60 mg");
        return e;
    }

    private PantryCatalogEntity originPwoCatalog() {
        PantryCatalogEntity c = new PantryCatalogEntity();
        c.setKind("stim");
        c.setName(ORIGIN_PWO_NAME);
        c.setBrand("Origin");
        c.setSource("manual");
        c.setCategory("supplement"); // valid ck_pantry_catalog_category member — caffeine semantics live in kind+caffeine flag
        c.setForm("por · 1 napi adag · kékmálna");
        c.setCaffeine(true);
        c.setServingAmount(new BigDecimal("20"));
        c.setServingUnit("g");
        return c;
    }

    private PantryItemEntity originPwoState() {
        PantryItemEntity e = new PantryItemEntity();
        e.setDose("20 g");
        e.setStockQty(new BigDecimal("25")); // estimated, not from the label — correctable in the Kamra
        e.setStockUnit("adag");
        e.setProtocol("Pre-workout T-30min · 300 mg koffein/adag · 14:00 előtt");
        e.setTiming("pre-workout");
        e.setNotes("20 g adagonként: L-citrullin-DL-malát 8 g · AAKG 4 g · béta-alanin 3,5 g · L-teanin 250 mg");
        return e;
    }
}
