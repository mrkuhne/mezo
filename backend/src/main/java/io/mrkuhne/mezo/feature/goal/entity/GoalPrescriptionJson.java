package io.mrkuhne.mezo.feature.goal.entity;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;

/**
 * The segmented recept produced by the G5 engine, persisted as the {@code goal.prescription} jsonb
 * column. Mirrors the contract {@code GoalPrescription} schema (spec §3.3 / §5): per-segment
 * kcal/protein/sleep/rest targets plus the guard + feasibility status. Enum-typed contract fields
 * ({@code basis}, {@code feasibility.verdict}) stay plain {@code String} here; {@code GoalMapper}
 * projects them to the generated DTO enums.
 *
 * <p>Plain record with nested records, no Jackson/Hibernate annotations — Hibernate's
 * {@code @JdbcTypeCode(SqlTypes.JSON)} on the entity field serializes it via the app
 * {@code ObjectMapper} (copies the {@code ProvenanceEnvelope} idiom).
 */
public record GoalPrescriptionJson(
    OffsetDateTime generatedAt,
    String basis, // formula | adaptive
    List<Segment> segments,
    GuardStatus guardStatus,
    Feasibility feasibility
) {

    public record Segment(
        Integer fromWeek,
        Integer toWeek,
        String label,
        Integer kcal,
        Integer proteinG,
        BigDecimal sleepTargetH,
        List<Integer> restDays,
        BigDecimal projectedRateKgPerWk,
        String rationale
    ) {
    }

    public record GuardStatus(Strength strength, Muscle muscle) {

        public record Strength(
            Boolean active,
            BigDecimal e1rmTrendPct,
            Boolean breached,
            List<String> notes
        ) {
        }

        public record Muscle(
            Boolean active,
            Integer minWeeklySetsPerMuscle,
            List<String> belowMaintenanceMuscles,
            Boolean rateWithinCap,
            Boolean proteinMonitored,
            List<String> notes
        ) {
        }
    }

    public record Feasibility(
        String verdict, // feasible | feasible-with-warnings | aggressive
        List<String> notes
    ) {
    }
}
