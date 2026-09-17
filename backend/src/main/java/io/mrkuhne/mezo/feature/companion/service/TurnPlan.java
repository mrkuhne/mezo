package io.mrkuhne.mezo.feature.companion.service;

import java.util.List;
import java.util.Map;

/**
 * What the planner asked for (spec 2026-09-16 §6.2): a structured list of tool reads, never an
 * answer. {@code needsData=false} with empty steps is the planner overruling the gear downward —
 * the turn needs none of the user's data after all.
 */
public record TurnPlan(boolean needsData, List<PlanStep> steps) {

    /** One requested tool read. {@code why} is half a sentence of provenance, shown to the user later (S9.7). */
    public record PlanStep(String tool, Map<String, Object> args, String why) {}
}
