package io.mrkuhne.mezo.feature.biometrics.weight.service;

import io.mrkuhne.mezo.feature.biometrics.weight.repository.WeightLogRepository;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Port for Apple Health weigh-ins (Boop B1, mezo-r36n9.11): the wearable feature calls this, never the
 * other way round. Upserts {@code weight_log} rows (source {@code apple_health}, keyed by the HealthKit uuid)
 * WITHOUT {@link WeightLogService#log}'s per-call recompute + event — a 60-day backfill must not flood. Returns the
 * newest NEW weigh-in dated today or yesterday (the caller then does ONE goal recompute + ONE
 * {@link WeightLogSavedEvent}; they live in the caller so biometrics gains no new edge into goal). Manual rows on
 * the same date stay.
 */
@Service
@RequiredArgsConstructor
public class HealthWeightService {

    private final WeightLogRepository repository;

    /** One Health weigh-in: the sample's external id, its local day and the mass in kg. */
    public record HealthWeighIn(String externalId, LocalDate date, double weightKg) {
    }

    @Transactional
    public Optional<LocalDate> upsert(UUID createdBy, List<HealthWeighIn> weighIns, LocalDate today) {
        if (weighIns.isEmpty()) {
            return Optional.empty();
        }
        Set<String> existing = new HashSet<>(repository.findExistingExternalIds(createdBy,
            weighIns.stream().map(HealthWeighIn::externalId).toList()));
        Set<String> seen = new HashSet<>();
        LocalDate newestNew = null;
        for (HealthWeighIn w : weighIns) {
            repository.upsertFromHealth(createdBy, w.externalId(), w.date(),
                BigDecimal.valueOf(w.weightKg()).setScale(2, RoundingMode.HALF_UP));
            if (!existing.contains(w.externalId()) && seen.add(w.externalId())
                && !w.date().isBefore(today.minusDays(1))
                && (newestNew == null || w.date().isAfter(newestNew))) {
                newestNew = w.date();
            }
        }
        return Optional.ofNullable(newestNew);
    }

    /** Soft-deletes Health weigh-ins by external id (manual rows are never touched); returns the count. */
    @Transactional
    public int deleteByExternalIds(UUID createdBy, List<String> externalIds) {
        return repository.softDeleteHealthByExternalIds(createdBy, externalIds);
    }
}
