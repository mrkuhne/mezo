package io.mrkuhne.mezo.feature.train.service;

/** Style-table row class of an exercise (mezo-r36n9.79). Pure. */
public enum ExerciseClass {
    COMPOUND_STABLE, COMPOUND_FREE, ISOLATION;

    public boolean compound() {
        return this != ISOLATION;
    }

    /** Classify by exercise type + catalog stability; null for plyo (never stamped) or an unknown type. */
    public static ExerciseClass of(String type, boolean stable) {
        if (type == null) return null;
        return switch (type) {
            case "compound" -> stable ? COMPOUND_STABLE : COMPOUND_FREE;
            case "isolation" -> ISOLATION;
            default -> null;
        };
    }
}
