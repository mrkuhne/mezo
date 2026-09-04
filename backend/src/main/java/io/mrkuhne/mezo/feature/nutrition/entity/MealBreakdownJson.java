package io.mrkuhne.mezo.feature.nutrition.entity;

import java.math.BigDecimal;
import java.util.List;

/**
 * Typed envelope for the {@code meal.breakdown} jsonb column — the deterministic meal score
 * (8-dimension set since mezo-7797) (mezo-yta, ADR 0006). Mirrors the FE {@code MealBreakdown} shape minus the
 * presentation-only {@code color} (the FE mapper injects the constant per-dimension colors).
 * Mapped via {@code @JdbcTypeCode(SqlTypes.JSON)} (the Train {@code ProvenanceEnvelope} pattern).
 *
 * <p>{@code value} duplicates the denormalized {@code meal.score} column by design (ADR 0006 §4);
 * {@code MealScoringService} writes both atomically. {@code summary}, {@code tagline} and
 * {@code improve} are the prose sockets — the deterministic scorer always writes them
 * {@code null}/empty and never fabricates prose; the meal-coach layer (mezo-mr4n) fills them
 * lazily, {@code tagline} being the card-sized cut. {@code tools} lists the honest deterministic
 * provenance (what the scorer actually read/computed).
 *
 * <p>The envelope is also the MICRO SNAPSHOT: the nutrition-quality rows are computed from the
 * live pantry/recipe sources at write time and frozen here — a later source edit never rewrites
 * a logged meal's score (same rationale as the {@code meal_item.snapshot*} columns).
 *
 * <p>{@code formulaVersion} a scorer FORMULA-generációja, nem a jsonb séma verziója
 * ({@link io.mrkuhne.mezo.feature.nutrition.service.MealScoringService#FORMULA_VERSION}).
 * A mezo-jcpt.1 ELŐTT írt envelope-okban hiányzik (deszerializáláskor {@code null}) — ez a
 * „0-s generáció", amit a mezo-jcpt.2 backfill újrapontoz. NEM lép ki a wire-re: a
 * {@code BreakdownDtoMapper} mezőnként képez és ezt kihagyja.
 */
public record MealBreakdownJson(
    BigDecimal value,
    BigDecimal confidence,
    String summary,
    String tagline,
    List<Dimension> dimensions,
    List<ImproveRow> improve,
    List<ToolRow> tools,
    Integer formulaVersion
) {

    /**
     * One weighted dimension; exactly one of {@code macro}/{@code micros}/{@code nova}/
     * {@code context} is populated, matching {@code id}. A dimension with zero input coverage
     * degrades honestly: {@code weight 0, score 0} + a "nincs adat" detail (the total
     * renormalizes over the remaining weights). {@code timing} rides alongside {@code context}
     * (mezo-jcpt.3): the eating-window facts for the {@code context} dimension of a LOGGED meal —
     * null for every other dimension and for the recipe-template surface (no {@code context}
     * dimension there at all). {@code note} is a 1-2 sentence AI prose socket (mezo-jcpt) — the
     * deterministic scorer always writes it {@code null}; the meal-coach layer fills it lazily,
     * mirroring {@code MealCoachVerdict.dimensionNotes}.
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
        List<ContextRow> context,
        TimingDetail timing,
        String note
    ) {
    }

    /**
     * Meal P/C/F kcal-shares vs the config target shares.
     *
     * @param notes @deprecated superseded by the dim-level {@link Dimension#note} (mezo-jcpt);
     *     nobody reads it — kept only so existing stored envelopes still deserialize.
     */
    public record MacroDetail(
        BigDecimal ratioP, BigDecimal ratioC, BigDecimal ratioF,
        String targetP, String targetC, String targetF,
        BigDecimal kcalShareOfDay, @Deprecated String notes
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

    /** A `context` dimenzió időzítés-tényei rajzolható alakban (mezo-jcpt.3). Új, opcionális mező:
     *  a már cache-elt envelope-okban null, és a FE ilyenkor egyszerűen nem rajzol sávot. */
    public record TimingDetail(String eatenAt, String windowFrom, String windowTo, String slotLabel) {
    }

    /** P8 prose — always empty in v0. */
    public record ImproveRow(String text, String impact) {
    }

    /** Honest provenance: what the deterministic scorer read/computed ({@code read|compute|write}). */
    public record ToolRow(String type, String name) {
    }
}
