package io.mrkuhne.mezo.feature.train.service.sport;

import java.util.Locale;
import java.util.Map;

/**
 * Sport kind → how much each muscle works, 0..1, on the exercise catalogue's fine tokens (the ones the phone's body
 * map draws). Boop Sport S2 (mezo-r36n9.202, spec §5.7): a session's heat on a muscle = weight × session load.
 * Volleyball first (spec: shoulders, quads, calves, core, glutes — the attacking arm and the jump); the others are
 * coaching-common defaults. {@code other} and any unknown kind have no row → no heat, never a guess. Pure.
 */
public final class SportMuscleTable {

    private static final Map<String, Map<String, Double>> TABLE = Map.ofEntries(
        Map.entry("volleyball", Map.of("shoulder-side", 1.0, "shoulder-front", 0.8, "quad", 0.9, "calf", 0.9,
            "glute", 0.7, "core", 0.6, "ham", 0.4)),
        Map.entry("basketball", Map.of("quad", 1.0, "calf", 1.0, "glute", 0.7, "ham", 0.5, "core", 0.5,
            "shoulder-side", 0.3)),
        Map.entry("football", Map.of("quad", 1.0, "ham", 0.9, "calf", 0.8, "glute", 0.7, "core", 0.4)),
        Map.entry("tennis", Map.of("shoulder-front", 0.8, "shoulder-side", 0.6, "core", 0.8, "quad", 0.7,
            "calf", 0.7, "glute", 0.5)),
        Map.entry("running", Map.of("calf", 1.0, "quad", 0.8, "ham", 0.7, "glute", 0.6, "core", 0.3)),
        Map.entry("bike", Map.of("quad", 1.0, "glute", 0.6, "calf", 0.5, "ham", 0.4)),
        Map.entry("swim", Map.of("back-wide", 1.0, "shoulder-side", 0.9, "shoulder-front", 0.7,
            "triceps-long", 0.5, "core", 0.5)),
        Map.entry("hike", Map.of("quad", 0.8, "glute", 0.8, "calf", 0.7, "ham", 0.5, "core", 0.3)),
        Map.entry("cross", Map.of("quad", 0.7, "glute", 0.7, "core", 0.7, "shoulder-side", 0.5, "chest-mid", 0.5,
            "back-wide", 0.5)),
        Map.entry("trx", Map.of("core", 0.9, "back-wide", 0.8, "chest-mid", 0.6, "shoulder-side", 0.6,
            "biceps-long", 0.4)));

    private SportMuscleTable() {
    }

    /** The kind's muscle weights; empty for {@code other} / an unknown kind. */
    public static Map<String, Double> weights(String sport) {
        return sport == null ? Map.of() : TABLE.getOrDefault(sport.toLowerCase(Locale.ROOT), Map.of());
    }
}
