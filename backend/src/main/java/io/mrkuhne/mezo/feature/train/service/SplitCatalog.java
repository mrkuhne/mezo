package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.feature.train.config.MesoPlanProperties;
import io.mrkuhne.mezo.feature.train.config.MesoPlanProperties.Split;
import java.util.List;
import java.util.Optional;

/** Lookup over the configured split catalogue ({@code mezo.meso-plan.splits}); pure. First entry = the default. */
public final class SplitCatalog {

    private SplitCatalog() {}

    /** The splits catalogued for {@code dayCount} (clamped to 2..6), default first; empty when none. */
    public static List<Split> forDays(MesoPlanProperties p, int dayCount) {
        return p.splits().getOrDefault(Math.max(2, Math.min(6, dayCount)), List.of());
    }

    public static Optional<Split> find(MesoPlanProperties p, int dayCount, String key) {
        return forDays(p, dayCount).stream().filter(s -> s.key().equals(key)).findFirst();
    }
}
