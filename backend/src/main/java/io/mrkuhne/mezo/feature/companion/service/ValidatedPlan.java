package io.mrkuhne.mezo.feature.companion.service;

import java.util.List;

/**
 * The executable subset of a {@link TurnPlan}, validated against the LIVE tool registry
 * (spec §6.3 / P3): unknown tools and unknown parameters are dropped with a recorded reason,
 * never executed blind. Two spec-listed checks are deliberately DELEGATED rather than repeated
 * here: enumerated VALUES (scope words) are prose in the @ToolParam descriptions, and WINDOW
 * bounds are clamped inside every tool via ToolText.clamp — both already have safe in-tool
 * fallbacks (mezo-xk54 item 6 pins the garbage-scope behavior), so re-validating them would be
 * a second source of truth that can drift.
 */
public record ValidatedPlan(List<TurnPlan.PlanStep> steps, List<String> rejections) {

    public boolean isEmpty() {
        return steps.isEmpty();
    }
}
