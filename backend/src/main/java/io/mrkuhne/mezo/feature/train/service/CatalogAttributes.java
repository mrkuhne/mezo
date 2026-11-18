package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.feature.train.entity.ExerciseCatalogEntity;
import io.mrkuhne.mezo.feature.train.repository.ExerciseCatalogRepository;
import java.util.Collection;
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

    /** Attributes of one exercise that gate the set techniques (mezo-r36n9.80). */
    public record Attrs(boolean stable, boolean lengthenedFriendly) {
        /** No catalog link: counts as free, never lengthened-friendly. */
        public static final Attrs FREE = new Attrs(false, false);
    }

    /** The catalog ids that are {@code stable}; everything else (null, unknown, free) is free. */
    public record Lookup(Set<UUID> stableIds) {

        public static final Lookup EMPTY = new Lookup(Set.of());

        public boolean stable(UUID catalogId) {
            return catalogId != null && stableIds.contains(catalogId);
        }
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
