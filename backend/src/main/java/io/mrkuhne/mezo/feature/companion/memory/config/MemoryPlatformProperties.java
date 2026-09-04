package io.mrkuhne.mezo.feature.companion.memory.config;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/** Versioned canonical memory projection, retrieval and audit configuration. */
@Validated
@ConfigurationProperties(prefix = "mezo.companion.memory-platform")
public record MemoryPlatformProperties(
        /** Vector generation used by online retrieval. */
        @NotBlank String servingEmbeddingVersion,
        /** Provider recorded on generated vector rows. */
        @NotBlank String embeddingProvider,
        /** Provider model recorded on generated vector rows. */
        @NotBlank String embeddingModel,
        /** Canonical projection schema version written to memory items. */
        @Min(1) @Max(10) int schemaVersion,
        /** Online retrieval limits. */
        @NotNull @Valid Retrieval serving,
        /** Offline generation backfill controls. */
        @NotNull @Valid Reembedding reembedding,
        /** Retrieval audit retention controls. */
        @NotNull @Valid Audit audit) {

    public record Retrieval(
            /** Candidates requested from each retriever before fusion. */
            @Min(1) @Max(100) int candidateLimit,
            /** Maximum memory-context budget for chat, in estimated tokens. */
            @Min(60) @Max(6000) int chatMaxTokens,
            /** Maximum characters retained from one projected item. */
            @Min(1) @Max(2000) int itemMaxChars) {
    }

    public record Reembedding(
            /** Enables the scheduled re-embedding job without changing the serving generation. */
            boolean enabled,
            /** Generation created or repaired by the scheduled job. */
            @NotBlank String targetVersion,
            /** Maximum items processed per user and run. */
            @Min(1) @Max(500) int batchSize,
            /** Scheduled re-embedding cron in server time. */
            @NotBlank String cron) {
    }

    public record Audit(
            /** Days retrieval audit rows remain available. */
            @Min(1) @Max(365) int retentionDays,
            /** Scheduled retrieval-audit retention cron in server time. */
            @NotBlank String retentionCron) {
    }
}
