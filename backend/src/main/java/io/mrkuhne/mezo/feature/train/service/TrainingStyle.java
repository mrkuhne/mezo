package io.mrkuhne.mezo.feature.train.service;

import java.util.Locale;

/** A block's training style (mezo-r36n9.79). Wire value is the lowercase name. Pure. */
public enum TrainingStyle {
    BALANCED, VOLUME, HEAVY, ALLOUT;

    public String wire() {
        return name().toLowerCase(Locale.ROOT);
    }

    /** Parse a wire value; null for null (unstyled). An unknown value is a caller bug. */
    public static TrainingStyle fromWire(String wire) {
        if (wire == null) return null;
        return valueOf(wire.toUpperCase(Locale.ROOT));
    }
}
