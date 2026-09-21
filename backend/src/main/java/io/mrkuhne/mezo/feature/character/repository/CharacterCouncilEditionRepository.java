package io.mrkuhne.mezo.feature.character.repository;

import io.mrkuhne.mezo.feature.character.entity.CharacterCouncilEditionEntity;
import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CharacterCouncilEditionRepository extends JpaRepository<CharacterCouncilEditionEntity, UUID> {
    Optional<CharacterCouncilEditionEntity> findByCreatedByAndDay(UUID createdBy, LocalDate day);
}
