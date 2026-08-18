package io.mrkuhne.mezo.feature.journal.repository;

import io.mrkuhne.mezo.feature.journal.entity.JournalEntryEntity;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface JournalEntryRepository extends JpaRepository<JournalEntryEntity, UUID> {

    Optional<JournalEntryEntity> findByIdAndCreatedByAndDeletedFalse(UUID id, UUID createdBy);

    List<JournalEntryEntity> findByCreatedByAndOccurredOnBetweenAndDeletedFalseOrderByOccurredOnDescCreatedAtDesc(
        UUID createdBy, LocalDate startInclusive, LocalDate endInclusive);
}
