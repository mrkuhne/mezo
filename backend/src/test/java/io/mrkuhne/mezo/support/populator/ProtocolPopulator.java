package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.fuel.entity.ProtocolEntity;
import io.mrkuhne.mezo.feature.fuel.entity.ProtocolItemEntity;
import io.mrkuhne.mezo.feature.fuel.repository.ProtocolItemRepository;
import io.mrkuhne.mezo.feature.fuel.repository.ProtocolRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;
import org.springframework.transaction.annotation.Transactional;

/**
 * Test data factory for the Protocol aggregate — persists the protocol row plus its normalized
 * {@code protocol_item} selection (one row per {@code pantryItemIds} entry, {@code itemOrder} = list
 * index) via {@code saveAndFlush} so DB CHECKs and FKs fire.
 */
@TestComponent
@RequiredArgsConstructor
public class ProtocolPopulator {

    private final ProtocolRepository protocolRepository;
    private final ProtocolItemRepository protocolItemRepository;

    /** JPA-managed shared EntityManager — the {@code created_at} backdate needs a native update;
     *  field-injected {@code @PersistenceContext} is the house exception to constructor DI
     *  (see {@code FlagLogPopulator}). */
    @PersistenceContext
    private EntityManager em;

    /** A protocol at {@code version}/{@code status} owning one item per pantry id, in list order. */
    public ProtocolEntity createProtocol(UUID owner, int version, String status, List<UUID> pantryItemIds) {
        ProtocolEntity protocol = new ProtocolEntity();
        protocol.setCreatedBy(owner);
        protocol.setVersion(version);
        protocol.setBuiltAt(Instant.now());
        protocol.setStatus(status);
        protocol.setConfidence(new BigDecimal("0.86"));
        ProtocolEntity saved = protocolRepository.saveAndFlush(protocol);

        for (int i = 0; i < pantryItemIds.size(); i++) {
            ProtocolItemEntity item = new ProtocolItemEntity();
            item.setCreatedBy(owner);
            item.setProtocolId(saved.getId());
            item.setPantryItemId(pantryItemIds.get(i));
            item.setItemOrder(i);
            protocolItemRepository.saveAndFlush(item);
        }
        return saved;
    }

    /** A bare active protocol (version 1) with no items yet — items are added separately via
     *  {@link #createProtocolItem}. */
    public ProtocolEntity createActiveProtocol(UUID owner) {
        return createProtocol(owner, 1, "active", List.of());
    }

    /** One normalized selection row on an existing protocol, at the next free {@code itemOrder}. */
    public ProtocolItemEntity createProtocolItem(
        UUID owner, UUID protocolId, UUID pantryItemId, String slotKey, String restDayFallback) {
        int itemOrder = protocolItemRepository.findByProtocolIdAndDeletedFalseOrderByItemOrderAsc(protocolId).size();
        ProtocolItemEntity item = new ProtocolItemEntity();
        item.setCreatedBy(owner);
        item.setProtocolId(protocolId);
        item.setPantryItemId(pantryItemId);
        item.setItemOrder(itemOrder);
        item.setSlotKey(slotKey);
        item.setRestDayFallback(restDayFallback);
        return protocolItemRepository.saveAndFlush(item);
    }

    /** A protocol item with a controlled {@code created_at} — the protocol_lapse rule bounds its
     *  scan below by the item's own start date, so an item that "started today" can never have a
     *  history ({@code TrainPopulator.createGymSlotAt} precedent). */
    @Transactional
    public ProtocolItemEntity createProtocolItemAt(
        UUID owner, UUID protocolId, UUID pantryItemId, String slotKey, String restDayFallback,
        Instant createdAt) {
        ProtocolItemEntity item = createProtocolItem(owner, protocolId, pantryItemId, slotKey, restDayFallback);
        em.createNativeQuery("update protocol_item set created_at = :at where id = :id")
            .setParameter("at", createdAt).setParameter("id", item.getId()).executeUpdate();
        em.clear();
        return protocolItemRepository.findById(item.getId()).orElseThrow();
    }
}
