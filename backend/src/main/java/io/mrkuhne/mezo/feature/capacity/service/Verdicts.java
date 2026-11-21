package io.mrkuhne.mezo.feature.capacity.service;

import io.mrkuhne.mezo.feature.capacity.config.CapacityProperties;

/** Maps load / capacity to the verdict word (Boop B7 K1). */
public final class Verdicts {

    private Verdicts() {
    }

    public static String word(double ratio, CapacityProperties p) {
        CapacityProperties.Verdict v = p.verdict();
        if (ratio < v.laza()) {
            return "laza";
        }
        if (ratio < v.rendben()) {
            return "rendben";
        }
        if (ratio <= v.szoros()) {
            return "szoros";
        }
        return "túl sok";
    }
}
