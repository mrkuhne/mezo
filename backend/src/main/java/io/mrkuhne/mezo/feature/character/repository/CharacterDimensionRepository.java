package io.mrkuhne.mezo.feature.character.repository;

import io.mrkuhne.mezo.feature.character.entity.CharacterDimensionEntity;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CharacterDimensionRepository extends JpaRepository<CharacterDimensionEntity, UUID> {

    List<CharacterDimensionEntity> findByCreatedBy(UUID createdBy);

    Optional<CharacterDimensionEntity> findByCreatedByAndKey(UUID createdBy, String key);

    Optional<CharacterDimensionEntity> findByIdAndCreatedBy(UUID id, UUID createdBy);
}
// NOTE: display order is NOT alphabetical — the service sorts CORE rows by
// CharacterCoreCatalog index, then CHAPTER rows by createdAt (the UI's order).
