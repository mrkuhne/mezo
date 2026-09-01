package io.mrkuhne.mezo.feature.companion.config;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
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
    @NotNull @Valid Consolidation consolidation,
    @NotNull @Valid Recall recall,
    @NotNull @Valid Patterns patterns,
    @NotNull @Valid Hypotheses hypotheses,
    @NotNull @Valid HabitSuggest habitSuggest,
    @NotNull @Valid Transcription transcription,
    @NotNull @Valid AmbientRecall ambientRecall,
    @NotNull @Valid Graph graph,
    @NotNull List<@Valid Intervention> interventions
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
        @Min(0) @Max(1000) int checkinNoteMaxChars,
        /**
         * The workout-level closing note (mezo-d20.13) is included VERBATIM, truncated to this
         * many characters — never summarized. The note is the user's own sentence about how the
         * session went, and summarizing it is what destroys the numbers, hedges and specifics
         * that make it worth carrying at all; truncation is honestly lossy, rewriting fabricates.
         * 0 turns the injection off. Applies per note, and the snapshot rides EVERY chat turn.
         */
        @Min(0) @Max(1000) int workoutNoteMaxChars
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
        @Min(200) @Max(20000) int embedMaxChars,
        /** W1.5: embed activity_log.text / check_in.note in the nightly sweep — off = the catch-up does nothing (the pass HEALS the toggle, never bypasses it). */
        boolean embedNotes,
        /** W1.5 length gate: below this many chars a note carries no retrieval value („fáradt vagyok") and is never embedded. */
        @Min(1) @Max(500) int noteMinChars,
        /** W1.5 blast-radius guard: at most this many note embeddings per user per nightly run — the first-run history backfill spreads over nights instead of one giant burst. */
        @Min(1) @Max(5000) int noteBatchSize
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

    /**
     * W3.1 always-on ambient recall (mezo-b3pp.12, spec §7.1) — the {@code [Emlékek]} block every
     * chat turn opens with. The ANN candidate pool and the per-item render cap are REUSED from
     * {@link Recall}; since W3.3 (mezo-b3pp.14, spec §7.3) the raw-cosine floor and the recency τ
     * are PER KIND-GROUP ({@link Group}) so the block is tuned from yml alone — no number lives in code.
     */
    public record AmbientRecall(
        /** Runtime kill-switch — off ⇒ no embed call and no block; the turn is otherwise unchanged. */
        boolean enabled,
        /** W3.2 coverage cutoff: a daily_summary hit older than this many days is not asked for at
         *  all — its covering weekly/monthly rung speaks for that stretch instead. The fine-grained
         *  rows and vectors stay in the store untouched (spec §12); only recall's reach changes. */
        @Min(1) @Max(3650) int weeklyShadowDays,
        /** Hard cap on the rendered block in ESTIMATED tokens (part of the ~6k memory budget). */
        @Min(100) @Max(6000) int maxTokens,
        /** W3.3 input (mezo-b3pp.27): skip the CURRENT conversation's own chat turns — they are
         *  already in the history window, recalling them is a duplicate. */
        boolean excludeCurrentConversation,
        /** daily_summary (inside the coverage window). */
        @NotNull @Valid Group dailySummary,
        /** weekly_summary + monthly_summary — the ladder rungs (W3.2), queried without a date floor. */
        @NotNull @Valid Group periodSummary,
        /** journal_entry + reflection + gratitude + decision. */
        @NotNull @Valid Group journal,
        /** chat_turn. */
        @NotNull @Valid Group chatTurn,
        /** activity_note + checkin_note. */
        @NotNull @Valid Group other
    ) {
        /** One kind-group's tuning: how many items may enter the block, the raw-cosine floor, and τ. */
        public record Group(
            /** Items allowed into the block (0 = the group is not even queried). */
            @Min(0) @Max(10) int cap,
            /** Raw-cosine floor — below it a match is noise, not a memory (0..1). */
            @DecimalMin("0.0") @DecimalMax("1.0") double minSimilarity,
            /** τ: the recency scale in days — rank = similarity × exp(-age/τ). */
            @Min(1) @Max(3650) int decayDays
        ) {}
    }

    /** W2.1 knowledge-graph tuning (spec §6.1) — traversal bounds + nightly maintenance knobs. */
    public record Graph(
        /** Neighborhood traversal depth from a seed node (W2.4). */
        @Min(1) @Max(3) int maxHops,
        /** Top-K neighbors returned by weight (W2.4). */
        @Min(1) @Max(20) int topK,
        /** Nightly edge-weight multiplicative decay (W2.5) — e.g. 0.99 = 1%/day fade. */
        @DecimalMin("0.9") @DecimalMax("1.0") double decayFactor,
        /** Edges below this weight are soft-deleted on the nightly pass (W2.5). */
        @DecimalMin("0.0") @DecimalMax("1.0") double pruneFloor,
        /** Hard cap on the rendered [Összefüggések] block (estimated tokens, W2.4). */
        @Min(1) int renderMaxTokens,
        /** Cap on GraphNode refs emitted per turn (mezo-b3pp.33) — topK edges yield up to 2×topK
         *  node refs (each edge has two endpoints) against the shared
         *  {@code tools.max-refs-per-turn} budget, and graph refs are added LAST, so an uncapped
         *  graph turn would fill the whole footer with graph chips and truncate tool/Memory refs
         *  mid-list. */
        @Min(1) @Max(20) int maxRefs,
        /** W2.2 edge structurer: suggestions below this confidence are dropped (edges start humble). */
        @DecimalMin("0.0") @DecimalMax("1.0") double edgeConfidenceFloor,
        /** W2.5 (mezo-b3pp.10): cron for the nightly GraphMaintenanceJob (server zone). */
        @NotBlank String cron,
        /** W2.5: candidate nodes (never confirmed/rejected) older than this many days are
         *  soft-deleted — the stale L2 inbox item gets swept off the list. */
        @Min(1) @Max(365) int candidateMaxAgeDays,
        /** W2.5: fresh pattern evidence (a same-night pattern_event snapshot for a promoted
         *  pattern) bumps that node's edges by this much, capped at 1.0 — decay's counterweight
         *  for evidence still arriving. */
        @DecimalMin("0.0") @DecimalMax("1.0") double reinforcementBump,
        /** mezo-b3pp.34: cap on {@code GraphTraversalService#seedsFor}'s ranked seed list — a
         *  chatty turn can folded-word-start-match many nodes, and once the seed set is most of
         *  the graph the neighborhood walk degenerates into "the globally strongest edges"
         *  regardless of what was asked. Ranked (title hit, then distinct token hits — ties left to
         *  the stable sort's own {@code created_at desc, id} row order, a TOTAL order so recency
         *  decides but the same turn still always produces the same seed set) before this cap
         *  truncates. */
        @Min(1) @Max(50) int maxSeeds
    ) {}

    /**
     * One W5.2 intervention library entry (bd mezo-b3pp.19, spec §9.2) — the library is CONFIG,
     * not DB. {@code channel}: {@code feed} = card only; {@code push} and {@code both} are
     * synonyms (user decision 2026-08-24) — every entry writes the feed card (it is the push
     * anchor and the „Segített?" home), the channel only decides whether a push also fires.
     * {@code key} feeds the {@code feedback_rollup} scope {@code intervention:<key>} (varchar(40)
     * minus the 13-char prefix ⇒ max 27).
     */
    public record Intervention(
        @NotBlank @Pattern(regexp = "[a-z0-9_]{1,27}") String key,
        @NotBlank @Pattern(regexp = "sustained_stress|sleep_debt|momentum_at_risk|recovery_needed|all_healthy") String flag,
        @NotBlank @Pattern(regexp = "feed|push|both") String channel,
        @NotBlank @Size(max = 500) String textHu,
        @Min(1) @Max(8760) int cooldownHours,
        boolean quietHoursExempt
    ) {
    }

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

    /** AI habit suggester (mezo-n5e9.3, ADR 0019) — smart-model propose-only chain-fill suggestions. */
    public record HabitSuggest(
        /** Max suggestions the adapter asks the model for / returns (HabitAiService's own
         *  sanitize step is a defensive bounds check, not a count clamp). */
        @Min(1) @Max(20) int maxSuggestions
    ) {}

    /** Chat voice input (mezo-at8x.4) — the caps on an uploaded voice note. */
    public record Transcription(
        /** Service-level upload cap in bytes (container multipart caps sit above this). */
        @Min(1) int maxAudioBytes,
        /** Accepted audio mime types, base type only (MediaRecorder's `;codecs=` is stripped). */
        @NotEmpty List<String> allowedMimeTypes
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
        /** V3.4 ACWR/monotónia napi terhelése: ennyi kg gym-volumen ér egy sport-percet (közös skála). */
        @Min(1) @Max(10000) int loadGymKgPerMin,
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
        /** Miért figyeljük — a Motor kártya „Amit keresünk" egysorosa (mezo-18bx). */
        @NotBlank String mechanism,
        /** Kérdés-cím a Motor kártyán — „Jobban alszol, ha…?" (mezo-fj1g). */
        @NotBlank String question,
        /** A mechanizmus által várt korreláció-irány (mezo-fj1g). */
        @NotBlank @jakarta.validation.constraints.Pattern(regexp = "positive|negative") String expectedDirection,
        /** Mit jelent EMBERÜL a pozitív r ennél a párnál — {erősség} behelyettesítővel (mezo-fj1g). */
        @NotBlank String whenPositiveHu,
        /** Ugyanez negatív r-re (mezo-fj1g). */
        @NotBlank String whenNegativeHu,
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
        @Min(1) @Max(60) int catchUpDays,
        /** V3.4 digest-gazdagítás: minőségi mezőnkénti karakter-cap (check-in/alvás/futás jegyzet,
         *  említés-kivonat, intention-reflexió). */
        @Min(0) @Max(1000) int noteMaxChars
    ) {}

    /**
     * W3.2 consolidation ladder (mezo-b3pp.13, spec §7.2) — the weekly/monthly rung generator's
     * schedules and how far back each run re-offers periods. The backfill windows double as the
     * self-heal: a period whose rung is missing (job off, LLM down, brand-new history) is picked
     * up by the next run instead of needing a one-off backfill command.
     */
    public record Consolidation(
        /** Weekly rung cron (server zone) — Monday dawn, after the nightly daily-summary job. */
        @NotBlank String weeklyCron,
        /** Monthly rung cron (server zone) — the 1st, after the weekly rung of the same dawn. */
        @NotBlank String monthlyCron,
        /** Finished weeks back each weekly run checks and fills (idempotent catch-up = backfill). */
        @Min(1) @Max(520) int backfillWeeks,
        /** Finished months back each monthly run checks and fills. */
        @Min(1) @Max(120) int backfillMonths
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
