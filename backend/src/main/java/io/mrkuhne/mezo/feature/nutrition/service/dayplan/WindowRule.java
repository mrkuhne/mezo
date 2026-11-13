package io.mrkuhne.mezo.feature.nutrition.service.dayplan;

/**
 * Which rule placed a window (the web planner's {@code WindowRule}) — it decides how wide the
 * window opens around its anchored time ({@link WindowPlacer#widen}) and which copy the client may
 * show for "miért ekkor?".
 */
public enum WindowRule {
    BREAKFAST, MAIN, SNACK,
    PRE_TRAINING_MAIN, PRE_TRAINING_SNACK, POST_TRAINING,
    TEMPLATE_WAKE, TEMPLATE_BED, TEMPLATE_FIXED, TEMPLATE_TRAINING_START, TEMPLATE_TRAINING_END
}
