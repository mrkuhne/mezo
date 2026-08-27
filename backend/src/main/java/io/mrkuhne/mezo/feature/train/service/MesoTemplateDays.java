package io.mrkuhne.mezo.feature.train.service;

import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import java.util.List;
import java.util.UUID;

/**
 * Template-day ids (rows with {@code templateSessionId == null}) out of a mesocycle's full
 * session list — instances are excluded, since exercises hang off the template row, never the
 * instance. Shared by {@link WorkoutService#weekTemplateExercises} (getToday's effective-set
 * distribution, DA6) and {@link VolumeProgressionService#seedBaselines} (baseline seeding on
 * meso create/activate) so the two never drift on what counts as a template day (mezo-dz9c item
 * 5 — previously duplicated verbatim in both). Pure, no Spring/DB — the caller owns the fetch.
 */
final class MesoTemplateDays {
    private MesoTemplateDays() {}

    static List<UUID> ids(List<WorkoutSessionEntity> mesoSessions) {
        return mesoSessions.stream()
            .filter(s -> s.getTemplateSessionId() == null)
            .map(WorkoutSessionEntity::getId)
            .toList();
    }
}
