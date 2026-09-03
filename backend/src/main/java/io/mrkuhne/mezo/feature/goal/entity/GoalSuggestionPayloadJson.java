package io.mrkuhne.mezo.feature.goal.entity;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * Typed body of a {@link GoalSuggestionEntity}, persisted as the {@code payload} jsonb column
 * (app-ObjectMapper serialized via {@code @JdbcTypeCode(SqlTypes.JSON)}, the
 * {@code GoalPrescriptionJson} idiom). A {@code phase_change} carries EITHER
 * {@code suggestedTrajectory} (meso preset ↔ goal trajectory mismatch) OR
 * {@code balanceOverrideKcal}+{@code fromWeek}+{@code toWeek} (deload → maintenance-leaning week).
 * {@code snapshotTrajectory} is the accept-time race guard: the goal's trajectory at proposal
 * time — a mismatch at accept means the goal changed underneath and the suggestion is stale.
 *
 * <p>A {@code weekly_correction} (diet-plan slice 5) carries the fields after
 * {@code snapshotTrajectory} instead (that one stays null on this kind): the reviewed week,
 * the signed kcal/day correction + the observed/target rates it was computed from, whether it
 * was sleep-damped, the adherence context, and {@code prescriptionGeneratedAt} — this kind's
 * accept-time race guard (the goal's {@code prescription.generatedAt} at proposal time; every
 * material goal change re-evaluates, so a mismatch means the numbers are stale).
 */
public record GoalSuggestionPayloadJson(
    String reason,               // shared: phase_change rationale / weekly_correction Hungarian rationale
    String suggestedTrajectory,  // cut|bulk|maintain, nullable
    Integer balanceOverrideKcal, // kcal/day override (0 = maintenance), nullable
    Integer fromWeek,            // goal-week span of the override, nullable
    Integer toWeek,
    UUID mesoId,                 // the triggering mesocycle, nullable
    String mesoTitle,
    String snapshotTrajectory,   // phase_change race guard, null on weekly_correction
    // ── weekly_correction fields (slice 5), all null on phase_change payloads ──
    String weekStart,                  // ISO date of the reviewed week's Monday (mirrors the dedup key)
    Integer deltaKcal,
    BigDecimal observedRateKgPerWk,
    BigDecimal targetRateKgPerWk,
    Boolean dampedBySleep,
    Integer adherenceLoggedDays,
    Integer adherenceAvgIntakeKcal,
    Integer adherenceAvgTargetKcal,
    OffsetDateTime prescriptionGeneratedAt // accept-time race guard for weekly_correction
) {
}
