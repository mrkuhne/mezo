package io.mrkuhne.mezo.feature.progression.quest;

import java.util.UUID;

/** Input of the quest XP grant: one completed daily quest routes xp to one skill (any band). */
public record QuestSignal(
    UUID questId,
    String skillKey,
    String skillKind,   // ATHLETIC | MUSCLE | LIFE
    int xp,
    String label        // quest title — shown as workoutLabel in the level-up overlay
) {}
