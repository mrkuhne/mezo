package io.mrkuhne.mezo.feature.train.repository;

import io.mrkuhne.mezo.feature.train.entity.RunSessionLogEntity;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Repository for {@link RunSessionLogEntity}. Extends {@link JpaRepository} directly (matching the
 * sibling {@code SportSessionRepository}); logged sessions are surfaced newest-first, so an explicit
 * date-descending finder is declared. The {@code is_deleted = false} filter comes from the entity
 * {@code @SQLRestriction}.
 */
public interface RunSessionLogRepository extends JpaRepository<RunSessionLogEntity, UUID> {

    List<RunSessionLogEntity> findByCreatedByOrderByDateDesc(UUID createdBy);
}
