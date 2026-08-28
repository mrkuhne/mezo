package io.mrkuhne.mezo.feature.character.repository;

import io.mrkuhne.mezo.feature.character.entity.CharacterObservationEntity;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CharacterObservationRepository extends JpaRepository<CharacterObservationEntity, UUID> {

    List<CharacterObservationEntity> findByCreatedByOrderByDayDescCreatedAtDesc(UUID createdBy, Pageable pageable);
}
