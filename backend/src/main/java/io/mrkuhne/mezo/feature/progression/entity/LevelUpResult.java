package io.mrkuhne.mezo.feature.progression.entity;

import java.util.List;

/** The level-up payload persisted into level_up_event.payload (jsonb) and returned to the FE (P2+). */
public record LevelUpResult(
    String source,            // GYM|SPORT|RUN
    String workoutLabel,
    Integer durationMin,
    Integer rpe,
    long totalXp,
    List<Gain> gains,
    List<String> levelUps,
    List<Perk> perks,
    Robustness robustness
) {
    public record Gain(String skillKey, String kind, String name, String icon,
        long xpGained, int levelBefore, int levelAfter, double progressFromPct, double progressToPct) {}

    public record Perk(String skillKey, String perkKey, String name, String effectCopy, int milestoneLevel) {}

    public record Robustness(long xpGained, int streakWeeks) {}
}
