package io.mrkuhne.mezo.feature.companion.config;

import jakarta.validation.Valid;
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
    @NotNull @Valid Summary summary
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
        @Min(1) @Max(50) int topN
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
