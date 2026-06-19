package io.mrkuhne.mezo.feature.goal.engine.service;

import io.mrkuhne.mezo.api.dto.WeightTrendResponse;
import io.mrkuhne.mezo.feature.goal.engine.GoalEngineProperties;
import io.mrkuhne.mezo.feature.goal.entity.GoalEntity;
import io.mrkuhne.mezo.feature.goal.entity.GoalPrescriptionJson.GuardStatus;
import io.mrkuhne.mezo.feature.train.entity.ExerciseSetEntity;
import io.mrkuhne.mezo.feature.train.entity.MuscleGroupVolumeLogEntity;
import io.mrkuhne.mezo.feature.train.repository.ExerciseRepository;
import io.mrkuhne.mezo.feature.train.repository.ExerciseRepository.ExerciseIdentityRow;
import io.mrkuhne.mezo.feature.train.repository.ExerciseSetRepository;
import io.mrkuhne.mezo.feature.train.repository.MuscleGroupVolumeLogRepository;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * The G5 <b>soft guards</b> (spec §5.3, D9 — these WARN, they never block or throw). Three legs:
 *
 * <ol>
 *   <li><b>Strength (e1RM):</b> active iff {@code "strength" ∈ goal.guards}. Computes the main lift's
 *       estimated-1RM trend by reusing the {@code ExerciseRecordService} aggregation idiom — group
 *       the owner's logged sets by lift identity ({@code catalog_id} else {@code name}, resolved over
 *       soft-deleted rows too), discard {@code reps > 10}, take the Epley e1RM
 *       ({@code weight × (30 + reps) / 30}). The main lift = the identity with the most logged
 *       weighted sets; its trend % is the change between the best e1RM in an early window and a recent
 *       window. {@code breached} when that % drops to {@code strength.e1rmBreachPct} (−5%) or below.</li>
 *   <li><b>Muscle volume:</b> active iff {@code "muscle" ∈ goal.guards}. Reads the per-muscle prescribed
 *       weekly hard sets ({@code MuscleGroupVolumeLog.currentSets}) across the goal's linked mesos;
 *       {@code minWeeklySetsPerMuscle} = the floor across muscles, {@code belowMaintenanceMuscles} =
 *       muscles under {@code volume.warnBelow} (6).</li>
 *   <li><b>Rate cap (on the muscle leg):</b> {@code rateWithinCap} compares the <b>trailing-4w</b> EWMA
 *       slope ({@code trend.last4wRateKgPerWeek}, converted to %BW/wk via the latest trend weight)
 *       against {@code rate.capPctPerWeek} (1.0 %/wk). The trailing window is used deliberately — the
 *       whole-series OLS slope lags ~2× in the first weeks and would under-warn (Task 4/6 handoff).</li>
 * </ol>
 *
 * <p><b>Protein leg is deferred</b> — Fuel intake logging is not built, so {@code proteinMonitored} is
 * always {@code false} (the protein TARGET is still prescribed in Task 8; it is just not monitored
 * here) and a note records it.
 *
 * <p>Stateless, constructor-injected, read-only (no {@code @Transactional}); never throws — an absent
 * guard, empty volume logs, or no logged sets all yield a well-formed (inactive/empty) status.
 */
@Service
@RequiredArgsConstructor
public class GuardEvaluationService {

    private static final String GUARD_STRENGTH = "strength";
    private static final String GUARD_MUSCLE = "muscle";

    /** Epley reps cap — sets above this are too far from a true 1RM to estimate (spec / surface). */
    private static final int MAX_E1RM_REPS = 10;

    /** Trailing window (days) that counts as the "recent" e1RM bucket for the trend. */
    private static final int RECENT_WINDOW_DAYS = 14;

    private static final BigDecimal THIRTY = new BigDecimal("30");
    private static final BigDecimal ONE_HUNDRED = new BigDecimal("100");
    private static final int PCT_SCALE = 2;

    private final ExerciseSetRepository exerciseSetRepository;
    private final ExerciseRepository exerciseRepository;
    private final MuscleGroupVolumeLogRepository volumeLogRepository;
    private final GoalEngineProperties props;

    /**
     * Evaluate the soft guards for {@code goal} against its linked mesos and the live weight trend.
     *
     * @param goal           the goal — {@code guards} selects which legs are active
     * @param linkedMesoIds  the mesocycle ids linked to the goal (the volume-guard scope)
     * @param trend          the EWMA weight trend (Task 4) — the rate-cap input
     * @return a fully-populated {@link GuardStatus}; never null, never throwing
     */
    public GuardStatus evaluate(GoalEntity goal, Collection<UUID> linkedMesoIds, WeightTrendResponse trend) {
        List<String> guards = goal.getGuards() == null ? List.of() : goal.getGuards();
        UUID userId = goal.getCreatedBy();
        boolean strengthActive = guards.contains(GUARD_STRENGTH);
        boolean muscleActive = guards.contains(GUARD_MUSCLE);

        return new GuardStatus(
            strengthActive ? evaluateStrength(userId) : inactiveStrength(),
            muscleActive ? evaluateMuscle(userId, linkedMesoIds, trend) : inactiveMuscle());
    }

    // ── strength leg ──────────────────────────────────────────────────────────────────────────────

    private GuardStatus.Strength evaluateStrength(UUID userId) {
        List<ExerciseSetEntity> sets = exerciseSetRepository.findByCreatedByAndRepsNotNull(userId).stream()
            .filter(s -> s.getWeightKg() != null && s.getReps() != null && s.getReps() <= MAX_E1RM_REPS)
            .toList();
        if (sets.isEmpty()) {
            // strength guard requested but no logged lifts yet → active but nothing to flag.
            return new GuardStatus.Strength(true, null, false,
                List.of("Még nincs elég naplózott szett az erő-trendhez."));
        }

        Map<UUID, ExerciseIdentityRow> identity =
            exerciseRepository.findIdentityRowsIncludingDeleted(userId).stream()
                .collect(Collectors.toMap(ExerciseIdentityRow::getId, r -> r, (a, b) -> a));

        // Group by lift identity = catalog_id when present, else name (the ExerciseRecordService rule).
        Map<String, List<ExerciseSetEntity>> byLift = new LinkedHashMap<>();
        for (ExerciseSetEntity s : sets) {
            ExerciseIdentityRow row = identity.get(s.getExerciseId());
            if (row == null) {
                continue;
            }
            String key = row.getCatalogId() != null ? "c:" + row.getCatalogId() : "n:" + row.getName();
            byLift.computeIfAbsent(key, k -> new ArrayList<>()).add(s);
        }
        if (byLift.isEmpty()) {
            return new GuardStatus.Strength(true, null, false,
                List.of("Még nincs elég naplózott szett az erő-trendhez."));
        }

        // Main lift = the identity with the most logged weighted sets (most signal).
        List<ExerciseSetEntity> mainLift = byLift.values().stream()
            .max(Comparator.comparingInt(List::size)).orElseThrow();

        BigDecimal trendPct = e1rmTrendPct(mainLift);
        if (trendPct == null) {
            return new GuardStatus.Strength(true, null, false,
                List.of("Még nincs elég naplózott szett az erő-trendhez."));
        }

        boolean breached = trendPct.compareTo(BigDecimal.valueOf(props.strength().e1rmBreachPct())) <= 0;
        List<String> notes = new ArrayList<>();
        if (breached) {
            notes.add("Erő-visszaesés: a fő gyakorlat becsült 1RM-je " + trendPct.toPlainString()
                + "%-kal csökkent (küszöb " + props.strength().e1rmBreachPct() + "%).");
        }
        return new GuardStatus.Strength(true, trendPct, breached, notes);
    }

    /**
     * The e1RM trend (%) of one lift's sets: best Epley e1RM in a recent trailing window vs. the best
     * in the earlier window. Returns null when the lift lacks data in both windows (no trend defined).
     */
    private BigDecimal e1rmTrendPct(List<ExerciseSetEntity> liftSets) {
        Instant latest = liftSets.stream().map(this::setInstant).max(Comparator.naturalOrder()).orElse(null);
        if (latest == null) {
            return null;
        }
        Instant cutoff = latest.minusSeconds((long) RECENT_WINDOW_DAYS * 24 * 3600);
        BigDecimal recentBest = bestE1rm(liftSets.stream().filter(s -> !setInstant(s).isBefore(cutoff)).toList());
        BigDecimal earlyBest = bestE1rm(liftSets.stream().filter(s -> setInstant(s).isBefore(cutoff)).toList());
        if (recentBest == null || earlyBest == null || earlyBest.signum() == 0) {
            return null; // need both windows populated for a trend.
        }
        return recentBest.subtract(earlyBest)
            .divide(earlyBest, 6, RoundingMode.HALF_UP)
            .multiply(ONE_HUNDRED)
            .setScale(PCT_SCALE, RoundingMode.HALF_UP);
    }

    private BigDecimal bestE1rm(List<ExerciseSetEntity> group) {
        return group.stream().map(this::epley).max(Comparator.naturalOrder()).orElse(null);
    }

    /** Epley estimated 1RM: weight × (1 + reps/30) = weight × (30 + reps) / 30 (matches ExerciseRecordService). */
    private BigDecimal epley(ExerciseSetEntity s) {
        return s.getWeightKg().multiply(BigDecimal.valueOf(30L + s.getReps()))
            .divide(THIRTY, 4, RoundingMode.HALF_UP);
    }

    private Instant setInstant(ExerciseSetEntity s) {
        return s.getDoneAt() != null ? s.getDoneAt() : s.getCreatedAt();
    }

    // ── muscle-volume + rate-cap leg ────────────────────────────────────────────────────────────────

    private GuardStatus.Muscle evaluateMuscle(
        UUID userId, Collection<UUID> linkedMesoIds, WeightTrendResponse trend) {

        List<MuscleGroupVolumeLogEntity> logs = (linkedMesoIds == null || linkedMesoIds.isEmpty())
            ? List.of()
            : volumeLogRepository.findByCreatedByAndMesocycleIdInOrderByMuscleAsc(userId, linkedMesoIds);

        int warnBelow = props.volume().warnBelow();
        Integer minSets = logs.stream()
            .map(MuscleGroupVolumeLogEntity::getCurrentSets)
            .min(Comparator.naturalOrder())
            .orElse(null);

        // Distinct muscles whose prescribed weekly sets sit below the warn floor (6).
        List<String> belowMaintenance = logs.stream()
            .filter(l -> l.getCurrentSets() != null && l.getCurrentSets() < warnBelow)
            .map(MuscleGroupVolumeLogEntity::getMuscle)
            .distinct()
            .toList();

        boolean rateWithinCap = rateWithinCap(trend);

        List<String> notes = new ArrayList<>();
        if (!belowMaintenance.isEmpty()) {
            notes.add("Karbantartás alatti heti volumen: " + String.join(", ", belowMaintenance)
                + " (warn-küszöb " + warnBelow + " szett/hét; karbantartás "
                + props.volume().maintenanceSets() + ").");
        }
        if (!rateWithinCap) {
            notes.add("A megfigyelt 4 hetes fogyási/hízási ütem meghaladja a "
                + props.rate().capPctPerWeek() + " %BW/hét sapkát.");
        }
        // Protein leg deferred — Fuel intake logging is not built (always documented).
        notes.add("A fehérjebevitel nincs monitorozva (Fuel modul még nincs kész); a cél csak előírásként jelenik meg.");

        return new GuardStatus.Muscle(
            true, minSets, belowMaintenance, rateWithinCap, false, notes);
    }

    /**
     * Rate-cap check on the <b>trailing-4w</b> EWMA slope (NOT the lagging whole-series slope, which
     * under-warns in the first weeks — Task 4/6 handoff). Converts {@code last4wRateKgPerWeek} to
     * %BW/wk via the latest trend weight and compares its magnitude to {@code rate.capPctPerWeek}.
     * Missing/zero trend data → within cap (nothing to warn about yet).
     */
    private boolean rateWithinCap(WeightTrendResponse trend) {
        if (trend == null || trend.getLast4wRateKgPerWeek() == null
            || trend.getLatestTrendKg() == null || trend.getLatestTrendKg().signum() == 0) {
            return true;
        }
        BigDecimal pctPerWeek = trend.getLast4wRateKgPerWeek()
            .divide(trend.getLatestTrendKg(), 6, RoundingMode.HALF_UP)
            .multiply(ONE_HUNDRED)
            .abs();
        return pctPerWeek.compareTo(BigDecimal.valueOf(props.rate().capPctPerWeek())) <= 0;
    }

    // ── inactive defaults ─────────────────────────────────────────────────────────────────────────

    private GuardStatus.Strength inactiveStrength() {
        return new GuardStatus.Strength(false, null, false, List.of());
    }

    private GuardStatus.Muscle inactiveMuscle() {
        return new GuardStatus.Muscle(false, null, List.of(), true, false, List.of());
    }
}
