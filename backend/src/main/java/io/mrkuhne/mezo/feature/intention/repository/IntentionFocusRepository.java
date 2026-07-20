package io.mrkuhne.mezo.feature.intention.repository;

import io.mrkuhne.mezo.feature.intention.entity.IntentionFocusEntity;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface IntentionFocusRepository extends JpaRepository<IntentionFocusEntity, UUID> {

    List<IntentionFocusEntity> findByCreatedByAndFocusDateAndDeletedFalseOrderByCreatedAtAsc(
        UUID createdBy, LocalDate focusDate);

    Optional<IntentionFocusEntity> findByIdAndCreatedByAndDeletedFalse(UUID id, UUID createdBy);
}
