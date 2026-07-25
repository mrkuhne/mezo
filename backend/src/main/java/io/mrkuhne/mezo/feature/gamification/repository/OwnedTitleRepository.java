package io.mrkuhne.mezo.feature.gamification.repository;

import io.mrkuhne.mezo.feature.gamification.entity.OwnedTitleEntity;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OwnedTitleRepository extends JpaRepository<OwnedTitleEntity, UUID> {

    List<OwnedTitleEntity> findByCreatedBy(UUID createdBy);

    boolean existsByCreatedByAndTitleKey(UUID createdBy, String titleKey);
}
