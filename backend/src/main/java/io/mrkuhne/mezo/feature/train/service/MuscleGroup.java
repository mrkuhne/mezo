package io.mrkuhne.mezo.feature.train.service;

/** Collapse the 21-token zone taxonomy (exercise.muscle, mezo-wu1s) to the coarse volume-group
 * taxonomy (muscle_group_volume_log.muscle): chest/back/shoulder/biceps/triceps + quad/ham/glute/calf/core.
 * Legacy coarse keys and already-coarse leg/core tokens pass through unchanged. Pure. */
public final class MuscleGroup {
    private MuscleGroup() {}

    public static String of(String zone) {
        if (zone == null || zone.isBlank()) return zone;
        if ("traps".equals(zone)) return "back";
        int dash = zone.indexOf('-');
        String head = dash >= 0 ? zone.substring(0, dash) : zone;
        return switch (head) {
            case "chest", "back", "shoulder", "biceps", "triceps" -> head;
            default -> zone; // quad/ham/glute/calf/core + legacy coarse (lats/rear-delt/…) pass through
        };
    }
}
