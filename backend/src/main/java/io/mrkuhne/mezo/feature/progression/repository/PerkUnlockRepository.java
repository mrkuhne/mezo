package io.mrkuhne.mezo.feature.progression.repository;

import io.mrkuhne.mezo.feature.progression.entity.PerkUnlockEntity;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PerkUnlockRepository extends JpaRepository<PerkUnlockEntity, UUID> {

    List<PerkUnlockEntity> findByCreatedByOrderByUnlockedAtAsc(UUID createdBy);

    List<PerkUnlockEntity> findByCreatedByOrderByUnlockedAtDesc(UUID createdBy);
}
