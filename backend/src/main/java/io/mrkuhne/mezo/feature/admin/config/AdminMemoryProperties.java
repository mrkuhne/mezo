package io.mrkuhne.mezo.feature.admin.config;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * {@code mezo.admin.memory} — the RAG explorer's tuning knobs (mezo-4qyt).
 *
 * <p>Deliberately does NOT carry the RRF constant, the per-retriever fusion weights or the graph
 * decay factor: those are the COMPANION's, read live from {@code MemoryPlatformProperties} /
 * {@code CompanionProperties}. Duplicating them here would let the explorer draw a score
 * decomposition with different constants than the pipeline actually fused with, which is the one
 * thing this surface exists to make trustworthy.
 */
@Validated
@ConfigurationProperties(prefix = "mezo.admin.memory")
public record AdminMemoryProperties(
        /** Server-side PCA output dimensionality handed to the client's UMAP. */
        @Min(2) @Max(200) int pcaTargetDims,
        /** Above this many ready vectors the map samples (newest + most salient first). */
        @Min(100) @Max(100_000) int vectorSampleThreshold,
        /** Default k for the neighbour probe. */
        @Min(1) @Max(50) int neighborDefaultK,
        /** SET LOCAL statement_timeout applied to every native/dynamic query in this slice. */
        @NotNull Duration statementTimeout,
        /** Upper clamp for the run list page size; an oversized request is clamped, never rejected. */
        @Min(1) @Max(500) int runsMaxPageSize,
        /** Bucket count for the /health edge-weight histogram. */
        @Min(2) @Max(50) int edgeWeightHistogramBuckets,
        /** llm_log_history.feature label the dry-run replay bills under. */
        @NotBlank String replayFeatureLabel) {

    /** {@code statementTimeout} in the form Postgres accepts after {@code SET LOCAL}. */
    public String statementTimeoutSql() {
        return statementTimeout.toMillis() + "ms";
    }
}
