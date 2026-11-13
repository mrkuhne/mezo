package io.mrkuhne.mezo.feature.nutrition.service;

import java.util.Locale;

/**
 * One allergen key's state on a catalog row or a recipe rollup (spec §7.1). {@link #UNKNOWN} is the
 * default for a key nobody has declared and is never silently treated as free-of.
 */
public enum AllergenState {
    CONTAINS, TRACES, UNKNOWN;

    /** Wire (lowercase) value of the contract enum. */
    @com.fasterxml.jackson.annotation.JsonValue
    public String wire() {
        return name().toLowerCase(Locale.ROOT);
    }

    @com.fasterxml.jackson.annotation.JsonCreator
    public static AllergenState fromWire(String wire) {
        return valueOf(wire.trim().toUpperCase(Locale.ROOT));
    }

    /** Severity order for the recipe rollup: CONTAINS beats TRACES beats UNKNOWN. */
    public boolean outranks(AllergenState other) {
        return ordinal() < other.ordinal();
    }
}
