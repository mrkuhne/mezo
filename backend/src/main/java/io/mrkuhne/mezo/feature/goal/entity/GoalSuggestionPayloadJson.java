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
 * {@code snapshotTrajectory} instead — for THIS kind, {@code snapshotTrajectory} is populated too
 * (the goal's trajectory at proposal time; it's the phase_change field, but it's legal to reuse
 * it here since it's nullable in the contract): the reviewed week, the signed kcal/day correction
 * + the observed/target rates it was computed from, whether it was sleep-damped, the adherence
 * context, {@code prescriptionGeneratedAt} (display/debug only, see below), and the two
 * propose-time goal snapshots that are the REAL accept-time race guard —
 * {@code snapshotRateTargetPctPerWeek} + {@code snapshotBalanceAdjustmentKcal}.
 *
 * <p><b>Why not {@code prescriptionGeneratedAt} as the guard (final-review fix, mezo-r4n7):</b>
 * {@code prescription.generatedAt} rotates on EVERY engine recompute (weigh-in, profile edit,
 * diet-settings save, any schedule edit — §3's recompute triggers) whether or not anything the
 * correction actually depends on changed, so an exact-equality guard on it 409s a Monday proposal
 * the instant the owner logs their next weigh-in — the suggestion never gets a chance to be
 * accepted before it goes stale again, and nothing re-proposes until next Monday. The fix
 * snapshots the SEMANTIC inputs instead — {@code snapshotTrajectory}, the goal's
 * {@code rateTargetPctPerWeek}, and its {@code balanceAdjustmentKcal}, all read at propose time —
 * and {@code GoalSuggestionService.applyWeeklyCorrection} compares those against the goal's LIVE
 * values at accept time; {@code prescriptionGeneratedAt} stays on the payload for display/debug
 * only, no longer guarded on.
 */
public record GoalSuggestionPayloadJson(
    String reason,               // shared: phase_change rationale / weekly_correction Hungarian rationale
    String suggestedTrajectory,  // cut|bulk|maintain, nullable
    Integer balanceOverrideKcal, // kcal/day override (0 = maintenance), nullable
    Integer fromWeek,            // goal-week span of the override, nullable
    Integer toWeek,
    UUID mesoId,                 // the triggering mesocycle, nullable
    String mesoTitle,
    String snapshotTrajectory,   // phase_change race guard; populated for weekly_correction too (above)
    // ── weekly_correction fields (slice 5), all null on phase_change payloads ──
    String weekStart,                  // ISO date of the reviewed week's Monday (mirrors the dedup key)
    Integer deltaKcal,
    BigDecimal observedRateKgPerWk,
    BigDecimal targetRateKgPerWk,
    Boolean dampedBySleep,
    Integer adherenceLoggedDays,
    Integer adherenceAvgIntakeKcal,
    Integer adherenceAvgTargetKcal,
    OffsetDateTime prescriptionGeneratedAt, // display/debug only since the final-review fix (above) — NOT guarded on
    // ── accept-time race guard, weekly_correction only (final-review fix, mezo-r4n7) ──
    BigDecimal snapshotRateTargetPctPerWeek, // goal.rateTargetPctPerWeek at propose time, nullable
    Integer snapshotBalanceAdjustmentKcal    // goal.balanceAdjustmentKcal at propose time, nullable
) {
}
