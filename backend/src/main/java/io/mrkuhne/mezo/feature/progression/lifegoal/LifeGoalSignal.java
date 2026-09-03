package io.mrkuhne.mezo.feature.progression.lifegoal;

import java.time.LocalDate;
import java.util.UUID;

/**
 * Life-goal pillar-hit signal (mezo-iizd.6): one evaluated `hit` pillar-day grants deterministic
 * XP on that pillar's own skill. {@code sourceRefId} is the caller-computed D-1 key
 * ({@code UUID.nameUUIDFromBytes("lifegoal:<pillarId>:<day>")}) — stable across the nightly job's
 * 3-day rewrites and across a pillar-day delete + recompute, so a day can never award twice.
 * {@code occurredOn} is the evaluated DAY, never the run date.
 */
public record LifeGoalSignal(
    UUID sourceRefId, String skillKey, String skillKind, int xp, String label, LocalDate occurredOn) {}
