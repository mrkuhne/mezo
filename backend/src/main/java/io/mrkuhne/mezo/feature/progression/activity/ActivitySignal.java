package io.mrkuhne.mezo.feature.progression.activity;

import java.util.UUID;

/** Input of the activity XP grant: one categorized activity-log entry routes xp to one LIFE skill. */
public record ActivitySignal(
    UUID activityId,
    String skillKey,   // LIFE taxonomy key
    int xp,            // already clamped + capped by ActivityService (ADR 0010 guardrails)
    String label       // truncated entry text — shown as workoutLabel in the level-up overlay
) {}
