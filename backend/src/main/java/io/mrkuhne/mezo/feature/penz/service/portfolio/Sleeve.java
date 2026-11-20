package io.mrkuhne.mezo.feature.penz.service.portfolio;

import java.util.Locale;

/** The three horizons, in display order: short = 1–3 év, mid = 5–10 év, long = 10+ év. */
public enum Sleeve {
    SHORT, MID, LONG;

    public static Sleeve of(String wire) {
        return valueOf(wire.toUpperCase(Locale.ROOT));
    }

    public String wire() {
        return name().toLowerCase(Locale.ROOT);
    }
}
