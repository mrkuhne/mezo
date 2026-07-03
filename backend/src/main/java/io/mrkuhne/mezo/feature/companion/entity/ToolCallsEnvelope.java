package io.mrkuhne.mezo.feature.companion.entity;

import java.util.List;

/**
 * Typed jsonb envelope for ai_message.tool_calls (ADR 0006 / ProvenanceEnvelope precedent).
 * V0.5 writes one entry per executed read tool. {@code args} is the compact display form
 * ("days=7") — V0.5 args are flat scalars, so this IS full fidelity; pre-V0.5 rows deserialize
 * with args = null. Field names {type,name} mirror the FE mock Tool contract.
 */
public record ToolCallsEnvelope(List<ToolCall> calls) {

    public record ToolCall(String type, String name, String args) {
    }
}
