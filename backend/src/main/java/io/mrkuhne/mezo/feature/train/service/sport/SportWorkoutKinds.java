package io.mrkuhne.mezo.feature.train.service.sport;

import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Which Health workout may tick which layer of the day (Boop Sport S1, mezo-r36n9.201). Gym and sport are two
 * layers: a strength workout ticks the gym, a sport's own workout type ticks that sport, and nothing ticks both.
 * Health {@code other} ticks neither — too ambiguous to mark a plan done with. Activity types are the server keys the
 * phone sends (lowercased HealthKit names or their short forms: {@code strength}, {@code volleyball}, {@code hiit}…).
 */
public final class SportWorkoutKinds {

    private static final Set<String> GYM = Set.of("strength", "traditionalstrengthtraining",
        "functionalstrengthtraining");
    private static final Set<String> INTERVALS = Set.of("hiit", "highintensityintervaltraining", "crosstraining");

    /** Sport kind → the Health activity types that are that sport. A kind missing here matches only its own name. */
    private static final Map<String, Set<String>> SPORT = Map.of(
        "bike", Set.of("cycling", "bike"),
        "hike", Set.of("hiking", "hike"), // not walking: an auto-detected walk is not a hike
        "swim", Set.of("swimming", "swim"),
        "football", Set.of("soccer", "football"),
        "running", Set.of("running", "run"),
        "cross", INTERVALS,
        "trx", INTERVALS);

    private SportWorkoutKinds() {
    }

    /** True when the Health workout is a gym (strength) session. */
    public static boolean isGym(String activityType) {
        return GYM.contains(norm(activityType));
    }

    /** True when the Health workout is the given sport kind ({@code volleyball}, {@code running}, …). */
    public static boolean fitsSport(String activityType, String sport) {
        String a = norm(activityType);
        String k = norm(sport);
        if (a.isEmpty() || "other".equals(a) || k.isEmpty()) {
            return false;
        }
        return SPORT.getOrDefault(k, Set.of(k)).contains(a);
    }

    /** Single-kind sports a Health workout names unambiguously (cross / TRX share one Health type → not here). */
    private static final java.util.List<String> NAMED = java.util.List.of("volleyball", "running", "bike", "hike",
        "swim", "football", "basketball", "tennis");

    /**
     * The sport kind a Health workout is, or {@code null} when it names none (a strength workout, {@code other}, an
     * interval workout that could be cross or TRX). Boop Sport S2 (mezo-r36n9.202): an unplanned Watch workout.
     */
    public static String sportOf(String activityType) {
        for (String kind : NAMED) {
            if (fitsSport(activityType, kind)) {
                return kind;
            }
        }
        return null;
    }

    private static String norm(String s) {
        return s == null ? "" : s.toLowerCase(Locale.ROOT);
    }
}
