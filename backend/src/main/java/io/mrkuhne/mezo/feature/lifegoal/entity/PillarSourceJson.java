package io.mrkuhne.mezo.feature.lifegoal.entity;

/** Closed-catalog signal source. {@code type} ∈ metric|activity|habit|weight_goal|needs_ring|social_mentions;
 *  {@code key} = MetricKey name for metric, {@code skillKey}+{@code measure} (minutes|count|huf) for activity,
 *  {@code habitKey} for habit, {@code ring} (energia|hidratacio|pihenes|mozgas|lelek|rend) for needs_ring. */
public record PillarSourceJson(String type, String key, String skillKey, String measure, String habitKey, String ring) {}
