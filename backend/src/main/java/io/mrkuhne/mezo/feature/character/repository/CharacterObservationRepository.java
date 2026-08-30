package io.mrkuhne.mezo.feature.character.repository;

import io.mrkuhne.mezo.feature.character.entity.CharacterObservationEntity;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CharacterObservationRepository extends JpaRepository<CharacterObservationEntity, UUID> {

    List<CharacterObservationEntity> findByCreatedByOrderByDayDescCreatedAtDesc(UUID createdBy, Pageable pageable);

    boolean existsByCreatedByAndExpertKeyAndDay(UUID createdBy, String expertKey, LocalDate day);

    /** The week's not-yet-consumed observations, oldest first (Karakter spec §6, mezo-1gim.5). */
    List<CharacterObservationEntity> findByCreatedByAndDayBetweenAndConsumedByConferenceIdIsNullOrderByDayAscCreatedAtAsc(
            UUID createdBy, LocalDate from, LocalDate to);
}
