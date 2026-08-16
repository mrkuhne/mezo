package io.mrkuhne.mezo.feature.train.repository;

import io.mrkuhne.mezo.feature.train.entity.MesoTemplateEntity;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/** Repository for {@link MesoTemplateEntity}. */
public interface MesoTemplateRepository extends JpaRepository<MesoTemplateEntity, UUID> {

    List<MesoTemplateEntity> findByCreatedByAndDeletedFalseOrderByCreatedAtAsc(UUID createdBy);

    Optional<MesoTemplateEntity> findByIdAndCreatedByAndDeletedFalse(UUID id, UUID createdBy);
}
