package io.mrkuhne.mezo.feature.llmlog.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/**
 * One audited LLM call (mezo-2zyu) — request shape, outcome, usage counters, the verbatim
 * prompt/response payload and the frozen {@link PricingSnapshot} the cost was derived from.
 *
 * <p><b>INSERT-only by design.</b> Unlike every other owned table here, this one deliberately has
 * NO {@code is_deleted} / {@code @SQLDelete} / {@code @SQLRestriction}: an audit row is immutable
 * history, and a "soft-deletable" audit trail is not an audit trail. Rows leave only by retention
 * pruning (a hard DELETE), never through the app's normal write paths.
 *
 * <p>It also does NOT extend {@code OwnedEntity} for the same reason (that superclass mandates the
 * soft-delete column); {@code createdBy} + {@code createdAt} are declared locally, and
 * {@code created_by} is nullable so a pruned user cannot take the cost history with them
 * ({@code on delete set null}).
 *
 * <p>Most columns are nullable on purpose: each {@link CallKind} fills its own block (generation
 * tokens vs. embedding counters vs. image counters), and an ERROR row carries neither usage nor
 * cost — honestly empty beats zeroed.
 */
@Getter
@Setter
@Entity
@Table(name = "llm_log_history")
public class LlmLogEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(columnDefinition = "uuid")
    private UUID id;

    /** The calling user; null once that user is deleted — the cost row itself survives. */
    @Column(name = "created_by", updatable = false)
    private UUID createdBy;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    // ── what was called ──────────────────────────────────────────────────────────

    @NotNull
    @Enumerated(EnumType.STRING)
    @Column(name = "call_kind", nullable = false, columnDefinition = "text")
    private CallKind callKind;

    /** Call-site slug (e.g. {@code companion_chat}) — the primary grouping axis for cost reports. */
    @NotNull
    @Column(nullable = false, columnDefinition = "text")
    private String feature;

    /** Finer-grained operation inside the feature (optional). */
    @Column(columnDefinition = "text")
    private String operation;

    /** Domain object the call was about (e.g. {@code meal}) — free-form, no FK. */
    @Column(name = "entity_kind", columnDefinition = "text")
    private String entityKind;

    @Column(name = "entity_id")
    private UUID entityId;

    /** The model we ASKED for — may differ from {@link #servedModel} on provider-side aliasing. */
    @NotNull
    @Column(name = "requested_model", nullable = false, columnDefinition = "text")
    private String requestedModel;

    /** The model the provider actually billed; null when the call never reached one. */
    @Column(name = "served_model", columnDefinition = "text")
    private String servedModel;

    // ── how it went ──────────────────────────────────────────────────────────────

    @NotNull
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, columnDefinition = "text")
    private CallStatus status;

    @Column(name = "error_code", columnDefinition = "text")
    private String errorCode;

    @Column(name = "error_class", columnDefinition = "text")
    private String errorClass;

    @Column(name = "latency_ms", nullable = false)
    private int latencyMs;

    @Column(nullable = false)
    private boolean streamed;

    @Column(name = "tool_rounds")
    private Integer toolRounds;

    @Column(name = "service_tier", columnDefinition = "text")
    private String serviceTier;

    // ── usage: generation ────────────────────────────────────────────────────────

    /**
     * Billable prompt tokens. Gemini reports {@code cachedContentTokenCount} as a SUBSET of
     * {@code promptTokenCount}; the writer stores the cached slice EXCLUDED here (see
     * {@code LlmPricingService#computeGenerationCost}).
     */
    @Column(name = "prompt_tokens")
    private Integer promptTokens;

    @Column(name = "candidates_tokens")
    private Integer candidatesTokens;

    @Column(name = "thoughts_tokens")
    private Integer thoughtsTokens;

    @Column(name = "cached_tokens")
    private Integer cachedTokens;

    /** Provider-reported total, kept verbatim — never recomputed from the parts. */
    @Column(name = "total_tokens")
    private Integer totalTokens;

    // ── usage: embedding ─────────────────────────────────────────────────────────

    @Column(name = "embed_input_count")
    private Integer embedInputCount;

    @Column(name = "embed_dimensions")
    private Integer embedDimensions;

    @Column(name = "embed_billable_chars")
    private Integer embedBillableChars;

    // ── payload ──────────────────────────────────────────────────────────────────

    @Column(name = "system_prompt", columnDefinition = "text")
    private String systemPrompt;

    @Column(name = "user_message", columnDefinition = "text")
    private String userMessage;

    @Column(name = "response_text", columnDefinition = "text")
    private String responseText;

    /** Whether any of the three payload columns was cut to the configured cap. */
    @Column(nullable = false)
    private boolean truncated;

    /** Size of the stored payload (post-truncation) — the retention/growth signal. */
    @Column(name = "payload_bytes", nullable = false)
    private int payloadBytes;

    // ── usage: vision ────────────────────────────────────────────────────────────

    @Column(name = "image_count")
    private Integer imageCount;

    @Column(name = "image_bytes_total")
    private Long imageBytesTotal;

    @Column(name = "image_mime", columnDefinition = "text")
    private String imageMime;

    // ── cost ─────────────────────────────────────────────────────────────────────

    /** Unit prices frozen at write time; null when the served model was unpriced. */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "pricing_snapshot", columnDefinition = "jsonb")
    private PricingSnapshot pricingSnapshot;

    /** Derived from {@link #pricingSnapshot}, never from live config; null when unpriced. */
    @Column(name = "cost_usd", precision = 12, scale = 6)
    private BigDecimal costUsd;
}
