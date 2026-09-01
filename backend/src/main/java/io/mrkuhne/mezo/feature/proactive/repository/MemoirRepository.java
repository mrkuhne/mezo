package io.mrkuhne.mezo.feature.proactive.repository;

import io.mrkuhne.mezo.feature.proactive.entity.MemoirEntity;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MemoirRepository extends JpaRepository<MemoirEntity, UUID> {

    Optional<MemoirEntity> findByCreatedByAndWeekStart(UUID createdBy, LocalDate weekStart);

    /** The GET's read: the newest memoir. */
    Optional<MemoirEntity> findFirstByCreatedByOrderByWeekStartDesc(UUID createdBy);

    /** F7.5 (mezo-d20.8.5): the archive shelf — every persisted memoir, newest week first. */
    List<MemoirEntity> findByCreatedByOrderByWeekStartDesc(UUID createdBy);
}
