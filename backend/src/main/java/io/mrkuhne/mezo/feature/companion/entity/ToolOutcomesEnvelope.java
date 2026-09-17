package io.mrkuhne.mezo.feature.companion.entity;

import java.util.List;

/**
 * Typed jsonb envelope for ai_message.tool_outcomes (S9.7, mezo-rj214.7) — the RESULT half of a
 * turn's provenance, positionally parallel to {@link ToolCallsEnvelope#calls()}. Split from the
 * ask half on purpose: the 90-day retention scrub NULLs this column and keeps the plan, so the
 * two must be nullable independently.
 *
 * <p>{@code text} is the tool's own Hungarian output, already truncated by the builder;
 * {@code failed} marks a step that timed out, errored or was dropped for budget — shown honestly
 * rather than hidden.
 */
public record ToolOutcomesEnvelope(List<Outcome> outcomes) {

    public record Outcome(String name, String text, boolean failed) {
    }

    /** Null (not an empty envelope) when the turn retrieved nothing — every pre-S9.7 row is null. */
    public static ToolOutcomesEnvelope ofOrNull(List<Outcome> outcomes) {
        return outcomes == null || outcomes.isEmpty() ? null : new ToolOutcomesEnvelope(List.copyOf(outcomes));
    }
}
