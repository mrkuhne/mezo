package io.mrkuhne.mezo.feature.character.repository;

import io.mrkuhne.mezo.feature.character.entity.CharacterClaimEntity;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CharacterClaimRepository extends JpaRepository<CharacterClaimEntity, UUID> {

    List<CharacterClaimEntity> findByCreatedByAndDimensionIdAndStatusOrderByConfidenceDesc(
            UUID createdBy, UUID dimensionId, String status);

    /** Every ACTIVE claim for an owner, across all dimensions (Karakter spec §6, mezo-1gim.5) —
     *  the konzílium round's "meglévő aktív állítások" context, filtered per expert by dimension. */
    List<CharacterClaimEntity> findByCreatedByAndStatusOrderByConfidenceDesc(UUID createdBy, String status);
}
