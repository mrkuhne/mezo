package io.mrkuhne.mezo.feature.train.port;

import java.time.LocalDate;
import java.util.UUID;

/**
 * Train-owned seam to the season (Boop B6 Évad, mezo-r36n9.16, spec §5.12-5): a training block may only be created
 * or activated inside a season. The season feature supplies the adapter, so train never imports the season.
 */
public interface SeasonGatePort {

    /** True when the owner has an active season, or a planned one starting within 7 days of {@code start}. */
    boolean allowsMesocycleStart(UUID owner, LocalDate start);
}
