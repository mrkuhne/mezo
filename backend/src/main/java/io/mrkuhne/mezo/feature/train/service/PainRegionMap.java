package io.mrkuhne.mezo.feature.train.service;

import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Check-in 2.0 pain region → the coarse muscle groups ({@link MuscleGroup#of}) an exercise loads
 * when it stresses that region (mezo-ck2, spec 2026-09-27 §3.3). Pure. Keys are the stored
 * {@code PainRegion} names (biometrics owns the enum; train only sees the strings through
 * {@link DayCheckInPort}). The coarse taxonomy has no forearm group, so CSUKLO_KEZ maps to the
 * arm flexors/extensors that grip. Regions with no training load (FEJ, NYAK, HAS, EGYEB) map to
 * nothing.
 */
public final class PainRegionMap {

    private PainRegionMap() {}

    private static final Map<String, Set<String>> GROUPS = Map.of(
        "VALL", Set.of("shoulder"),
        "KONYOK", Set.of("biceps", "triceps"),
        "CSUKLO_KEZ", Set.of("biceps", "triceps"),
        "FELSO_HAT", Set.of("back"),
        "DEREK", Set.of("back", "core"),
        "CSIPO", Set.of("glute"),
        "TERD", Set.of("quad", "ham"),
        "BOKA_LABFEJ", Set.of("calf"));

    /** Hungarian possessive for the card's „fáj a …" line. */
    private static final Map<String, String> POSSESSIVE = Map.of(
        "VALL", "vállad",
        "KONYOK", "könyököd",
        "CSUKLO_KEZ", "csuklód",
        "FELSO_HAT", "felső hátad",
        "DEREK", "derekad",
        "CSIPO", "csípőd",
        "TERD", "térded",
        "BOKA_LABFEJ", "bokád");

    /** The coarse muscle groups the region loads; empty for an unmapped / unknown region. */
    public static Set<String> groups(String region) {
        return region == null ? Set.of() : GROUPS.getOrDefault(region, Set.of());
    }

    /** The first region in {@code regions} (report order) that loads {@code muscleZone}, else null. */
    public static String firstLoading(List<String> regions, String muscleZone) {
        String group = MuscleGroup.of(muscleZone);
        if (group == null || regions == null) {
            return null;
        }
        return regions.stream().filter(r -> groups(r).contains(group)).findFirst().orElse(null);
    }

    /** „fáj a {possessive}" — e.g. VALL → „vállad"; unknown regions fall back to the lower-cased name. */
    public static String possessive(String region) {
        return POSSESSIVE.getOrDefault(region, region == null ? "" : region.toLowerCase());
    }
}
