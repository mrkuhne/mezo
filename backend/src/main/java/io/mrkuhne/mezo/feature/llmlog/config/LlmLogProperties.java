package io.mrkuhne.mezo.feature.llmlog.config;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/** LLM call audit log tuning (mezo.llm-log) — payload cap + the async writer's executor. */
@Validated
@ConfigurationProperties(prefix = "mezo.llm-log")
public record LlmLogProperties(
    /** Prompt/response payloads are truncated to this many characters before persisting. */
    @Positive int maxPayloadChars,
    @NotNull @Valid Executor executor
) {
    /** The audit-writer thread pool — small by design; logging must never starve the request path. */
    public record Executor(@Positive int coreSize, @Positive int maxSize, @Positive int queueCapacity) {}
}
