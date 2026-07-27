package io.mrkuhne.mezo.feature.nutrition.service;

/**
 * The role a logged meal plays relative to the day's training (mezo-ta8p). Selects the scoring
 * rubric overlay: STANDARD = the base WHO-aligned rubric; PRE_WORKOUT / POST_WORKOUT relax the
 * carb/sugar/NOVA treatment because fast carbs are fuel / recovery, not a dietary sin.
 */
public enum MealRole {
    STANDARD,
    PRE_WORKOUT,
    POST_WORKOUT
}
