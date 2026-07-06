package io.mrkuhne.mezo.feature.proactive.repository;

import io.mrkuhne.mezo.feature.proactive.entity.MemoirEntity;
import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MemoirRepository extends JpaRepository<MemoirEntity, UUID> {

    Optional<MemoirEntity> findByCreatedByAndWeekStart(UUID createdBy, LocalDate weekStart);

    /** The GET's read: the newest memoir (archive is a later slice). */
    Optional<MemoirEntity> findFirstByCreatedByOrderByWeekStartDesc(UUID createdBy);
}
