package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import java.util.List;
import java.util.UUID;

/**
 * Template-day ids (rows with {@code templateSessionId == null}) out of a mesocycle's full
 * session list — instances are excluded, since exercises hang off the template row, never the
 * instance. Read by {@link VolumeLedger} (the derived volume log) and parked
 * {@link LegacySetDistribution}'s migration caller, so they never drift on what counts as a
 * template day (mezo-dz9c item 5). Pure, no Spring/DB — the caller owns the fetch.
 */
public final class MesoTemplateDays {
    private MesoTemplateDays() {}

    public static List<UUID> ids(List<WorkoutSessionEntity> mesoSessions) {
        return mesoSessions.stream()
            .filter(s -> s.getTemplateSessionId() == null)
            .map(WorkoutSessionEntity::getId)
            .toList();
    }
}
