package io.mrkuhne.mezo.feature.progression;

import java.util.List;
import lombok.AccessLevel;
import lombok.NoArgsConstructor;

/** Fixed skill taxonomy for the profile aggregation (spec §1). */
@NoArgsConstructor(access = AccessLevel.PRIVATE)
public final class ProgressionTaxonomy {

    public static final String ROBUSTNESS = "robustness";

    /** 11 non-robustness athletic skills — drive athlete-level + the radar. */
    public static final List<String> ATHLETIC = List.of(
        "explosiveness", "vertical_jump", "sprint_speed", "aerobic_capacity", "anaerobic_capacity",
        "strength_endurance", "core_stability", "max_strength", "coordination", "mobility", "agility");

    /** 13 muscle tokens — exact Train tokens (ExerciseCatalogLoader.MUSCLES). */
    public static final List<String> MUSCLE = List.of(
        "back-mid", "lats", "chest", "shoulder", "rear-delt", "biceps", "triceps",
        "quad", "ham", "glute", "calf", "core", "traps");

    /** LIFE skills (gamified growth E2, spec §3) — octagon order on the Me GrowthCard. */
    public static final List<String> LIFE = List.of(
        "mindfulness", "mindset", "cooking", "financial",
        "productivity", "learning", "connection", "recovery");
}
