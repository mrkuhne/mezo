package io.mrkuhne.mezo.feature.train.service;

import java.util.Locale;

/** A set technique (mezo-r36n9.80). Wire value is the lowercase name (REST_DROP -> rest_drop). Pure. */
public enum Technique {
    NONE, REST_DROP, DROP, MYO, PARTIALS;

    public String wire() {
        return name().toLowerCase(Locale.ROOT);
    }

    /** Parse a wire value; null counts as none. An unknown value is a caller bug. */
    public static Technique fromWire(String wire) {
        if (wire == null) return NONE;
        return valueOf(wire.toUpperCase(Locale.ROOT));
    }

    /** The generated API enum with the same wire value. */
    public io.mrkuhne.mezo.api.dto.Technique toApi() {
        return io.mrkuhne.mezo.api.dto.Technique.fromValue(wire());
    }
}
