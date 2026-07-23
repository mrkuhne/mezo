package io.mrkuhne.mezo.feature.fuel.service;

import java.time.LocalTime;
import java.util.UUID;

/** Read seam for the user's caffeine cutoff — habit/planner consumers depend on this, never on the row. */
public interface CaffeineCutoffPort {

    /** Resolves the cutoff; config-default ghost when no settings row exists (never empty). */
    LocalTime resolve(UUID userId);
}
