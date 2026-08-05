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
 * Resolves a demo-media lookup {@code catalog_id → CatalogMedia} for a set of catalog ids in ONE
 * batched catalog fetch (never per-exercise). Rows with no linked catalog are simply absent from the
 * map; a row with no media at all is skipped too, so a present entry always carries something.
 * Shared by {@link WorkoutService#getToday} and {@link TrainService} so the resolve lives in exactly
 * one place — three media fields resolved by two components is how N+1 queries are born.
 * NOTE: the {@code catalogId != null} guard stays at the call sites — an empty map's
 * {@code get(null)} would still throw.
 *
 * <p>Was {@code CatalogVideoResolver} until {@code mezo-8xdl.1} added the demo stills.
 */
@Component
@RequiredArgsConstructor
public class CatalogMediaResolver {

    /** The catalog row's renderable media; any field may be null. */
    public record CatalogMedia(String videoUrl, String imageStartUrl, String imageEndUrl) {

        boolean isEmpty() {
            return videoUrl == null && imageStartUrl == null && imageEndUrl == null;
        }
    }

    private final ExerciseCatalogRepository exerciseCatalogRepository;

    public Map<UUID, CatalogMedia> resolve(Collection<UUID> catalogIds) {
        if (catalogIds.isEmpty()) {
            return Map.of();
        }
        return exerciseCatalogRepository.findByIdIn(catalogIds).stream()
            .map(c -> Map.entry(c.getId(), toMedia(c)))
            .filter(e -> !e.getValue().isEmpty())
            .collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue));
    }

    private CatalogMedia toMedia(ExerciseCatalogEntity c) {
        return new CatalogMedia(c.getVideoUrl(), c.getImageStartUrl(), c.getImageEndUrl());
    }
}
