package io.mrkuhne.mezo.feature.journal.repository;

import io.mrkuhne.mezo.feature.journal.entity.GratitudeEntryEntity;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface GratitudeEntryRepository extends JpaRepository<GratitudeEntryEntity, UUID> {

    Optional<GratitudeEntryEntity> findByIdAndCreatedByAndDeletedFalse(UUID id, UUID createdBy);

    List<GratitudeEntryEntity> findByCreatedByAndOccurredOnBetweenAndDeletedFalseOrderByOccurredOnDescCreatedAtDesc(
            UUID createdBy, LocalDate from, LocalDate to);
}
