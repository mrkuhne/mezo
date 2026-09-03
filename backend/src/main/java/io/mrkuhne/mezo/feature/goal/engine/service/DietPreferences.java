package io.mrkuhne.mezo.feature.goal.engine.service;

/** Resolved diet preferences — a saved row's values or the config ghost; never null fields except the custom pcts. */
public record DietPreferences(
    String splitPreset,
    Integer proteinPctX10,
    Integer carbsPctX10,
    Integer fatPctX10,
    String proteinTier,
    int waterMl,
    int fiberG
) {}
