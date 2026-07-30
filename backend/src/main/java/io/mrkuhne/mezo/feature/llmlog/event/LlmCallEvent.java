package io.mrkuhne.mezo.feature.llmlog.event;

import io.mrkuhne.mezo.feature.llmlog.service.LlmCallRecord;
import java.time.Instant;
import java.util.UUID;

/**
 * The audit record on its way to the writer (mezo-2zyu). The recorder resolves the two things the
 * adapter cannot know — WHO called and WHEN — on the ORIGINATING thread, because the async writer
 * runs on a pool thread with neither a security context nor the call's clock.
 *
 * @param record    what the adapter observed
 * @param createdBy the calling user; null for unauthenticated (cron) threads — {@code created_by} is nullable
 * @param startedAt the call's start instant, which also picks the day the prices are frozen from
 */
public record LlmCallEvent(LlmCallRecord record, UUID createdBy, Instant startedAt) {}
