package io.mrkuhne.mezo.feature.companion.entity;

import java.util.List;

/** Typed jsonb envelope for the pattern's evidence chips (the ToolCallsEnvelope precedent). */
public record PatternEvidenceEnvelope(List<String> items) {
}
