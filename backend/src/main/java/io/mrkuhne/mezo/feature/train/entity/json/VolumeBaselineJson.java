package io.mrkuhne.mezo.feature.train.entity.json;

/** Per-muscle volume baseline (name + MEV/MAV/MRV) — mirrors the contract's {@code VolumeBaseline} schema. */
public record VolumeBaselineJson(String name, Integer mev, Integer mav, Integer mrv) {}
