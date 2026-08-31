package io.mrkuhne.mezo.feature.character.repository;

import io.mrkuhne.mezo.feature.character.entity.CharacterRunEntity;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CharacterRunRepository extends JpaRepository<CharacterRunEntity, UUID> {

    /** The idempotency lookup {@link io.mrkuhne.mezo.feature.character.service.CharacterRunLog}
     *  keys its no-op on: a live row for {@code (created_by, kind, day)} already exists. */
    Optional<CharacterRunEntity> findByCreatedByAndKindAndDay(UUID createdBy, String kind, LocalDate day);

    List<CharacterRunEntity> findByCreatedByAndDayBetweenOrderByDayDescGeneratedAtDesc(
            UUID createdBy, LocalDate from, LocalDate to);

    Optional<CharacterRunEntity> findByIdAndCreatedBy(UUID id, UUID createdBy);
}
