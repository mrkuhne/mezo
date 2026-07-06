package io.mrkuhne.mezo.feature.proactive.repository;

import io.mrkuhne.mezo.feature.proactive.entity.WeeklySuggestionEntity;
import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WeeklySuggestionRepository extends JpaRepository<WeeklySuggestionEntity, UUID> {

    Optional<WeeklySuggestionEntity> findByCreatedByAndWeekStart(UUID createdBy, LocalDate weekStart);
}
