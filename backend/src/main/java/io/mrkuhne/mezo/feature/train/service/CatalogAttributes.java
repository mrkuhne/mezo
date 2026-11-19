package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.feature.train.entity.ExerciseCatalogEntity;
import io.mrkuhne.mezo.feature.train.repository.ExerciseCatalogRepository;
import java.util.Collection;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * Catalog attributes the training-style stamp needs (mezo-r36n9.79), read in ONE batched catalog
 * fetch per save or read — never per exercise (same rule as {@link CatalogMediaResolver}).
 * Only stability is read today: an exercise without a catalog link, or with an unknown id, counts
 * as {@code free} (a user-authored movement is never assumed to be machine-guided).
 */
@Component
@RequiredArgsConstructor
public class CatalogAttributes {

    private final ExerciseCatalogRepository exerciseCatalogRepository;

    /**
     * Attributes of one exercise that gate the set techniques (mezo-r36n9.80) and pick the planner's default
     * technique (mezo-r36n9.81): {@code equipment} is one of
     * {@code machine|cable|dumbbell|barbell|bodyweight|kettlebell|other}; null or unknown reads as {@code other}.
     */
    public record Attrs(boolean stable, boolean lengthenedFriendly, String equipment) {
        private static final Set<String> EQUIPMENT =
            Set.of("machine", "cable", "dumbbell", "barbell", "bodyweight", "kettlebell", "other");

        /** No catalog link: counts as free, never lengthened-friendly, equipment {@code other}. */
        public static final Attrs FREE = new Attrs(false, false, "other");

        public Attrs {
            equipment = equipment != null && EQUIPMENT.contains(equipment) ? equipment : "other";
        }
    }

    /** The catalog ids that are {@code stable}; everything else (null, unknown, free) is free. */
    public record Lookup(Set<UUID> stableIds) {

        public static final Lookup EMPTY = new Lookup(Set.of());

        public boolean stable(UUID catalogId) {
            return catalogId != null && stableIds.contains(catalogId);
        }
    }

    /** Technique-gating attributes by catalog id; no id, unknown id or a free movement is {@link Attrs#FREE}. */
    public record AttrsLookup(Map<UUID, Attrs> byId) {

        public static final AttrsLookup EMPTY = new AttrsLookup(Map.of());

        public Attrs of(UUID catalogId) {
            return catalogId == null ? Attrs.FREE : byId.getOrDefault(catalogId, Attrs.FREE);
        }
    }

    /**
     * Style-independent, batched read of stability + lengthened-friendliness + equipment (mezo-r36n9.80/.81): one query
     * for the ids (nulls ignored), none when there is nothing to look up. User-owned catalog rows count
     * with their own values.
     */
    public AttrsLookup loadAttrs(Collection<UUID> catalogIds) {
        Set<UUID> ids = catalogIds.stream().filter(Objects::nonNull).collect(Collectors.toSet());
        if (ids.isEmpty()) {
            return AttrsLookup.EMPTY;
        }
        return new AttrsLookup(exerciseCatalogRepository.findByIdIn(ids).stream()
            .collect(Collectors.toUnmodifiableMap(ExerciseCatalogEntity::getId,
                c -> new Attrs("stable".equals(c.getStability()), Boolean.TRUE.equals(c.getLengthenedFriendly()),
                    c.getEquipment()))));
    }

    /** One query for the given ids (nulls ignored); no query at all when there is nothing to look up. */
    public Lookup load(Collection<UUID> catalogIds) {
        Set<UUID> ids = catalogIds.stream().filter(Objects::nonNull).collect(Collectors.toSet());
        if (ids.isEmpty()) {
            return Lookup.EMPTY;
        }
        return new Lookup(exerciseCatalogRepository.findByIdIn(ids).stream()
            .filter(c -> "stable".equals(c.getStability()))
            .map(ExerciseCatalogEntity::getId)
            .collect(Collectors.toUnmodifiableSet()));
    }
}
