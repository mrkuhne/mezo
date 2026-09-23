package io.mrkuhne.mezo.feature.proactive.entity;

import io.mrkuhne.mezo.feature.companion.entity.RefsEnvelope;
import io.mrkuhne.mezo.feature.companion.entity.ToolCallsEnvelope;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** Internal provenance only; does not change the feed's public DTO. */
public record FeedGenerationTrace(int schemaVersion, Instant asOf, List<UUID> priorMessageIds,
        List<UUID> retrievalRunIds, ToolCallsEnvelope toolCalls, List<RefsEnvelope.Ref> sourceRefs,
        String degradedReason) { }
