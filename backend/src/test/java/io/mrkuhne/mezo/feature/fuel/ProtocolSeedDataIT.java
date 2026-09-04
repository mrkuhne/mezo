package io.mrkuhne.mezo.feature.fuel;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.ProtocolItemCreateRequest;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.fuel.entity.ProtocolItemEntity;
import io.mrkuhne.mezo.feature.fuel.repository.ProtocolItemRepository;
import io.mrkuhne.mezo.feature.fuel.repository.ProtocolRepository;
import io.mrkuhne.mezo.feature.fuel.service.ProtocolService;
import io.mrkuhne.mezo.feature.pantry.repository.PantryItemRepository;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.PantryItemPopulator;
import java.math.BigDecimal;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/** The demodata protocol seeder: two real stim products by-name-idempotently + two engine-placed
 *  living-protocol occurrences, only when the owner has no active protocol yet — an existing
 *  active protocol is never touched (spec D6). */
class ProtocolSeedDataIT extends ApiIntegrationTest {

    @Autowired private ProtocolSeedData seed;
    @Autowired private PantryItemRepository pantryItemRepository;
    @Autowired private ProtocolRepository protocolRepository;
    @Autowired private ProtocolItemRepository protocolItemRepository;
    @Autowired private ProtocolService protocolService;
    @Autowired private AppUserRepository appUserRepository;
    @Autowired private OwnerProperties ownerProperties;
    @Autowired private PantryItemPopulator pantryItemPopulator;

    private UUID ownerId() {
        return appUserRepository.findByEmail(ownerProperties.ownerEmail()).orElseThrow().getId();
    }

    @Test
    void testRun_shouldSeedItemsAndAddEnginePlacedOccurrences_whenCleanSlate() {
        UUID owner = ownerId();
        seed.run();
        var items = pantryItemRepository.findByCreatedByAndDeletedFalseOrderByNameAsc(owner);
        var tasty = items.stream()
            .filter(i -> i.getCatalog().getName().equals(ProtocolSeedData.TASTY_DOSE_NAME)).findFirst().orElseThrow();
        var origin = items.stream()
            .filter(i -> i.getCatalog().getName().equals(ProtocolSeedData.ORIGIN_PWO_NAME)).findFirst().orElseThrow();
        assertThat(tasty.getCatalog().getKind()).isEqualTo("stim");
        assertThat(tasty.getCatalog().getCaffeine()).isTrue();
        assertThat(tasty.getDose()).isEqualTo("8 g");
        assertThat(tasty.getTiming()).isEqualTo("morning");
        assertThat(tasty.getStockQty()).isEqualByComparingTo(new BigDecimal("30"));
        assertThat(origin.getCatalog().getKind()).isEqualTo("stim");
        assertThat(origin.getCatalog().getCaffeine()).isTrue();
        assertThat(origin.getTiming()).isEqualTo("pre-workout");

        var active = protocolRepository
            .findByCreatedByAndStatusAndDeletedFalse(owner, "active").orElseThrow();
        // The exact starting version is an ensureActive/touch implementation detail (each addItem
        // bumps by 1 — ProtocolServiceIT's testTouch_... precedent); what matters here is placement.
        assertThat(active.getVersion()).isGreaterThanOrEqualTo(1);
        var placedItems = protocolItemRepository
            .findByProtocolIdAndDeletedFalseOrderByItemOrderAsc(active.getId());
        assertThat(placedItems)
            .extracting(ProtocolItemEntity::getPantryItemId)
            .containsExactly(tasty.getId(), origin.getId());
        // Tasty Dose gombakávé matches the rule table's "kávé" needle -> wake; Origin PWO matches
        // the "pwo" needle -> pre_workout (both are caffeine, but the name-rule table wins over the
        // shared caffeine=true flag — PlacementRules is ordered, kávé/koffein before pwo).
        assertThat(placedItems)
            .extracting(ProtocolItemEntity::getSlotKey)
            .containsExactly("wake", "pre_workout");
    }

    @Test
    void testRun_shouldStayIdempotent_whenRunTwice() {
        UUID owner = ownerId();
        seed.run();
        seed.run();
        var items = pantryItemRepository.findByCreatedByAndDeletedFalseOrderByNameAsc(owner);
        assertThat(items.stream()
            .filter(i -> i.getCatalog().getName().equals(ProtocolSeedData.TASTY_DOSE_NAME))).hasSize(1);
        assertThat(items.stream()
            .filter(i -> i.getCatalog().getName().equals(ProtocolSeedData.ORIGIN_PWO_NAME))).hasSize(1);
        assertThat(protocolRepository.findByCreatedByAndDeletedFalseOrderByVersionDesc(owner)).hasSize(1);
    }

    @Test
    void testRun_shouldSkipExistingItemByName_whenOwnerAlreadyHasIt() {
        UUID owner = ownerId();
        var existing = pantryItemPopulator.createStim(owner, ProtocolSeedData.TASTY_DOSE_NAME);
        seed.run();
        var sameName = pantryItemRepository.findByCreatedByAndDeletedFalseOrderByNameAsc(owner).stream()
            .filter(i -> i.getCatalog().getName().equals(ProtocolSeedData.TASTY_DOSE_NAME)).toList();
        assertThat(sameName).hasSize(1);
        assertThat(sameName.getFirst().getId()).isEqualTo(existing.getId());
        var active = protocolRepository
            .findByCreatedByAndStatusAndDeletedFalse(owner, "active").orElseThrow();
        assertThat(protocolItemRepository
            .findByProtocolIdAndDeletedFalseOrderByItemOrderAsc(active.getId()))
            .extracting(ProtocolItemEntity::getPantryItemId)
            .contains(existing.getId());
    }

    @Test
    void testRun_shouldNotTouchExistingActiveProtocol_whenOneExists() {
        UUID owner = ownerId();
        var mine = pantryItemPopulator.createStim(owner, "Sajat koffein");
        protocolService.addItem(owner, new ProtocolItemCreateRequest().pantryItemId(mine.getId()));
        seed.run();
        var all = protocolRepository.findByCreatedByAndDeletedFalseOrderByVersionDesc(owner);
        assertThat(all).hasSize(1);
        assertThat(protocolItemRepository
            .findByProtocolIdAndDeletedFalseOrderByItemOrderAsc(all.getFirst().getId()))
            .extracting(ProtocolItemEntity::getPantryItemId)
            .containsExactly(mine.getId());
        // items are still seeded even when the protocol is left alone
        assertThat(pantryItemRepository.findByCreatedByAndDeletedFalseOrderByNameAsc(owner).stream()
            .filter(i -> i.getCatalog().getName().equals(ProtocolSeedData.ORIGIN_PWO_NAME))).hasSize(1);
    }
}
