package io.mrkuhne.mezo.feature.character.repository;

import io.mrkuhne.mezo.feature.character.entity.CharacterPortraitRevisionEntity;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CharacterPortraitRevisionRepository
        extends JpaRepository<CharacterPortraitRevisionEntity, UUID> {

    List<CharacterPortraitRevisionEntity> findByCreatedByAndDimensionIdOrderByVersionDesc(
            UUID createdBy, UUID dimensionId);
}
