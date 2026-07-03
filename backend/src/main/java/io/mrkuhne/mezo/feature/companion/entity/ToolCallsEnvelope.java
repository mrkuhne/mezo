package io.mrkuhne.mezo.feature.companion.entity;

import java.util.List;

/**
 * Typed jsonb envelope for ai_message.tool_calls (ADR 0006 / ProvenanceEnvelope precedent).
 * V0.2 only persists null; V0.5 (tool calling) starts writing entries and may extend ToolCall
 * with args/result fields. Field names mirror the FE mock Tool contract { type, name }.
 */
public record ToolCallsEnvelope(List<ToolCall> calls) {

    public record ToolCall(String type, String name) {
    }
}
