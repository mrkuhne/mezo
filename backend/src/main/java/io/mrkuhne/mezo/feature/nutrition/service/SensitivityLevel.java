package io.mrkuhne.mezo.feature.nutrition.service;

import java.util.Locale;

/** How seriously a sensitivity is taken (spec §7.1, owner decision 8). */
public enum SensitivityLevel {
    ALLERGY, INTOLERANCE, AVOID;

    public String wire() {
        return name().toLowerCase(Locale.ROOT);
    }

    public static SensitivityLevel fromWire(String wire) {
        return valueOf(wire.trim().toUpperCase(Locale.ROOT));
    }
}
