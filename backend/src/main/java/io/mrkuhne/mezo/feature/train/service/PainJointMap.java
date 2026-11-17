package io.mrkuhne.mezo.feature.train.service;

import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;

/**
 * Check-in pain region → the catalogue {@code joints} token it hurts (spec 2026-11-17 §6.2, the
 * reasoned swap). Pure. Complements {@link PainRegionMap}, which maps regions to muscle groups.
 * Regions without a loaded joint (FEJ, NYAK, FELSO_HAT, HAS, EGYEB) and unknown names map to nothing.
 */
public final class PainJointMap {

    private PainJointMap() {}

    private static final Map<String, String> JOINT = Map.of(
        "VALL", "shoulder",
        "KONYOK", "elbow",
        "CSUKLO_KEZ", "wrist",
        "DEREK", "lower-back",
        "CSIPO", "hip",
        "TERD", "knee",
        "BOKA_LABFEJ", "ankle");

    /** The joints the given regions hurt, in report order; empty for null / unmapped input. */
    public static Set<String> joints(Collection<String> painRegions) {
        if (painRegions == null) {
            return Set.of();
        }
        Set<String> out = new LinkedHashSet<>();
        for (String region : painRegions) {
            String joint = region == null ? null : JOINT.get(region);
            if (joint != null) {
                out.add(joint);
            }
        }
        return out;
    }
}
