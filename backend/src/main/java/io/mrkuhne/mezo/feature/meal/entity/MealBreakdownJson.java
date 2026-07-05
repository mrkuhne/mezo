package io.mrkuhne.mezo.feature.meal.entity;

import java.math.BigDecimal;
import java.util.List;

/**
 * Typed envelope for the {@code meal.breakdown} jsonb column — the deterministic 4-dimension
 * meal score (mezo-yta, ADR 0006). Mirrors the FE {@code MealBreakdown} shape minus the
 * presentation-only {@code color} (the FE mapper injects the constant per-dimension colors).
 * Mapped via {@code @JdbcTypeCode(SqlTypes.JSON)} (the Train {@code ProvenanceEnvelope} pattern).
 *
 * <p>{@code value} duplicates the denormalized {@code meal.score} column by design (ADR 0006 §4);
 * {@code MealScoringService} writes both atomically. {@code summary} and {@code improve} are
 * Phase-3 (P8) prose — {@code null}/empty in v0, never fabricated. {@code tools} lists the honest
 * deterministic provenance (what the scorer actually read/computed).
 *
 * <p>The envelope is also the MICRO SNAPSHOT: the nutrition-quality rows are computed from the
 * live pantry/recipe sources at write time and frozen here — a later source edit never rewrites
 * a logged meal's score (same rationale as the {@code meal_item.snapshot*} columns).
 */
public record MealBreakdownJson(
    BigDecimal value,
    BigDecimal confidence,
    String summary,
    List<Dimension> dimensions,
    List<ImproveRow> improve,
    List<ToolRow> tools
) {

    /**
     * One weighted dimension; exactly one of {@code macro}/{@code micros}/{@code nova}/
     * {@code context} is populated, matching {@code id}. A dimension with zero input coverage
     * degrades honestly: {@code weight 0, score 0} + a "nincs adat" detail (the total
     * renormalizes over the remaining weights).
     */
    public record Dimension(
        String id,
        String label,
        BigDecimal weight,
        BigDecimal score,
        String detail,
        MacroDetail macro,
        List<MicroRow> micros,
        NovaDetail nova,
        List<ContextRow> context
    ) {
    }

    /** Meal P/C/F kcal-shares vs the config target shares; {@code notes} is P8 prose (null in v0). */
    public record MacroDetail(
        BigDecimal ratioP, BigDecimal ratioC, BigDecimal ratioF,
        String targetP, String targetC, String targetF,
        BigDecimal kcalShareOfDay, String notes
    ) {
    }

    /**
     * One nutrition-quality row. Fiber: {@code pct} = % of the per-meal allotment reached;
     * limit rows (sugar/salt/satFat): {@code pct} = % of the allotment used, {@code low} = over.
     */
    public record MicroRow(String name, String value, int pct, String status) {
    }

    /** kcal-weighted NOVA distribution over the meal's lines. */
    public record NovaDetail(int dominant, List<NovaStackRow> stack, List<NovaItemRow> items) {
    }

    public record NovaStackRow(int nova, int pct, String label) {
    }

    public record NovaItemRow(String name, int nova, boolean warning) {
    }

    /** One deterministic context fact (timing / slot-share / protein fit). */
    public record ContextRow(String label, String value) {
    }

    /** P8 prose — always empty in v0. */
    public record ImproveRow(String text, String impact) {
    }

    /** Honest provenance: what the deterministic scorer read/computed ({@code read|compute|write}). */
    public record ToolRow(String type, String name) {
    }
}
