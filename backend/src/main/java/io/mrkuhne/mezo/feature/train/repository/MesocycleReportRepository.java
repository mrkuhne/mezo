package io.mrkuhne.mezo.feature.train.repository;

import io.mrkuhne.mezo.feature.train.entity.MesocycleReportEntity;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

/** Repository for {@link MesocycleReportEntity}. */
public interface MesocycleReportRepository extends JpaRepository<MesocycleReportEntity, UUID> {

    Optional<MesocycleReportEntity> findByMesocycleIdAndCreatedByAndDeletedFalse(UUID mesocycleId, UUID createdBy);

    /** Batch lookup for a list of mesocycles (e.g. the template/history list's per-run report indicator). */
    List<MesocycleReportEntity> findByCreatedByAndMesocycleIdInAndDeletedFalse(
        UUID createdBy, Collection<UUID> mesocycleIds);
}
