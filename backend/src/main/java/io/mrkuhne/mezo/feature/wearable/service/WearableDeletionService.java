package io.mrkuhne.mezo.feature.wearable.service;

import io.mrkuhne.mezo.feature.biometrics.weight.service.HealthWeightService;
import io.mrkuhne.mezo.feature.wearable.config.WearableProperties;
import io.mrkuhne.mezo.feature.wearable.repository.HealthSampleRepository;
import io.mrkuhne.mezo.feature.wearable.repository.WearableWorkoutRepository;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Health deletions (Boop B1, mezo-r36n9.11): soft-deletes the owner's live rows whose external id matches, in
 * {@code health_sample}, {@code wearable_workout} and Health-sourced {@code weight_log}. Ids are matched as given
 * (the client sends workout ids as {@code hk-<uuid>} and sample ids as raw uuids). Idempotent; ids that match
 * nothing are ignored.
 */
@Service
@RequiredArgsConstructor
public class WearableDeletionService {

    private final HealthSampleRepository sampleRepository;
    private final WearableWorkoutRepository workoutRepository;
    private final HealthWeightService weightService;
    private final WearableProperties properties;

    /** @return number of live rows soft-deleted across the three tables */
    @Transactional
    public int delete(UUID createdBy, List<String> externalIds) {
        WearableBatches.requireAtMost(externalIds.size(), properties.maxSamples());
        if (externalIds.isEmpty()) {
            return 0;
        }
        return sampleRepository.softDeleteByExternalIds(createdBy, externalIds)
            + workoutRepository.softDeleteByExternalIds(createdBy, externalIds)
            + weightService.deleteByExternalIds(createdBy, externalIds);
    }
}
