package io.mrkuhne.mezo.feature.companion.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import java.util.List;

/**
 * Typed jsonb envelope for ai_message.tool_calls (ADR 0006 / ProvenanceEnvelope precedent).
 * V0.5 writes one entry per executed read tool. {@code args} is the compact display form
 * ("days=7") — V0.5 args are flat scalars, so this IS full fidelity; pre-V0.5 rows deserialize
 * with args = null. Field names {type,name} mirror the FE mock Tool contract.
 *
 * <p>This is the ASK half only, and it is kept forever. Result TEXT never lives here: it has
 * exactly one home, {@code ai_message.tool_outcomes} ({@link ToolOutcomesEnvelope}), which the
 * 90-day retention scrub NULLs. A second copy here would silently outlive that scrub — the
 * mezo-rj214.10 / S9.7 unification exists to prevent precisely that.
 */
public record ToolCallsEnvelope(List<ToolCall> calls) {

    /**
     * {@code ignoreUnknown} is load-bearing, not boilerplate. Hibernate reads this jsonb through a
     * plain Jackson 2 ObjectMapper, which fails on an unknown key by default — and rows written
     * during the short window when mezo-rj214.10 stored a 4th {@code "result"} component here
     * carry exactly such a key. Tolerating it lets those rows load with their ask intact; their
     * result text is simply not read from here, because tool_outcomes is its only home.
     */
    @JsonIgnoreProperties(ignoreUnknown = true)
    public record ToolCall(String type, String name, String args, String why) {

        /** Legacy JSON and the ran-truth audit path keep the pre-S9.7 shape; {@code why} exists
         *  only on a planned (pipeline) turn, where the planner said why it wanted this read. */
        public ToolCall(String type, String name, String args) {
            this(type, name, args, null);
        }
    }
}
