package io.mrkuhne.mezo.feature.fuel;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.ProtocolActivateRequest;
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
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/** The demodata protocol seeder: two real stim products by-name-idempotently + a v1 protocol
 *  only when the owner has none — an existing active protocol is never touched (spec D6). */
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
    void testRun_shouldSeedItemsAndActivateProtocol_whenCleanSlate() {
        UUID owner = ownerId();
        seed.run();
        var items = pantryItemRepository.findByCreatedByAndDeletedFalseOrderByNameAsc(owner);
        var tasty = items.stream()
            .filter(i -> i.getName().equals(ProtocolSeedData.TASTY_DOSE_NAME)).findFirst().orElseThrow();
        var origin = items.stream()
            .filter(i -> i.getName().equals(ProtocolSeedData.ORIGIN_PWO_NAME)).findFirst().orElseThrow();
        assertThat(tasty.getKind()).isEqualTo("stim");
        assertThat(tasty.getCaffeine()).isTrue();
        assertThat(tasty.getDose()).isEqualTo("8 g");
        assertThat(tasty.getTiming()).isEqualTo("morning");
        assertThat(tasty.getStockQty()).isEqualByComparingTo(new BigDecimal("30"));
        assertThat(origin.getKind()).isEqualTo("stim");
        assertThat(origin.getCaffeine()).isTrue();
        assertThat(origin.getTiming()).isEqualTo("pre-workout");

        var active = protocolRepository
            .findByCreatedByAndStatusAndDeletedFalse(owner, "active").orElseThrow();
        assertThat(active.getVersion()).isEqualTo(1);
        assertThat(active.getLastReplanReason()).isEqualTo(ProtocolSeedData.SEED_REASON);
        assertThat(protocolItemRepository
            .findByProtocolIdAndDeletedFalseOrderByItemOrderAsc(active.getId()))
            .extracting(ProtocolItemEntity::getPantryItemId)
            .containsExactly(tasty.getId(), origin.getId());
    }

    @Test
    void testRun_shouldStayIdempotent_whenRunTwice() {
        UUID owner = ownerId();
        seed.run();
        seed.run();
        var items = pantryItemRepository.findByCreatedByAndDeletedFalseOrderByNameAsc(owner);
        assertThat(items.stream()
            .filter(i -> i.getName().equals(ProtocolSeedData.TASTY_DOSE_NAME))).hasSize(1);
        assertThat(items.stream()
            .filter(i -> i.getName().equals(ProtocolSeedData.ORIGIN_PWO_NAME))).hasSize(1);
        assertThat(protocolRepository.findByCreatedByAndDeletedFalseOrderByVersionDesc(owner)).hasSize(1);
    }

    @Test
    void testRun_shouldSkipExistingItemByName_whenOwnerAlreadyHasIt() {
        UUID owner = ownerId();
        var existing = pantryItemPopulator.createStim(owner, ProtocolSeedData.TASTY_DOSE_NAME);
        seed.run();
        var sameName = pantryItemRepository.findByCreatedByAndDeletedFalseOrderByNameAsc(owner).stream()
            .filter(i -> i.getName().equals(ProtocolSeedData.TASTY_DOSE_NAME)).toList();
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
        protocolService.activate(owner, new ProtocolActivateRequest()
            .selectedPantryItemIds(List.of(mine.getId())).reason("user protocol"));
        seed.run();
        var all = protocolRepository.findByCreatedByAndDeletedFalseOrderByVersionDesc(owner);
        assertThat(all).hasSize(1);
        assertThat(all.getFirst().getVersion()).isEqualTo(1);
        assertThat(all.getFirst().getLastReplanReason()).isEqualTo("user protocol");
        assertThat(protocolItemRepository
            .findByProtocolIdAndDeletedFalseOrderByItemOrderAsc(all.getFirst().getId()))
            .extracting(ProtocolItemEntity::getPantryItemId)
            .containsExactly(mine.getId());
        // items are still seeded even when the protocol is left alone
        assertThat(pantryItemRepository.findByCreatedByAndDeletedFalseOrderByNameAsc(owner).stream()
            .filter(i -> i.getName().equals(ProtocolSeedData.ORIGIN_PWO_NAME))).hasSize(1);
    }
}
