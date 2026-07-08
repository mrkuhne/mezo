package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.feature.train.entity.ExerciseCatalogEntity;
import io.mrkuhne.mezo.feature.train.repository.ExerciseCatalogRepository;
import java.util.Collection;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * Resolves a demo-video lookup {@code catalog_id → video_url} for a set of catalog ids in ONE
 * batched catalog fetch (never per-exercise). Rows with no linked catalog or no video are simply
 * absent from the map. Shared by {@link WorkoutService#getToday} and {@link TrainService} so the
 * resolve lives in exactly one place. NOTE: the {@code catalogId != null} guard stays at the call
 * sites — an empty map's {@code get(null)} would still throw.
 */
@Component
@RequiredArgsConstructor
public class CatalogVideoResolver {

    private final ExerciseCatalogRepository exerciseCatalogRepository;

    public Map<UUID, String> resolve(Collection<UUID> catalogIds) {
        if (catalogIds.isEmpty()) {
            return Map.of();
        }
        return exerciseCatalogRepository.findByIdIn(catalogIds).stream()
            .filter(c -> c.getVideoUrl() != null)
            .collect(Collectors.toMap(ExerciseCatalogEntity::getId, ExerciseCatalogEntity::getVideoUrl));
    }
}
