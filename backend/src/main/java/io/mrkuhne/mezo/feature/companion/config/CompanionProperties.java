package io.mrkuhne.mezo.feature.companion.config;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/** Companion tuning (mezo.companion). LLM model tiers per ADR 0008 — config, never code. */
@Validated
@ConfigurationProperties(prefix = "mezo.companion")
public record CompanionProperties(
    @NotNull @Valid Llm llm,
    @NotNull @Valid Chat chat,
    @NotNull @Valid Snapshot snapshot,
    @NotNull @Valid Tools tools,
    @NotNull @Valid Facts facts
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
