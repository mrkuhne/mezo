package io.mrkuhne.mezo.feature.boop.repository;

import io.mrkuhne.mezo.feature.boop.entity.BoopBriefEntity;
import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BoopBriefRepository extends JpaRepository<BoopBriefEntity, UUID> {

    Optional<BoopBriefEntity> findByCreatedByAndDate(UUID createdBy, LocalDate date);
}
