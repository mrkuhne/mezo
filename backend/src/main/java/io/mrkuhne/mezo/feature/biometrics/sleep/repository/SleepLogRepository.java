package io.mrkuhne.mezo.feature.biometrics.sleep.repository;

import io.mrkuhne.mezo.feature.biometrics.sleep.entity.SleepLogEntity;
import io.mrkuhne.mezo.techcore.persistence.OwnedRepository;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface SleepLogRepository extends OwnedRepository<SleepLogEntity> {

    /** Latest sleep row ("last night") for the companion context snapshot. */
    Optional<SleepLogEntity> findFirstByCreatedByAndDeletedFalseOrderByDateDesc(UUID createdBy);

    /** Last-N-days window for the companion get_sleep tool (V0.5) — plain finder, no companion dependency. */
    List<SleepLogEntity> findByCreatedByAndDeletedFalseAndDateGreaterThanEqualOrderByDateDesc(
            UUID createdBy, LocalDate from);

    /** B1.2 briefing staleness probe — did a (last-)night sleep row arrive after generation? */
    boolean existsByCreatedByAndDeletedFalseAndDateGreaterThanEqualAndCreatedAtAfter(
            UUID createdBy, LocalDate from, java.time.Instant after);
}
