package io.mrkuhne.mezo.feature.progression.habit;

import java.util.UUID;

/** Completion signal from the habit feature — all habits land on LIFE skills in v1. */
public record HabitSignal(UUID habitDayId, String skillKey, int xp, String label) {}
