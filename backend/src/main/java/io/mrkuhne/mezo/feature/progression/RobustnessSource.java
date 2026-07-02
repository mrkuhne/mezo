package io.mrkuhne.mezo.feature.progression;

import java.util.UUID;

/**
 * Port for the robustness (training-streak) input of the progression engine. Progression only
 * needs the number; HOW it is derived belongs to the feature that owns the session data — the
 * train slice implements this (see {@code feature/train/signal/TrainingStreakCalculator}), which
 * keeps the package dependency one-directional: train → progression, never back.
 */
public interface RobustnessSource {

    /** Consecutive training weeks ending this week (0 if the current week has no logged session). */
    int streakWeeks(UUID createdBy);
}
