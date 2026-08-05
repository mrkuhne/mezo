package io.mrkuhne.mezo.feature.fuel;

import io.mrkuhne.mezo.api.dto.ProtocolItemCreateRequest;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.auth.entity.AppUserEntity;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.fuel.repository.ProtocolRepository;
import io.mrkuhne.mezo.feature.fuel.service.ProtocolService;
import io.mrkuhne.mezo.feature.pantry.entity.PantryItemEntity;
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
 * needle) at {@code pre_workout}. {@code @Profile("demodata")} is the profile prod runs, so the
 * rows land on the live DB at the next deploy. Idempotent by NAME per item (the shelf is curated —
 * {@code PantryCatalogLoader}'s empty-shelf guard would never fire here) and by active-protocol
 * presence; an existing active protocol is never touched. Runs after {@code PantryCatalogLoader} (60).
 */
@Slf4j
@Component
@Profile("demodata")
@Order(65)
@RequiredArgsConstructor
public class ProtocolSeedData implements CommandLineRunner {

    static final String TASTY_DOSE_NAME = "Tasty Dose gombakávé";
    static final String ORIGIN_PWO_NAME = "Origin PWO";

    private final AppUserRepository appUserRepository;
    private final OwnerProperties ownerProperties;
    private final PantryItemRepository pantryItemRepository;
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
        UUID tastyDose = ensureItem(ownerId, tastyDose(ownerId));
        UUID originPwo = ensureItem(ownerId, originPwo(ownerId));
        if (protocolRepository.findByCreatedByAndStatusAndDeletedFalse(ownerId, "active").isEmpty()) {
            protocolService.addItem(ownerId, new ProtocolItemCreateRequest().pantryItemId(tastyDose));
            protocolService.addItem(ownerId, new ProtocolItemCreateRequest().pantryItemId(originPwo));
            log.info("protocol seed: added Tasty Dose (wake) + Origin PWO (pre_workout) occurrences (mezo-67rb)");
        }
    }

    /** By-name idempotency: an item whose NAME the owner still has (however its stock/notes are
     *  edited) is never re-seeded — a renamed item would be seeded again as a new row. */
    private UUID ensureItem(UUID ownerId, PantryItemEntity candidate) {
        return pantryItemRepository.findByCreatedByAndDeletedFalseOrderByNameAsc(ownerId).stream()
            .filter(p -> candidate.getName().equals(p.getName()))
            .findFirst()
            .map(PantryItemEntity::getId)
            .orElseGet(() -> pantryItemRepository.save(candidate).getId());
    }

    private PantryItemEntity tastyDose(UUID ownerId) {
        PantryItemEntity e = new PantryItemEntity();
        e.setCreatedBy(ownerId);
        e.setKind("stim");
        e.setName(TASTY_DOSE_NAME);
        e.setBrand("Tasty Dose");
        e.setSource("manual");
        e.setCategory("supplement"); // valid ck_pantry_item_category member — caffeine semantics live in kind+caffeine flag
        e.setDose("8 g");
        e.setForm("por · 1 púpozott mérőkanál · 200 ml forró vízbe");
        e.setStockQty(new BigDecimal("30"));
        e.setStockUnit("adag");
        e.setProtocol("Reggel, súlymérés után · 100 mg koffein/adag (guarana) · 14:00 cutoff");
        e.setTiming("morning");
        e.setCaffeine(true);
        e.setServingAmount(new BigDecimal("8"));
        e.setServingUnit("g");
        e.setNotes("Gomba-blend/adag: Tremella 504 mg · Lion's Mane 400 mg · Shiitake 250 mg · "
            + "Maitake 200 mg · Samsoniella 200 mg · Reishi 100 mg · Cordyceps 48 mg; "
            + "ashwagandha 160 mg · L-tirozin 150 mg · rhodiola 100 mg · magnézium 60 mg");
        return e;
    }

    private PantryItemEntity originPwo(UUID ownerId) {
        PantryItemEntity e = new PantryItemEntity();
        e.setCreatedBy(ownerId);
        e.setKind("stim");
        e.setName(ORIGIN_PWO_NAME);
        e.setBrand("Origin");
        e.setSource("manual");
        e.setCategory("supplement"); // valid ck_pantry_item_category member — caffeine semantics live in kind+caffeine flag
        e.setDose("20 g");
        e.setForm("por · 1 napi adag · kékmálna");
        e.setStockQty(new BigDecimal("25")); // estimated, not from the label — correctable in the Kamra
        e.setStockUnit("adag");
        e.setProtocol("Pre-workout T-30min · 300 mg koffein/adag · 14:00 előtt");
        e.setTiming("pre-workout");
        e.setCaffeine(true);
        e.setServingAmount(new BigDecimal("20"));
        e.setServingUnit("g");
        e.setNotes("20 g adagonként: L-citrullin-DL-malát 8 g · AAKG 4 g · béta-alanin 3,5 g · L-teanin 250 mg");
        return e;
    }
}
