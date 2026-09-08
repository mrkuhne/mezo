package io.mrkuhne.mezo.feature.companion.memory.config;

import io.mrkuhne.mezo.feature.companion.memory.dto.ConsumerPolicy;
import io.mrkuhne.mezo.feature.companion.memory.dto.RetrievalServingMode;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Positive;
import java.util.Map;
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
        /** Chat rollout mode: legacy serving, background comparison, or unified serving. */
        @NotNull RetrievalServingMode servingMode,
        /** Online retrieval limits. */
        @NotNull @Valid Retrieval serving,
        /** Offline generation backfill controls. */
        @NotNull @Valid Reembedding reembedding,
        /** Retrieval audit retention controls. */
        @NotNull @Valid Audit audit,
        /** Deterministic rank-fusion weights and bounded modifiers. */
        @NotNull @Valid Fusion fusion,
        /** Parallel retriever execution limits. */
        @NotNull @Valid Execution execution,
        /** Optional uncertainty reranking controls. */
        @NotNull @Valid Reranker reranker,
        /** Human-readable context indicator thresholds. */
        @NotNull @Valid Indicators indicators,
        /** Per-consumer overrides of the online serving limits. */
        @NotNull @Valid Policies policies) {

    /**
     * The retrieval limits for one {@link ConsumerPolicy} (mezo-eq85.7 shared seam) — the ONE
     * place {@link io.mrkuhne.mezo.feature.companion.memory.service.MemoryContextService},
     * {@link io.mrkuhne.mezo.feature.companion.memory.service.LlmMemoryReranker} and every
     * {@link io.mrkuhne.mezo.feature.companion.memory.service.MemoryContextBlock} caller read the
     * numbers from — no consumer branches its own copy.
     *
     * <p>{@code REFLECTION} and {@code CHAT_AMBIENT} are adapted from their PRE-EXISTING config
     * shapes rather than moved into new {@link PolicyLimits} records: Task 3's
     * {@link ReflectionPolicy} has no {@code enabled} switch and must never gain a silent way to
     * be turned off, so it is always reported {@code enabled=true} here — the caller's own
     * {@code deep} argument, not this record, is what actually decides retrieval depth. Lives on
     * the top-level record (not on {@link Policies}) because {@code CHAT_AMBIENT} needs
     * {@link #serving()}, which {@link Policies} cannot see.
     */
    public PolicyLimits limitsFor(ConsumerPolicy policy) {
        return switch (policy) {
            case REFLECTION -> new PolicyLimits(true, policies.reflection().candidateLimit(),
                    policies.reflection().maxTokens(), policies.reflection().rerank(), false);
            case CHAT_AMBIENT -> new PolicyLimits(
                    true, serving.candidateLimit(), serving.chatMaxTokens(), false, false);
            case MORNING_BRIEFING -> policies.morningBriefing();
            case WEEKLY_MEMOIR -> policies.weeklyMemoir();
            case PREDICTION_EVIDENCE -> policies.predictionEvidence();
            case SIMILAR_DAYS -> policies.similarDays();
            case CHARACTER_EVIDENCE -> policies.characterEvidence();
            case EXTRACTION -> policies.extraction();
            case PERSONAL_CONTEXT -> policies.personalContext();
        };
    }

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

    public record Fusion(
            /** Reciprocal-rank denominator constant. */
            @Min(1) @Max(1000) int rrfConstant,
            /** Weight applied to each named retriever's reciprocal-rank contribution. */
            @NotEmpty Map<@NotBlank String, @Positive Double> retrieverWeights,
            /** Additive score for an explicitly pinned candidate. */
            @DecimalMin("0.0") @DecimalMax("0.02") double pinnedBoost,
            /** Maximum source-reliability boost. */
            @DecimalMin("0.0") @DecimalMax("0.02") double sourceReliabilityMaxBoost,
            /** Maximum boost for an item inside an explicit query window. */
            @DecimalMin("0.0") @DecimalMax("0.02") double temporalMaxBoost,
            /** Maximum absolute salience adjustment. */
            @DecimalMin("0.0") @DecimalMax("0.02") double salienceMaxAdjustment,
            /** Maximum mild recency boost. */
            @DecimalMin("0.0") @DecimalMax("0.02") double recencyMaxBoost) {
    }

    public record Execution(
            /** Independent timeout applied to each retriever future. */
            @Min(1) @Max(10000) int retrieverTimeoutMs) {
    }

    public record Reranker(
            /** Enables LLM reranking on policy-allowed uncertain requests. */
            boolean enabled,
            /** Top-two score gap below which deterministic fusion is uncertain. */
            @DecimalMin(value = "0.0", inclusive = false) @DecimalMax("1.0") double uncertaintyDelta,
            /** Maximum candidates exposed to the reranker. */
            @Min(1) @Max(100) int maxCandidates,
            /** Maximum characters exposed from one candidate. */
            @Min(1) @Max(2000) int maxContentChars,
            /** Hard deadline for the optional smart-tier model call. */
            @Min(1) @Max(10000) int timeoutMs) {
    }

    public record Policies(
            /** Reflexió S3 (mezo-eq85.3): the offline nightly-reflection consumer. */
            @NotNull @Valid ReflectionPolicy reflection,
            /** Memória mindenhol S7 (mezo-eq85.7): the four proactive companion messages
             *  (morning/sleep/weight/window) share this ONE policy — none of the seven configured
             *  consumers below is specific to a single proactive-feed kind. */
            @NotNull @Valid PolicyLimits morningBriefing,
            /** Reflexió/Memoir weekly-consolidation retrieval (a later Part-B task's consumer). */
            @NotNull @Valid PolicyLimits weeklyMemoir,
            /** Prediction-evidence retrieval backing a forecast (a later Part-B task's consumer). */
            @NotNull @Valid PolicyLimits predictionEvidence,
            /** "Find similar past days" episodic-recall retrieval. */
            @NotNull @Valid PolicyLimits similarDays,
            /** Character-evidence retrieval backing a proposal/observation. */
            @NotNull @Valid PolicyLimits characterEvidence,
            /** Post-turn fact-extraction's own retrieval — deliberately lean and cheap. */
            @NotNull @Valid PolicyLimits extraction,
            /** Personal-context retrieval for a non-chat, non-reflection surface. */
            @NotNull @Valid PolicyLimits personalContext) {
    }

    public record ReflectionPolicy(
            /** Candidates requested from each retriever before fusion. */
            @Min(1) @Max(100) int candidateLimit,
            /** Maximum memory-context budget for one reflection call, in estimated tokens. */
            @Min(60) @Max(6000) int maxTokens,
            /** Allows the LLM reranker on every reflection retrieval (no latency gate offline). */
            boolean rerank) {
    }

    /**
     * A per-consumer override of the online serving limits (mezo-eq85.7). {@code enabled} lets a
     * surface be rolled back to "no memory context" purely by config; {@code deep} documents
     * whether the consumer TYPICALLY wants the deep-query variant — the actual retrieval call
     * still decides depth via its own explicit argument, this is metadata for that call site.
     */
    public record PolicyLimits(
            /** Off ⇒ the consumer's {@code [Emlékek]}-equivalent block is always {@code ""} and no
             *  {@code memory_retrieval_run} row is written — a surface-level kill switch. */
            boolean enabled,
            /** Candidates requested from each retriever before fusion. */
            @Min(1) @Max(100) int candidateLimit,
            /** Maximum memory-context budget for this consumer, in estimated tokens. */
            @Min(60) @Max(6000) int maxTokens,
            /** Allows the LLM reranker for this consumer (still gated by the global switch). */
            boolean rerank,
            /** Whether this consumer typically requests the deep-query variant. */
            boolean deep) {
    }

    public record Indicators(
            /** Age after which an otherwise active memory is labelled old. */
            @Min(1) @Max(36500) int oldAfterDays) {
    }
}
