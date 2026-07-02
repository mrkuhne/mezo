package io.mrkuhne.mezo.feature.fuel.repository;

import io.mrkuhne.mezo.feature.fuel.entity.ProtocolItemEntity;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * The normalized selection rows of a {@link ProtocolItemEntity protocol}. Reads are protocol-scoped
 * and ordered by {@code itemOrder} to reconstruct the built stack in position order; soft-delete is
 * respected.
 */
public interface ProtocolItemRepository extends JpaRepository<ProtocolItemEntity, UUID> {

    List<ProtocolItemEntity> findByProtocolIdAndDeletedFalseOrderByItemOrderAsc(UUID protocolId);
}
