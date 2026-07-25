package io.mrkuhne.mezo.feature.gamification.repository;

import io.mrkuhne.mezo.feature.gamification.entity.GamificationProfileEntity;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface GamificationProfileRepository extends JpaRepository<GamificationProfileEntity, UUID> {

    Optional<GamificationProfileEntity> findByCreatedBy(UUID createdBy);
}
