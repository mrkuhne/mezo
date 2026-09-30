package io.mrkuhne.mezo.feature.train.repository;

import io.mrkuhne.mezo.feature.train.entity.RecoveryDayReleaseEntity;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Repository for {@link RecoveryDayReleaseEntity} (Kihagyás S2, mezo-q4xt2.2). The batch lookup
 * backs a week/day read overlay across several recovery periods; the single lookup backs the
 * "Ma mégis edzek" toggle for one date inside one period.
 */
public interface RecoveryDayReleaseRepository extends JpaRepository<RecoveryDayReleaseEntity, UUID> {

    List<RecoveryDayReleaseEntity> findByCreatedByAndPeriodIdInAndDeletedFalse(
        UUID createdBy, Collection<UUID> periodIds);

    Optional<RecoveryDayReleaseEntity> findByCreatedByAndPeriodIdAndDateAndDeletedFalse(
        UUID createdBy, UUID periodId, LocalDate date);
}
