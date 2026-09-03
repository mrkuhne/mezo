package io.mrkuhne.mezo.feature.goal.engine.service;

import io.mrkuhne.mezo.api.dto.WeightTrendResponse;
import io.mrkuhne.mezo.api.dto.WeightTrendResponse.DataSufficiencyEnum;
import io.mrkuhne.mezo.feature.goal.engine.GoalEngineProperties;
import io.mrkuhne.mezo.feature.goal.entity.GoalEntity;
import io.mrkuhne.mezo.feature.goal.entity.GoalPlanLinkEntity;
import io.mrkuhne.mezo.feature.goal.entity.TdeeBootstrapJson;
import io.mrkuhne.mezo.feature.goal.repository.GoalPlanLinkRepository;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.RunningBlockEntity;
import io.mrkuhne.mezo.feature.train.entity.RunningBlockStructure.RunWeek;
import io.mrkuhne.mezo.feature.train.repository.MesocycleRepository;
import io.mrkuhne.mezo.feature.train.repository.RunningBlockRepository;
import io.mrkuhne.mezo.feature.train.service.WeeklyScheduledActivityService;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.TreeSet;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * The engine's <b>segmented projection</b> (spec §4 — hybrid projection D7). Walks the goal window
 * week-by-week in goal-week space (mirroring {@code GoalTimelineService}), determines the active
 * load set per week, collapses contiguous identical loads into {@link ProjectionSegment}s, and per
 * segment computes the TDEE estimate, the daily kcal target, and the projected weekly rate for the
 * goal's trajectory — reconciled against the live EWMA weight trend.
 *
 * <h2>Segment maintenance policy (spec §6.3)</h2>
 * A segment's maintenance TDEE is the athlete's NEAT baseline plus the weekly scheduled training
 * energy (gym + sport, segment-independent) plus this segment's running EAT — every training term is
 * MET×kg×óra based, sourced from {@link WeeklyScheduledActivityService}:
 * <ul>
 *   <li><b>Running — the per-segment EAT.</b> When a {@code running_block} link is active in a
 *       segment, the segment's TDEE gains
 *       {@code runWeeklyEatKcalPerDay(sessionsPerWeek, weightKg)} (MET_run × weight × runDefaultMin/60
 *       × sessions ÷ 7). Turning the block off removes the step — the kcal "step down" the user sees at
 *       the block boundary. Running is the clearest, highest-confidence boundary.</li>
 *   <li><b>Meso phase — a segment boundary, but a <em>zero</em> energy delta.</b> A change of
 *       mesocycle phase class (MEV→MAV→MRV→deload, read from {@code phaseCurve[weekInMeso]}) splits a
 *       segment (spec §4 names it a boundary), but does NOT move the TDEE: the lift's energy is already
 *       in the scheduled gym EAT, and the phase's effect is on training <em>volume</em> (the muscle
 *       guard, Task 7), not on expenditure. So the meso phase changes the segment label/rationale and
 *       the downstream guard, not {@code tdeeEstimate}.</li>
 *   <li><b>Gym + volleyball — scheduled, segment-independent.</b> The owner's recurring weekly gym +
 *       sport slots contribute a constant per-day EAT to every segment via
 *       {@code scheduledWeeklyEatKcalPerDay}; they are not plan-links and never split a segment
 *       (volleyball, formerly modelled as ambient, now counts explicitly through the weekly schedule).
 *       </li>
 * </ul>
 *
 * <h2>Target + projected rate</h2>
 * {@code dailyEnergyBalance = sign(trajectory) × rateTargetPctPerWeek/100 × currentWeightKg ×
 * kcalPerKg ÷ 7} (cut → deficit/negative, bulk → surplus/positive, maintain → 0).
 * {@code targetKcal = tdeeEstimate + dailyEnergyBalance}. The machinery is symmetric across the three
 * trajectories — only the sign + magnitude differ.
 *
 * <p><b>Reconciliation (the spine corrects the constant, spec §4).</b> The formula energy balance
 * seeds a projected rate of {@code dailyEnergyBalance × 7 ÷ kcalPerKg} kg/week. Once the weight
 * trend reaches at least {@code provisional} sufficiency, the engine swaps in the observed trailing
 * 4-week rate ({@code trend.last4wRateKgPerWeek}) as the spine — the formula was only the bootstrap
 * seed, and the EWMA trend is ground truth. Below {@code provisional} (i.e. {@code none}) there is no
 * trustworthy observed rate yet, so the formula projection drives the rate. Deterministic.
 *
 * <p>Stateless, constructor-injected, read-only (no {@code @Transactional}); reads the linked meso /
 * running plans directly via the train repos (ownership-checked, soft-delete-aware finders) for the
 * {@code phaseCurve} / sessions-per-week the display {@code GoalPlanRef} does not expose.
 */
@Service
@RequiredArgsConstructor
public class GoalProjectionService {

    private static final String TRAJ_BULK = "bulk";
    private static final String TRAJ_MAINTAIN = "maintain";
    private static final String SYSTEM_RUN = "run";
    private static final String PLAN_MESOCYCLE = "mesocycle";
    private static final String PLAN_RUNNING_BLOCK = "running_block";

    private static final int DAYS_PER_WEEK = 7;
    private static final int SCALE = 2; // kcal/day; rate to 3 dp.
    private static final int RATE_SCALE = 3;
    private static final BigDecimal ONE_HUNDRED = new BigDecimal("100");

    private final GoalPlanLinkRepository linkRepository;
    private final MesocycleRepository mesocycleRepository;
    private final RunningBlockRepository runningBlockRepository;
    private final WeeklyScheduledActivityService weeklyActivity;
    private final GoalEngineProperties props;

    /**
     * One contiguous run of identical active load → one recept block (spec §5). {@code activeSystems}
     * is the human-facing list of what moves this stretch's boundaries ({@code run}); gym + volleyball
     * count via the constant weekly schedule (no longer ambient), so they never split a segment and are
     * not listed here.
     */
    public record ProjectionSegment(
        int fromWeek,
        int toWeek,
        String label,
        BigDecimal tdeeEstimate,
        BigDecimal targetKcal,
        BigDecimal projectedRateKgPerWk,
        int dailyEnergyBalanceKcal,
        Integer trainingDayKcal,
        Integer restDayKcal,
        List<String> activeSystems,
        String rationale) {
    }

    /**
     * Project the goal across its window. {@code currentWeightKg} for the energy balance is taken from
     * the trend's latest EWMA point when present, else the goal's {@code startWeightKg}.
     *
     * @param goal      the goal (trajectory, window, rateTargetPctPerWeek, startWeightKg)
     * @param userId    the owner — every plan read is ownership-checked
     * @param bootstrap        the formula-TDEE bootstrap (Task 5)
     * @param trend            the EWMA weight trend (Task 4) — the reconciliation spine
     * @param dayTypeShiftKcal the user's day-type shift setting (kcal off each rest day, Task 2/4) —
     *                         0 disables the split (every segment's day-type fields stay null)
     */
    public List<ProjectionSegment> project(
        GoalEntity goal, UUID userId, TdeeBootstrapJson bootstrap, WeightTrendResponse trend,
        int dayTypeShiftKcal) {

        int weeks = (int) ChronoUnit.WEEKS.between(goal.getStartDate(), goal.getTargetDate());
        if (weeks <= 0) {
            return List.of();
        }

        Set<Integer> scheduledDays = weeklyActivity.scheduledTrainingDayOfWeeks(userId);

        List<GoalPlanLinkEntity> links =
            linkRepository.findByGoalIdAndCreatedByAndDeletedFalseOrderByStartWeekAsc(goal.getId(), userId);

        // Resolve the linked plans once (one read per distinct plan), then index per goal-week.
        Map<UUID, MesocycleEntity> mesos = new LinkedHashMap<>();
        Map<UUID, RunningBlockEntity> runs = new LinkedHashMap<>();
        for (GoalPlanLinkEntity l : links) {
            if (PLAN_MESOCYCLE.equals(l.getPlanType())) {
                mesos.computeIfAbsent(l.getPlanId(), id ->
                    mesocycleRepository.findByIdAndCreatedByAndDeletedFalse(id, userId).orElse(null));
            } else if (PLAN_RUNNING_BLOCK.equals(l.getPlanType())) {
                runs.computeIfAbsent(l.getPlanId(), id ->
                    runningBlockRepository.findByIdAndCreatedByAndDeletedFalse(id, userId).orElse(null));
            }
        }

        // 1–2. Per week: the active load key (meso-phase class + running on/off) + the running delta.
        WeekLoad[] load = new WeekLoad[weeks + 1]; // 1-based
        for (int w = 1; w <= weeks; w++) {
            String phaseClass = activeMesoPhase(links, mesos, w);
            RunActive run = activeRun(links, runs, w);
            load[w] = new WeekLoad(phaseClass, run.active(), run.sessionsPerWeek());
        }

        // 3. Collapse contiguous identical loads into segments, then 4. compute the per-segment numbers.
        BigDecimal weightKg = currentWeightKg(goal, trend);
        BigDecimal balance = dailyEnergyBalance(goal, weightKg);
        List<ProjectionSegment> segments = new ArrayList<>();
        int start = 1;
        for (int w = 1; w <= weeks; w++) {
            boolean last = w == weeks;
            if (last || !load[w].sameLoadAs(load[w + 1])) {
                segments.add(
                    buildSegment(start, w, load[start], userId, weightKg, bootstrap, balance, goal, trend,
                        links, runs, scheduledDays, dayTypeShiftKcal));
                start = w + 1;
            }
        }
        return segments;
    }

    // ── per-week active-load resolution ─────────────────────────────────────────────────────────

    /** The mesocycle phase class active in goal-week {@code w}, or {@code null} when no gym block runs. */
    private String activeMesoPhase(
        List<GoalPlanLinkEntity> links, Map<UUID, MesocycleEntity> mesos, int w) {
        for (GoalPlanLinkEntity l : links) {
            if (!PLAN_MESOCYCLE.equals(l.getPlanType()) || !covers(l, w)) {
                continue;
            }
            MesocycleEntity m = mesos.get(l.getPlanId());
            if (m == null || m.getPhaseCurve() == null || m.getPhaseCurve().isEmpty()) {
                return ""; // gym active but no phase curve → a single unlabelled phase class.
            }
            int weekInMeso = w - l.getStartWeek(); // 0-based index into the curve
            List<String> curve = m.getPhaseCurve();
            String phase = weekInMeso >= 0 && weekInMeso < curve.size()
                ? curve.get(weekInMeso)
                : curve.get(curve.size() - 1); // past the curve → hold the last phase.
            return normalizePhase(phase);
        }
        return null; // no gym block this week
    }

    /** Whether a running block is active in goal-week {@code w}, and its sessions/week if so. */
    private RunActive activeRun(
        List<GoalPlanLinkEntity> links, Map<UUID, RunningBlockEntity> runs, int w) {
        for (GoalPlanLinkEntity l : links) {
            if (!PLAN_RUNNING_BLOCK.equals(l.getPlanType()) || !covers(l, w)) {
                continue;
            }
            RunningBlockEntity b = runs.get(l.getPlanId());
            return new RunActive(true, sessionsPerWeek(b, w - l.getStartWeek() + 1));
        }
        return new RunActive(false, 0);
    }

    /**
     * Sessions prescribed in the {@code weekInBlock}-th week of the block (1-based). Reads the
     * structure's matching {@link RunWeek}; falls back to the first week's session count when the
     * structure doesn't enumerate that week (the energy delta needs a representative weekly count).
     */
    private int sessionsPerWeek(RunningBlockEntity block, int weekInBlock) {
        if (block == null || block.getStructure() == null || block.getStructure().weeks() == null
            || block.getStructure().weeks().isEmpty()) {
            return 0;
        }
        List<RunWeek> weeks = block.getStructure().weeks();
        for (RunWeek rw : weeks) {
            if (rw.weekNumber() != null && rw.weekNumber() == weekInBlock && rw.sessions() != null) {
                return rw.sessions().size();
            }
        }
        RunWeek first = weeks.get(0);
        return first.sessions() == null ? 0 : first.sessions().size();
    }

    private static boolean covers(GoalPlanLinkEntity l, int w) {
        return w >= l.getStartWeek() && w <= l.getEndWeek();
    }

    /** Normalize a phase label to its class — case-folded/trimmed so "MEV" and "mev " merge. */
    private static String normalizePhase(String phase) {
        return phase == null ? "" : phase.trim().toUpperCase();
    }

    // ── per-segment numbers ─────────────────────────────────────────────────────────────────────

    private ProjectionSegment buildSegment(int from, int to, WeekLoad ld, UUID userId, BigDecimal weightKg,
        TdeeBootstrapJson bootstrap, BigDecimal balance, GoalEntity goal, WeightTrendResponse trend,
        List<GoalPlanLinkEntity> links, Map<UUID, RunningBlockEntity> runs, Set<Integer> scheduledDays,
        int dayTypeShiftKcal) {

        // Segment maintenance = neat baseline + scheduled gym+sport EAT + this segment's running EAT.
        // (Gym+sport are weekly-recurring, segment-independent; running is goal-linked, per-segment.)
        BigDecimal scheduled = weeklyActivity.scheduledWeeklyEatKcalPerDay(userId, weightKg);
        BigDecimal runEat = ld.runActive()
            ? weeklyActivity.runWeeklyEatKcalPerDay(ld.runSessionsPerWeek(), weightKg)
            : BigDecimal.ZERO;
        BigDecimal tdee = bootstrap.neatBaselineKcal().add(scheduled).add(runEat);
        BigDecimal target = tdee.add(balance);

        BigDecimal projectedRate = projectedRate(goal, balance, trend);

        List<String> systems = new ArrayList<>();
        if (ld.runActive()) {
            systems.add(SYSTEM_RUN);
        }

        // Slice 3: training days for THIS segment = recurring gym/sport weekdays ∪ the active run
        // block's session weekdays in the segment's first week (the sessionsPerWeek fallback idiom).
        Set<Integer> trainingDays = new TreeSet<>(scheduledDays);
        if (ld.runActive()) {
            trainingDays.addAll(runDayOfWeeks(links, runs, from));
        }
        int kcalInt = target.setScale(0, RoundingMode.HALF_UP).intValueExact();
        DayTypeShiftCalculator.DayTypeKcal dayType =
            DayTypeShiftCalculator.split(kcalInt, dayTypeShiftKcal, trainingDays.size(), bootstrap.bmr());

        return new ProjectionSegment(
            from, to,
            label(from, to, ld),
            scaled(tdee), scaled(target),
            projectedRate.setScale(RATE_SCALE, RoundingMode.HALF_UP),
            balance.setScale(0, RoundingMode.HALF_UP).intValueExact(),
            dayType.trainingDayKcal(), dayType.restDayKcal(),
            systems,
            rationale(ld, runEat));
    }

    /** The run-session weekdays (0=Mon..6=Sun) prescribed in goal-week {@code w}'s block week —
     *  first structure week as fallback, mirroring {@link #sessionsPerWeek}. */
    private Set<Integer> runDayOfWeeks(
        List<GoalPlanLinkEntity> links, Map<UUID, RunningBlockEntity> runs, int w) {
        for (GoalPlanLinkEntity l : links) {
            if (!PLAN_RUNNING_BLOCK.equals(l.getPlanType()) || !covers(l, w)) {
                continue;
            }
            RunningBlockEntity b = runs.get(l.getPlanId());
            if (b == null || b.getStructure() == null || b.getStructure().weeks() == null
                || b.getStructure().weeks().isEmpty()) {
                return Set.of();
            }
            int weekInBlock = w - l.getStartWeek() + 1;
            List<RunWeek> weeks = b.getStructure().weeks();
            RunWeek match = weeks.stream()
                .filter(rw -> rw.weekNumber() != null && rw.weekNumber() == weekInBlock)
                .findFirst().orElse(weeks.get(0));
            if (match.sessions() == null) {
                return Set.of();
            }
            return match.sessions().stream()
                .map(s -> s.dayOfWeek())
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        }
        return Set.of();
    }

    /**
     * Daily energy balance (kcal/day) for the goal's trajectory: cut → negative (deficit), bulk →
     * positive (surplus), maintain → 0. Magnitude = {@code rateTargetPctPerWeek/100 × weight ×
     * kcalPerKg ÷ 7}.
     */
    private BigDecimal dailyEnergyBalance(GoalEntity goal, BigDecimal weightKg) {
        if (TRAJ_MAINTAIN.equalsIgnoreCase(goal.getTrajectory())) {
            return BigDecimal.ZERO;
        }
        BigDecimal weeklyKgMagnitude = goal.getRateTargetPctPerWeek()
            .divide(ONE_HUNDRED, 10, RoundingMode.HALF_UP)
            .multiply(weightKg);
        BigDecimal dailyKcalMagnitude = weeklyKgMagnitude
            .multiply(BigDecimal.valueOf(props.kcalPerKg()))
            .divide(BigDecimal.valueOf(DAYS_PER_WEEK), SCALE, RoundingMode.HALF_UP);
        return TRAJ_BULK.equalsIgnoreCase(goal.getTrajectory())
            ? dailyKcalMagnitude
            : dailyKcalMagnitude.negate(); // cut (default for any non-bulk/non-maintain)
    }

    /**
     * The projected weekly rate (kg/week). Reconciliation: once the trend is at least
     * {@code provisional}, the observed trailing-4w rate is the spine; otherwise the formula
     * projection ({@code balance × 7 ÷ kcalPerKg}) drives it. Maintain is always ≈0.
     */
    private BigDecimal projectedRate(GoalEntity goal, BigDecimal balance, WeightTrendResponse trend) {
        if (TRAJ_MAINTAIN.equalsIgnoreCase(goal.getTrajectory())) {
            return BigDecimal.ZERO;
        }
        if (sufficiencyAtLeastProvisional(trend) && trend.getLast4wRateKgPerWeek() != null) {
            return trend.getLast4wRateKgPerWeek(); // observed real rate — the spine corrects the seed
        }
        // formula projection: balance(kcal/day) × 7 → kcal/week, ÷ kcalPerKg → kg/week.
        return balance.multiply(BigDecimal.valueOf(DAYS_PER_WEEK))
            .divide(BigDecimal.valueOf(props.kcalPerKg()), 10, RoundingMode.HALF_UP);
    }

    private static boolean sufficiencyAtLeastProvisional(WeightTrendResponse trend) {
        DataSufficiencyEnum s = trend == null ? null : trend.getDataSufficiency();
        return s == DataSufficiencyEnum.PROVISIONAL || s == DataSufficiencyEnum.FULL;
    }

    /** Energy-balance weight basis: the trend's latest EWMA point when present, else the goal's start. */
    private static BigDecimal currentWeightKg(GoalEntity goal, WeightTrendResponse trend) {
        if (trend != null && trend.getLatestTrendKg() != null
            && trend.getLatestTrendKg().signum() > 0) {
            return trend.getLatestTrendKg();
        }
        return goal.getStartWeightKg();
    }

    // ── labels / rationale (Hungarian, user-facing) ──────────────────────────────────────────────

    private static String label(int from, int to, WeekLoad ld) {
        String span = from == to ? "W" + from : "W" + from + "–" + to;
        if (ld.runActive()) {
            return span + " · futás aktív";
        }
        if (ld.phaseClass() != null && !ld.phaseClass().isBlank()) {
            return span + " · alapozó (" + ld.phaseClass() + ")";
        }
        return span + " · csak alapozó";
    }

    private String rationale(WeekLoad ld, BigDecimal runEat) {
        if (ld.runActive()) {
            return "Futóblokk aktív → +" + runEat.stripTrailingZeros().toPlainString()
                + " kcal/nap MET×kg×óra alapon (gym + röplabda a heti ütemtervből).";
        }
        return "Nincs futóblokk → a TDEE a NEAT-alap + a heti ütemterv (gym + röplabda) MET×kg×óra alapon.";
    }

    private static BigDecimal scaled(BigDecimal v) {
        return v.setScale(SCALE, RoundingMode.HALF_UP);
    }

    // ── tiny value carriers for the per-week walk ────────────────────────────────────────────────

    /** The active load in one goal-week: meso phase class (null = no gym) + running on/off + sessions. */
    private record WeekLoad(String phaseClass, boolean runActive, int runSessionsPerWeek) {
        boolean sameLoadAs(WeekLoad other) {
            return other != null
                && Objects.equals(phaseClass, other.phaseClass)
                && runActive == other.runActive
                && runSessionsPerWeek == other.runSessionsPerWeek;
        }
    }

    private record RunActive(boolean active, int sessionsPerWeek) {}
}
