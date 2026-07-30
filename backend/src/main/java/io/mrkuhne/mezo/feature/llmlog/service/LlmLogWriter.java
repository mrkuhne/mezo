package io.mrkuhne.mezo.feature.llmlog.service;

import io.mrkuhne.mezo.feature.llmlog.config.LlmLogProperties;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContext;
import io.mrkuhne.mezo.feature.llmlog.entity.CallKind;
import io.mrkuhne.mezo.feature.llmlog.entity.LlmLogEntity;
import io.mrkuhne.mezo.feature.llmlog.entity.PricingSnapshot;
import io.mrkuhne.mezo.feature.llmlog.event.LlmCallEvent;
import io.mrkuhne.mezo.feature.llmlog.repository.LlmLogRepository;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.ZoneOffset;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Turns an observed {@link LlmCallRecord} into the {@code llm_log_history} row (mezo-2zyu): field
 * mapping, payload capping, and the frozen pricing snapshot the cost is derived from.
 *
 * <p>It runs OFF the request path on the dedicated {@code llmLogExecutor} pool, and
 * {@link #onLlmCall} swallows everything: a full disk, a broken price map or a DB hiccup may cost
 * us an audit row, but it must never surface in the user's LLM call.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class LlmLogWriter {

    private final LlmLogRepository llmLogRepository;
    private final LlmPricingService llmPricingService;
    private final LlmLogProperties llmLogProperties;

    /** The async hop. Never rethrows — see the class javadoc. */
    @Async("llmLogExecutor")
    @EventListener
    public void onLlmCall(LlmCallEvent event) {
        try {
            persist(event);
        } catch (Exception ex) {
            log.warn("llm_log write failed for feature {}", featureOf(event), ex);
        }
    }

    /**
     * The mapping itself, kept public and self-contained so integration tests can drive it
     * synchronously.
     *
     * <p>{@code REQUIRES_NEW}: the audit write owns its transaction and must not be enlisted in (or
     * rolled back with) whatever the caller was doing. Reached through the proxy this is a real new
     * transaction; on the internal {@link #onLlmCall} → {@code persist} self-invocation the proxy is
     * bypassed and the repository's own transaction commits the row — same outcome, single insert.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void persist(LlmCallEvent event) {
        LlmCallRecord record = event.record();
        LlmCallContext context = record.context() != null ? record.context() : LlmCallContext.UNKNOWN;

        LlmLogEntity entity = new LlmLogEntity();
        entity.setCreatedBy(event.createdBy());
        entity.setCallKind(record.callKind());
        entity.setFeature(context.feature() != null ? context.feature() : LlmCallContext.UNKNOWN.feature());
        entity.setOperation(context.operation());
        entity.setEntityKind(context.entityKind());
        entity.setEntityId(context.entityId());
        entity.setRequestedModel(record.requestedModel());
        entity.setServedModel(record.servedModel());
        entity.setStatus(record.status());
        entity.setErrorCode(record.errorCode());
        entity.setErrorClass(record.errorClass());
        entity.setLatencyMs((int) record.latencyMs());
        entity.setStreamed(record.streamed());
        entity.setToolRounds(record.toolRounds());
        entity.setServiceTier(record.serviceTier());
        applyTokens(entity, record.tokens());
        applyEmbed(entity, record.embed());
        applyPayload(entity, record);
        applyImages(entity, record);
        applyCost(entity, record, event.startedAt());

        llmLogRepository.save(entity);
    }

    /** Provider counters copied verbatim — cached stays INSIDE prompt, exactly as reported. */
    private void applyTokens(LlmLogEntity entity, TokenUsage tokens) {
        if (tokens == null) {
            return;
        }
        entity.setPromptTokens(tokens.prompt());
        entity.setCandidatesTokens(tokens.candidates());
        entity.setThoughtsTokens(tokens.thoughts());
        entity.setCachedTokens(tokens.cached());
        entity.setTotalTokens(tokens.total());
    }

    private void applyEmbed(LlmLogEntity entity, EmbedUsage embed) {
        if (embed == null) {
            return;
        }
        entity.setEmbedInputCount(embed.inputCount());
        entity.setEmbedDimensions(embed.dimensions());
        entity.setEmbedBillableChars(embed.billableChars());
    }

    private void applyImages(LlmLogEntity entity, LlmCallRecord record) {
        entity.setImageCount(record.imageCount());
        entity.setImageBytesTotal(record.imageBytesTotal());
        entity.setImageMime(record.imageMime());
    }

    /**
     * Each payload column is capped at {@code mezo.llm-log.max-payload-chars} so one runaway prompt
     * cannot bloat the table; {@code payload_bytes} keeps the TRUE pre-truncation UTF-8 size, which
     * is what makes the cut visible instead of silent.
     */
    private void applyPayload(LlmLogEntity entity, LlmCallRecord record) {
        int cap = llmLogProperties.maxPayloadChars();
        long bytes = utf8Length(record.systemPrompt())
            + utf8Length(record.userMessage())
            + utf8Length(record.responseText());

        entity.setPayloadBytes((int) Math.min(bytes, Integer.MAX_VALUE));
        entity.setSystemPrompt(cap(record.systemPrompt(), cap));
        entity.setUserMessage(cap(record.userMessage(), cap));
        entity.setResponseText(cap(record.responseText(), cap));
        entity.setTruncated(isOverCap(record.systemPrompt(), cap)
            || isOverCap(record.userMessage(), cap)
            || isOverCap(record.responseText(), cap));
    }

    /**
     * Freezes the day's unit prices onto the row and derives the cost from THAT snapshot.
     *
     * <p>Storage keeps the RAW provider counts (prompt INCLUDES cached — physically honest), but
     * {@code cachedContentTokenCount} is a SUBSET of {@code promptTokenCount}: billing the full
     * prompt at the input rate AND the cached slice again at the cached rate would overcharge it
     * twice. So the NET prompt is what gets billed at the input rate.
     */
    private void applyCost(LlmLogEntity entity, LlmCallRecord record, Instant startedAt) {
        Instant when = startedAt != null ? startedAt : Instant.now();
        PricingSnapshot snapshot =
            llmPricingService.snapshot(record.servedModel(), when.atZone(ZoneOffset.UTC).toLocalDate());
        entity.setPricingSnapshot(snapshot);

        if (record.callKind() == CallKind.EMBED_DOC || record.callKind() == CallKind.EMBED_QUERY) {
            entity.setCostUsd(llmPricingService.computeEmbeddingCost(snapshot, entity.getEmbedBillableChars()));
            return;
        }
        Integer cached = entity.getCachedTokens();
        Integer netPrompt = entity.getPromptTokens() == null
            ? null
            : entity.getPromptTokens() - (cached == null ? 0 : cached);
        entity.setCostUsd(llmPricingService.computeGenerationCost(
            snapshot, netPrompt, entity.getCandidatesTokens(), entity.getThoughtsTokens(), cached));
    }

    private static String featureOf(LlmCallEvent event) {
        LlmCallContext context = event.record() != null ? event.record().context() : null;
        return context != null ? context.feature() : LlmCallContext.UNKNOWN.feature();
    }

    private static boolean isOverCap(String value, int cap) {
        return value != null && value.length() > cap;
    }

    private static String cap(String value, int cap) {
        return isOverCap(value, cap) ? value.substring(0, cap) : value;
    }

    private static int utf8Length(String value) {
        return value == null ? 0 : value.getBytes(StandardCharsets.UTF_8).length;
    }
}
