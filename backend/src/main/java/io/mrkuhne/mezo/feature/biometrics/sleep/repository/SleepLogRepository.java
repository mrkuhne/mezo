package io.mrkuhne.mezo.feature.biometrics.sleep.repository;

import io.mrkuhne.mezo.feature.biometrics.sleep.entity.SleepLogEntity;
import io.mrkuhne.mezo.techcore.persistence.OwnedRepository;
import java.util.Optional;
import java.util.UUID;

public interface SleepLogRepository extends OwnedRepository<SleepLogEntity> {

    /** Latest sleep row ("last night") for the companion context snapshot. */
    Optional<SleepLogEntity> findFirstByCreatedByAndDeletedFalseOrderByDateDesc(UUID createdBy);
}
