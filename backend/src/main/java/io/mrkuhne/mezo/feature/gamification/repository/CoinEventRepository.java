package io.mrkuhne.mezo.feature.gamification.repository;

import io.mrkuhne.mezo.feature.gamification.entity.CoinEventEntity;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CoinEventRepository extends JpaRepository<CoinEventEntity, UUID> {

    List<CoinEventEntity> findByCreatedByAndOccurredOnOrderByCreatedAtAsc(UUID createdBy, LocalDate occurredOn);

    boolean existsByCreatedByAndReasonAndSourceRefId(UUID createdBy, String reason, String sourceRefId);
}
