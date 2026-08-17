package io.mrkuhne.mezo.feature.proactive.repository;

import io.mrkuhne.mezo.feature.proactive.entity.CompanionMessageEntity;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CompanionMessageRepository extends JpaRepository<CompanionMessageEntity, UUID> {

    Optional<CompanionMessageEntity> findByCreatedByAndMessageDateAndKind(
            UUID createdBy, LocalDate messageDate, String kind);

    List<CompanionMessageEntity> findByCreatedByAndMessageDateOrderByGeneratedAtAsc(
            UUID createdBy, LocalDate messageDate);
}
