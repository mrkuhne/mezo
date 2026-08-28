package io.mrkuhne.mezo.feature.character.repository;

import io.mrkuhne.mezo.feature.character.entity.CharacterClaimEntity;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CharacterClaimRepository extends JpaRepository<CharacterClaimEntity, UUID> {

    List<CharacterClaimEntity> findByCreatedByAndDimensionIdAndStatusOrderByConfidenceDesc(
            UUID createdBy, UUID dimensionId, String status);
}
