package io.mrkuhne.mezo.feature.llmlog.config;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.time.ZoneId;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/** LLM call audit log tuning (mezo.llm-log) — payload cap, report zone + the async writer's executor. */
@Validated
@ConfigurationProperties(prefix = "mezo.llm-log")
public record LlmLogProperties(
    /** Prompt/response payloads are truncated to this many characters before persisting. */
    @Positive int maxPayloadChars,
    /**
     * The wall clock the usage rollups are cut on (mezo-h3gb): "today", "this week" and "this
     * month" are the user's calendar periods, not UTC ones, so the server zone must not decide it.
     * Bound as a {@link ZoneId} so an unknown zone id fails at startup, not at first request.
     */
    @NotNull ZoneId reportZone,
    @NotNull @Valid Executor executor,
    @NotNull @Valid Retention retention
) {
    /** The audit-writer thread pool — small by design; logging must never starve the request path. */
    public record Executor(@Positive int coreSize, @Positive int maxSize, @Positive int queueCapacity) {}

    /**
     * mezo-1y3p payload retention: the four payload columns are NULLed after {@code payloadDays};
     * cost/token metadata is kept forever (the ADR 0014 founding purpose is retention-proof).
     */
    public record Retention(@Positive int payloadDays, @NotBlank String cron) {}
}
