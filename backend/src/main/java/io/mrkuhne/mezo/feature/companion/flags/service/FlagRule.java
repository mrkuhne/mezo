package io.mrkuhne.mezo.feature.companion.flags.service;

import java.time.LocalDate;
import java.util.UUID;

/**
 * One deterministic composite-flag rule (spec 2026-09-03 §3.1): pure arithmetic over
 * MetricSeriesService series, every threshold from FlagProperties, no writes. Implementations are
 * one-class-per-rule so each rule carries its own reads and stays reviewable in isolation;
 * FlagEvaluator orchestrates them and owns the all_healthy special case.
 */
public interface FlagRule {

    /** The rule's verdict for {@code userId} on {@code today}, cooldowns NOT applied. */
    FlagVerdict evaluate(UUID userId, LocalDate today);
}
