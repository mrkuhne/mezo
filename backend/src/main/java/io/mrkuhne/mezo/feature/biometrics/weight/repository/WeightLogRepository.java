package io.mrkuhne.mezo.feature.biometrics.weight.repository;

import io.mrkuhne.mezo.feature.biometrics.weight.entity.WeightLogEntity;
import io.mrkuhne.mezo.techcore.persistence.OwnedRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface WeightLogRepository extends OwnedRepository<WeightLogEntity> {

    /** One day's (latest) weigh-in — plain finder for the companion daily digest (V2.2). */
    Optional<WeightLogEntity> findFirstByCreatedByAndDeletedFalseAndDateOrderByCreatedAtDesc(
            UUID createdBy, LocalDate date);

    /** Weigh-ins from {@code date} onward — the proactive P1 validation reads a window (upper
     *  bound filtered in Java, the house ≥-then-filter idiom; sleep uses the same shape). */
    List<WeightLogEntity> findByCreatedByAndDeletedFalseAndDateGreaterThanEqualOrderByDateDesc(
            UUID createdBy, LocalDate date);
}
