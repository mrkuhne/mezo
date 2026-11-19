package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.feature.train.entity.ExerciseCatalogEntity;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * What the user's gym can host, for the substitute ranker. An exercise is unavailable when its id
 * is in {@code missing} or any of its {@code gear} kinds is off. Bodyweight and a null gear list
 * (user-authored rows) are always available.
 */
public record GymAvailability(Set<String> offKinds, Set<UUID> missing) {

    public static GymAvailability everything() {
        return new GymAvailability(Set.of(), Set.of());
    }

    public boolean available(ExerciseCatalogEntity e) {
        if (missing.contains(e.getId())) {
            return false;
        }
        List<String> gear = e.getGear();
        return gear == null || gear.stream().noneMatch(offKinds::contains);
    }
}
