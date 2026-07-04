package io.mrkuhne.mezo.feature.companion.config;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

import java.util.List;

/** Companion tuning (mezo.companion). LLM model tiers per ADR 0008 — config, never code. */
@Validated
@ConfigurationProperties(prefix = "mezo.companion")
public record CompanionProperties(
    @NotNull @Valid Llm llm,
    @NotNull @Valid Chat chat,
    @NotNull @Valid Snapshot snapshot,
    @NotNull @Valid Tools tools,
    @NotNull @Valid Facts facts,
    @NotNull @Valid Extraction extraction,
    @NotNull @Valid Advisors advisors,
    @NotNull @Valid Embedding embedding,
    @NotNull @Valid Summary summary,
    @NotNull @Valid Recall recall,
    @NotNull @Valid Patterns patterns,
    @NotNull @Valid Hypotheses hypotheses
) {
    /** Provider model tiers (Gemini per ADR 0008; swap = YAML edit, no code change). */
    public record Llm(
        @NotBlank String chatModel,   // gemini-2.5-flash — cheap/fast, every conversational turn
        @NotBlank String smartModel   // gemini-2.5-pro — heavy pipelines (V3.2 critique); unused until then
    ) {}

    /** Chat turn tuning — history window fed into the prompt + auto-title truncation. */
    public record Chat(
        /** How many prior messages (user+assistant rows, 20 ≈ 10 turns) are windowed into the system prompt. */
        @Min(0) @Max(200) int historyWindow,
        /** Auto-title = first user message truncated to this many chars (DB column caps at 120). */
        @Min(10) @Max(120) int titleMaxChars
    ) {}

    /** Context-snapshot (V0.3) windows — how much of "today" the system prompt carries. */
    public record Snapshot(
        /** How many days back the train digest (gym/sport/run counts) looks, including today. */
        @Min(1) @Max(30) int digestDays,
        /** The latest check-in note is included verbatim, truncated to this many characters. */
        @Min(0) @Max(1000) int checkinNoteMaxChars
    ) {}

    /** V1.1 knowledge-fact injection — how much confirmed memory rides in every system prompt. */
    public record Facts(
        /** Top-N facts (by reinforcement count, then newest) injected into the system prompt. */
        @Min(1) @Max(50) int topN,
        /** V3.3: freshly promoted pattern-facts younger than this many days get an in-chat acknowledgment block (0 = off). */
        @Min(0) @Max(30) int patternAckDays
    ) {}

    /** V1.2 post-turn fact extraction — async, per-turn, LLM-backed candidate capture. */
    public record Extraction(
        /** Master toggle — off removes the AFTER_COMMIT listener bean entirely (COMPANION_EXTRACTION_SWITCH). */
        boolean enabled,
        /** Max learned_fact candidates persisted per chat turn (dedupe runs before the cap). */
        @Min(1) @Max(10) int maxCandidatesPerTurn
    ) {}

    /** V1.3 post-response advisor chain — clinical output check + LLM verdict (redundancy/grounding-lite). */
    public record Advisors(
        /** Master toggle — off removes the chain beans entirely (COMPANION_ADVISORS_SWITCH). */
        boolean enabled,
        /** Corrective re-prompts a violating answer gets before shipping degraded (old docs §4.5: 1). */
        @Min(0) @Max(2) int maxRetries,
        /** Prescription-med terms the clinical check guards (accent-folded contains-match). */
        @NotEmpty List<String> rxTerms
    ) {}

    /** V2.1 embedding port — which provider model produces memory vectors (+ V2.2 pipeline tuning). */
    public record Embedding(
        /** gemini-embedding-001 (bd mezo-c30) — the 768 dimension is structural (vector(768) schema + EmbeddingPort.DIMENSIONS), not config. */
        @NotBlank String model,
        /** V2.2: embed each completed chat turn (user+assistant as one unit, post-commit async) — off removes the listener bean (COMPANION_EMBED_TURNS_SWITCH). */
        boolean embedChatTurns,
        /** Upper cap on embedded content length (chars) per narrative unit (turn / summary). */
        @Min(200) @Max(20000) int embedMaxChars
    ) {}

    /** V2.3 episodic recall (find_similar_past_days) — rank = similarity × exp(-age/τ). */
    public record Recall(
        /** τ: the recency half-scale in days — how fast an old day's relevance fades. */
        @Min(1) @Max(365) int decayDays,
        /** Upper clamp for the tool's k arg (how many days may be recalled per call). */
        @Min(1) @Max(10) int maxK,
        /** Raw-cosine-similarity floor — below it a match is noise, not a memory (0..1). */
        @DecimalMin("0.0") @DecimalMax("1.0") double minSimilarity,
        /** ANN candidates fetched before decay re-ranking (recall quality vs query cost). */
        @Min(1) @Max(100) int candidatePool,
        /** Per-memory render cap in the tool result (chars) — gist over full re-quote (token budget). */
        @Min(50) @Max(2000) int renderMaxChars
    ) {}

    /** V3.2 weekly hypothesis loop — propose → critique → revise on the smart tier. */
    public record Hypotheses(
        /** Cron for the weekly pipeline (server zone) — after the nightly jobs by convention. */
        @NotBlank String cron,
        /** Max hypotheses judged per run (the proposer is asked for this many at most). */
        @Min(1) @Max(10) int maxPerRun,
        /** Weighted-critique score at/above which a hypothesis persists (arch §4.7: 0.75). */
        @DecimalMin("0.0") @DecimalMax("1.0") double keepThreshold,
        /** Score at/above which a borderline hypothesis gets ONE revise+re-critique pass (§4.7: 0.50). */
        @DecimalMin("0.0") @DecimalMax("1.0") double reviseThreshold
    ) {}

    /** V3.1 nightly statistical pattern engine — Pearson over the metric-pair catalog. */
    public record Patterns(
        /** Cron for the nightly correlation job (server zone) — after the summary job by convention. */
        @NotBlank String cron,
        /** How many finished days back the correlation window reaches. */
        @Min(14) @Max(365) int lookbackDays,
        /** Minimum aligned sample size before a pair may surface at all (honest small-n gate). */
        @Min(3) @Max(60) int minN,
        /** V3.3: a confirmed pattern's promoted fact reinforces at most once per this many days —
         *  the nightly window slides by one day, so nightly increments would be the SAME evidence
         *  re-counted (and would crowd the top-N injection). */
        @Min(1) @Max(60) int reinforceCooldownDays,
        /** The metric-pair catalog — trim/re-lag pairs here; new metrics need a MetricKey entry. */
        @NotEmpty List<@Valid PatternPair> pairs
    ) {}

    /** One correlation candidate: two per-day metrics, an optional day lag, and its FE identity. */
    public record PatternPair(
        /** Stable pattern identity (uq (created_by, kind, pair_key)) — never rename a live key. */
        @NotBlank @jakarta.validation.constraints.Pattern(regexp = "[a-z0-9~-]{3,64}") String key,
        /** The FE PatternCategory chip. */
        @NotBlank @jakarta.validation.constraints.Pattern(regexp = "physiology|trigger|response") String category,
        /** Hungarian category chip label. */
        @NotBlank String label,
        /** The pattern card title (HU). */
        @NotBlank String title,
        @NotNull io.mrkuhne.mezo.feature.companion.service.MetricKey metricA,
        @NotNull io.mrkuhne.mezo.feature.companion.service.MetricKey metricB,
        /** metricB is read lagDays AFTER metricA's day (0 = same day). */
        @Min(0) @Max(7) int lagDays
    ) {}

    /** V2.2 nightly daily-summary job — the narrative memory's generator. */
    public record Summary(
        /** Cron for the nightly job (server zone), late enough that "yesterday" is truly finished. */
        @NotBlank String cron,
        /** How many finished days back the job checks and self-heals (idempotent catch-up = backfill). */
        @Min(1) @Max(60) int catchUpDays
    ) {}

    /** V0.5 tool-calling tuning — per-turn budget + result-window clamps (token budget by construction). */
    public record Tools(
        /** Max recorded tool calls per chat turn; past it tools soft-fail with an honest in-band message. */
        @Min(1) @Max(20) int maxCallsPerTurn,
        /** Upper clamp for the day-window tool args (days=...). */
        @Min(1) @Max(60) int maxWindowDays,
        /** Upper clamp for get_weight_trend(weeks=...). */
        @Min(1) @Max(52) int maxTrendWeeks,
        /** Max refs persisted per turn (deduped, insertion-ordered). */
        @Min(1) @Max(30) int maxRefsPerTurn
    ) {}
}
