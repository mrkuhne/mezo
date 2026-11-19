package io.mrkuhne.mezo.feature.penz.repository;

import io.mrkuhne.mezo.feature.penz.entity.PenzMonthCloseEntity;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/** One live close per owner and month; bespoke owner-scoped finders. */
public interface PenzMonthCloseRepository extends JpaRepository<PenzMonthCloseEntity, UUID> {

    List<PenzMonthCloseEntity> findByCreatedByAndDeletedFalseOrderByMonthDesc(UUID createdBy);

    Optional<PenzMonthCloseEntity> findByCreatedByAndMonthAndDeletedFalse(UUID createdBy, String month);
}
