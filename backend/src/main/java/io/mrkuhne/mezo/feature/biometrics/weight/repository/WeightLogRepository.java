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

    /** The single latest weigh-in (by date, tie-broken by created_at) — the companion snapshot's
     *  [Profil] "mérés:" fact, shown beside the EWMA trend (V2.2 follow-up, mezo-gst9). */
    Optional<WeightLogEntity> findFirstByCreatedByAndDeletedFalseOrderByDateDescCreatedAtDesc(
            UUID createdBy);

    /** Weekly review {@code stale} probe (mezo-p2tr): the most recently CREATED weigh-in inside
     *  the week — compared against the review's {@code generatedAt}, not its own {@code date}. */
    Optional<WeightLogEntity> findFirstByCreatedByAndDeletedFalseAndDateBetweenOrderByCreatedAtDesc(
            UUID createdBy, LocalDate from, LocalDate to);

    /** Every weigh-in inside a closed day window — the Fuel-week weight average (mezo-d20.7.2)
     *  folds these to one value per day (the day's latest) before averaging. Ordered so the
     *  LAST row of a given date is that date's latest entry. */
    List<WeightLogEntity> findByCreatedByAndDeletedFalseAndDateBetweenOrderByDateAscCreatedAtAsc(
            UUID createdBy, LocalDate from, LocalDate to);
}
