package io.mrkuhne.mezo.feature.habit;

import java.util.List;
import lombok.AccessLevel;
import lombok.NoArgsConstructor;

/**
 * The fixed skill-key vocabulary habits ({@code habit_def.skill_key}) and life-goal pillars
 * ({@code life_goal_pillar.skill_key}) are validated against. Moved here unchanged from the retired
 * {@code progression} package (mezo-r36n9.97.5) — the XP engine is gone, the keys stay the category
 * vocabulary of the kept areas. Lives in {@code habit} because {@code lifegoal} already depends on it.
 */
@NoArgsConstructor(access = AccessLevel.PRIVATE)
public final class SkillTaxonomy {

    public static final String ROBUSTNESS = "robustness";

    /** 11 non-robustness athletic skills. */
    public static final List<String> ATHLETIC = List.of(
        "explosiveness", "vertical_jump", "sprint_speed", "aerobic_capacity", "anaerobic_capacity",
        "strength_endurance", "core_stability", "max_strength", "coordination", "mobility", "agility");

    /** 13 muscle tokens — exact Train tokens (ExerciseCatalogLoader.MUSCLES). */
    public static final List<String> MUSCLE = List.of(
        "back-mid", "lats", "chest", "shoulder", "rear-delt", "biceps", "triceps",
        "quad", "ham", "glute", "calf", "core", "traps");

    /** LIFE skills — the categories habits are filed under. */
    public static final List<String> LIFE = List.of(
        "mindfulness", "mindset", "cooking", "financial",
        "productivity", "learning", "connection", "recovery");
}
