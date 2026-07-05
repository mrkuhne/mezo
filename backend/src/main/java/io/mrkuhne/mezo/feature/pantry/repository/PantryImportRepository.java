package io.mrkuhne.mezo.feature.pantry.repository;

import io.mrkuhne.mezo.feature.pantry.entity.PantryImportEntity;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Limit;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PantryImportRepository extends JpaRepository<PantryImportEntity, UUID> {

    List<PantryImportEntity> findByCreatedByAndDeletedFalseOrderByImportedAtDesc(UUID createdBy, Limit limit);
}
