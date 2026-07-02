package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.fuel.entity.ProtocolEntity;
import io.mrkuhne.mezo.feature.fuel.entity.ProtocolItemEntity;
import io.mrkuhne.mezo.feature.fuel.repository.ProtocolItemRepository;
import io.mrkuhne.mezo.feature.fuel.repository.ProtocolRepository;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;

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
}
