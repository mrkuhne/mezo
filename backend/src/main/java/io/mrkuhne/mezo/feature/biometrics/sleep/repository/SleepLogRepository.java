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

    /** Last-N-days window for the companion get_recovery(scope=sleep) tool (V0.5, mezo-xixu) — plain
     *  finder, no companion dependency. */
    List<SleepLogEntity> findByCreatedByAndDeletedFalseAndDateGreaterThanEqualOrderByDateDesc(
            UUID createdBy, LocalDate from);

    /** Detail window for the companion get_recovery(scope=sleep) date/from/to params (mezo-ohce)
     *  — plain derived finder, no companion dependency. Inclusive bounds, newest first. */
    List<SleepLogEntity> findByCreatedByAndDeletedFalseAndDateBetweenOrderByDateDesc(
            UUID createdBy, LocalDate from, LocalDate to);

    /** Weekly review {@code stale} probe (mezo-p2tr): the most recently CREATED sleep row inside
     *  the week — compared against the review's {@code generatedAt}, not its own {@code date}. */
    Optional<SleepLogEntity> findFirstByCreatedByAndDeletedFalseAndDateBetweenOrderByCreatedAtDesc(
            UUID createdBy, LocalDate from, LocalDate to);
}
