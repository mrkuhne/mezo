package io.mrkuhne.mezo.feature.companion.service;

import io.mrkuhne.mezo.api.dto.FuelDayResponse;
import io.mrkuhne.mezo.api.dto.MacroSet;
import io.mrkuhne.mezo.api.dto.MealResponse;
import io.mrkuhne.mezo.api.dto.MealScoreDimension;
import io.mrkuhne.mezo.feature.biometrics.checkin.entity.CheckInEntity;
import io.mrkuhne.mezo.feature.biometrics.checkin.repository.CheckInRepository;
import io.mrkuhne.mezo.feature.biometrics.weight.entity.WeightLogEntity;
import io.mrkuhne.mezo.feature.biometrics.weight.repository.WeightLogRepository;
import io.mrkuhne.mezo.feature.companion.config.DayEvaluationProperties;
import io.mrkuhne.mezo.feature.companion.service.DayEvaluationEngine.DayDimension;
import io.mrkuhne.mezo.feature.companion.service.DayEvaluationEngine.DayEvaluation;
import io.mrkuhne.mezo.feature.companion.service.DayEvaluationEngine.DayInputs;
import io.mrkuhne.mezo.feature.companion.service.DayEvaluationEngine.MealLogFact;
import io.mrkuhne.mezo.feature.meal.entity.MealEntity;
import io.mrkuhne.mezo.feature.meal.repository.MealRepository;
import io.mrkuhne.mezo.feature.meal.repository.WaterLogRepository;
import io.mrkuhne.mezo.feature.meal.service.FuelDayService;
import io.mrkuhne.mezo.feature.train.service.WorkoutWindowQueryService;
import io.mrkuhne.mezo.feature.train.service.WorkoutWindowQueryService.Window;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The day-score READ path (mezo-jcpt.4, plan 2/2): resolves everything a day evaluation needs from
 * the owning features and hands it to {@link DayEvaluationEngine} as a {@link DayInputs} carrier.
 * There is exactly ONE day math in the codebase and it lives in that engine — this service holds
 * no formula at all any more: the four legacy {@code sleep/fuel/checkin/activity} sub-score methods
 * were deleted here and their semantics live on in the engine's six dimensions (the sleep formula
 * bit-for-bit, verified in Task 4). The legacy formula's tuning record {@code MeWeekProperties}
 * lost its last reader here and was deleted with its yml block (mezo-jcpt.7).
 *
 * <p><b>Wire mapping (binding, mezo-jcpt.5).</b> {@link DaySubscores} stays on {@link DayScore} for
 * the weekly trend ({@code WeeklyScoreService}'s persisted per-domain averages and the
 * {@code me-week} contract's {@code MeWeekSubscores}). Its six fields are the evaluation's six
 * dimensions under their own dimension-ids — a straight 1:1 projection, not a mapping table:
 * <pre>
 *   nutrition, quality, training, sleep, logging, rhythm
 * </pre>
 * and {@code score} is {@link DayEvaluation#base()}. A degraded (NO_DATA/IN_PROGRESS) dimension
 * projects to {@code null}, which is the same "tanulom" signal the legacy sub-scores carried. The
 * day page itself does not read these — it consumes the full {@link DayEvaluation} through the new
 * evaluation endpoint (Task 7).
 *
 * <p><b>Input-loading map.</b> Each {@link DayInputs} field comes from the feature that owns it:
 * <ul>
 *   <li>{@code closed} — {@code date < today} (v1 day closure), {@code today} resolved exactly
 *       ONCE per call by the public entry point and threaded through, so a request that crosses
 *       midnight can never see two different "today"s — see
 *       {@link #inputsFor(UUID, LocalDate, LocalDate)};</li>
 *   <li>{@code kcal/proteinG/carbsG/fatG} + the four targets — the day's
 *       {@link FuelDayResponse} ({@code getConsumed()} / {@code getTargets()}), the SAME rollup
 *       {@code MeWeekService.buildDay} renders, pre-fetched by the caller where possible. A day
 *       with no meal at all has no nutrition measurement: all four consumed values are
 *       {@code null} (never a fabricated "0 kcal vs a 2600 target");</li>
 *   <li>{@code plannedWorkouts/doneWorkouts/workoutDay} —
 *       {@link WorkoutWindowQueryService#windowsFor} (planned = the day's windows, done = those
 *       marked done). {@code WorkoutSessionRepository} has no planned-instance finder, only
 *       {@code findDoneInstancesBetween}, so the window query is the one source that knows the
 *       PLAN — and it already folds gym slots, sport slots/events and prescribed runs together;</li>
 *   <li>{@code sleepH/sleepQuality1to10} — {@link MetricSeriesService} {@code SLEEP_DURATION_H} /
 *       {@code SLEEP_QUALITY} over the whole window (one query each, never per day);</li>
 *   <li>{@code meals} — slot / eaten-at / kcal / NOVA + micro dimension scores from the fuel
 *       rollup's {@link MealResponse}s, and the REAL logging instant from the meal row's
 *       {@code created_at} ({@link MealRepository}, one ranged query). The two timestamps are
 *       genuinely different things: {@code meal.logged_at} is when the meal was EATEN (the user
 *       can backdate it), {@code created_at} is when it was written down — which is exactly what
 *       the logging dimension's timeliness component measures;</li>
 *   <li>{@code waterLogged} — {@link WaterLogRepository#sumsBetween} (one grouped query);</li>
 *   <li>{@code checkinCount} — {@link CheckInRepository}'s windowed finder, unchanged;</li>
 *   <li>{@code weightKg} — the day's LATEST weigh-in, the same "latest entry per day" fold
 *       {@code MeWeekService.latestWeightByDate} already does over
 *       {@link WeightLogRepository#findByCreatedByAndDeletedFalseAndDateGreaterThanEqualOrderByDateDesc}
 *       (one ranged query, never per-day — mezo-jcpt.6 exists to stop exactly that
 *       amplification, so this field must not reintroduce it);</li>
 *   <li>{@code xp} — {@link MetricSeriesService} {@code DAILY_XP} over the whole window (one
 *       ranged query, the same idiom as {@code sleepH}/{@code sleepQuality1to10} above);</li>
 *   <li>{@code priorBaseScores} — see below.</li>
 * </ul>
 *
 * <p><b>Rhythm without recursion.</b> The rhythm dimension is the mean of the PRIOR days' base
 * scores, so a naive implementation would re-enter a full evaluation per prior day, each pulling
 * its own seven priors. Instead every day of the EXTENDED window {@code [from - rhythmWindowDays,
 * to]} is loaded once and evaluated once with an EMPTY prior list (the brief's second option), and
 * those rhythm-free bases are what the in-range days' rhythm dimension averages. Cost is therefore
 * linear and bounded: one input load and at most two pure engine calls per day of the extended
 * window — never a fan-out.
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class DayScoreService {

    private static final String DIM_NUTRITION = "nutrition";
    private static final String DIM_QUALITY = "quality";
    private static final String DIM_TRAINING = "training";
    private static final String DIM_SLEEP = "sleep";
    private static final String DIM_LOGGING = "logging";
    private static final String DIM_RHYTHM = "rhythm";
    /** The meal-score envelope dimensions the day's quality dimension aggregates (mezo-yta). */
    private static final String MEAL_DIM_NOVA = "nova";
    private static final String MEAL_DIM_MICRO = "micro";

    private final MetricSeriesService metricSeriesService;
    private final CheckInRepository checkInRepository;
    private final FuelDayService fuelDayService;
    private final MealRepository mealRepository;
    private final WaterLogRepository waterLogRepository;
    private final WeightLogRepository weightLogRepository;
    private final WorkoutWindowQueryService workoutWindowQueryService;
    private final DayEvaluationEngine dayEvaluationEngine;
    private final DayEvaluationProperties properties;

    /** The evaluation's six dimensions under their wire names — see the class javadoc's
     *  dimension table. A degraded dimension projects to null, never 0. */
    public record DaySubscores(Integer nutrition, Integer quality, Integer training,
                               Integer sleep, Integer logging, Integer rhythm) {
    }

    public record DayScore(LocalDate date, Integer score, DaySubscores subscores,
                           DayEvaluation evaluation) {
    }

    /** Standalone entry point (WeeklyReviewGenerator, tests): fetches its own {@link FuelDayResponse}
     *  per day. Callers that already hold the day's rollup (e.g. {@code MeWeekService}, which needs
     *  it for its own display fields anyway) should use {@link #scores(UUID, LocalDate, LocalDate,
     *  Map)} instead, to avoid fetching the same rollup twice. */
    @Transactional(readOnly = true)
    public List<DayScore> scores(UUID userId, LocalDate from, LocalDate to) {
        return scores(userId, from, to, Map.of());
    }

    /** Same contract as {@link #scores(UUID, LocalDate, LocalDate)}, but takes the days'
     *  {@link FuelDayResponse}s pre-fetched by the caller (keyed by date) instead of fetching them
     *  again here — the B1 efficiency fix (mezo-8tp8). Safe by construction: a day missing from
     *  {@code fuelDayByDate} falls back to {@link FuelDayService#getDay} for that date, so an
     *  incomplete map (and the empty one the standalone overload passes) degrades to the
     *  standalone behaviour instead of a null-pointer failure. The rhythm window's prior days are
     *  always fetched here — they are outside the caller's rendered range by definition. */
    @Transactional(readOnly = true)
    public List<DayScore> scores(UUID userId, LocalDate from, LocalDate to,
                                 Map<LocalDate, FuelDayResponse> fuelDayByDate) {
        Map<LocalDate, DayInputs> window = rhythmFreeInputs(
                userId, from.minusDays(properties.rhythmWindowDays()), to, fuelDayByDate,
                LocalDate.now());
        Map<LocalDate, Integer> rhythmFreeBases = rhythmFreeBases(window);

        List<DayScore> result = new ArrayList<>();
        for (LocalDate day = from; !day.isAfter(to); day = day.plusDays(1)) {
            DayEvaluation evaluation = dayEvaluationEngine.evaluate(
                    withPriors(window.get(day), rhythmFreeBases));
            result.add(new DayScore(day, evaluation.base(), toSubscores(evaluation), evaluation));
        }
        return result;
    }

    /**
     * One day's fully-resolved {@link DayInputs}, priors included — the loading map above applied
     * to a single date. Exposed for the day-evaluation read path (Task 7/8), which needs the
     * inputs for an arbitrary user + date without going through a week's worth of scores.
     */
    @Transactional(readOnly = true)
    public DayInputs inputsFor(UUID userId, LocalDate date) {
        return inputsFor(userId, date, LocalDate.now());
    }

    /**
     * {@link #inputsFor(UUID, LocalDate)} with the caller's ALREADY-RESOLVED {@code today} — the
     * only overload that is safe across midnight. {@code DayReviewService} resolves {@code today}
     * once and uses it for BOTH halves of its answer: the {@code closed} flag computed here and
     * its own {@code state} classification. With two independent {@link LocalDate#now()} calls a
     * request that crossed midnight between them got {@code closed = false} (hence a null base)
     * for a {@code date} that its state classification already read as yesterday, falling through
     * to {@code thin}/{@code empty} instead of {@code in_progress} (review round 2, Minor). An
     * overload rather than a changed return type: every existing caller keeps its signature and
     * the "resolve the clock once" contract is stated where it matters.
     */
    @Transactional(readOnly = true)
    public DayInputs inputsFor(UUID userId, LocalDate date, LocalDate today) {
        Map<LocalDate, DayInputs> window = rhythmFreeInputs(
                userId, date.minusDays(properties.rhythmWindowDays()), date, Map.of(), today);
        return withPriors(window.get(date), rhythmFreeBases(window));
    }

    // --- Input loading ---------------------------------------------------------------------

    /**
     * Every day of {@code [from, to]} as a {@link DayInputs} with an EMPTY {@code priorBaseScores}
     * — the rhythm dimension is filled in afterwards by {@link #withPriors}. Every windowed source
     * is queried ONCE for the whole range (the V3.1 series idiom this service has always used);
     * only the fuel rollup and the workout windows are inherently per-day queries.
     *
     * <p>{@code today} is the caller's, never re-read here: it decides {@code closed} for every
     * day of the window, and the read path also classifies the day's state against it.
     */
    private Map<LocalDate, DayInputs> rhythmFreeInputs(UUID userId, LocalDate from, LocalDate to,
                                                       Map<LocalDate, FuelDayResponse> fuelDayByDate,
                                                       LocalDate today) {
        Map<LocalDate, Double> sleepH = metricSeriesService.series(userId, MetricKey.SLEEP_DURATION_H, from, to);
        Map<LocalDate, Double> sleepQuality = metricSeriesService.series(userId, MetricKey.SLEEP_QUALITY, from, to);
        Map<LocalDate, Double> xpSeries = metricSeriesService.series(userId, MetricKey.DAILY_XP, from, to);
        Map<LocalDate, Long> checkinCounts = checkinCounts(userId, from, to);
        Set<LocalDate> wateredDays = wateredDays(userId, from, to);
        Map<UUID, Instant> mealWrittenAt = mealWrittenAt(userId, from, to);
        Map<LocalDate, WeightLogEntity> weightByDate = latestWeightByDate(userId, from, to);

        Map<LocalDate, DayInputs> inputs = new LinkedHashMap<>();
        for (LocalDate day = from; !day.isAfter(to); day = day.plusDays(1)) {
            FuelDayResponse fuelDay = fuelDayByDate.get(day);
            if (fuelDay == null) {
                fuelDay = fuelDayService.getDay(userId, day);
            }
            boolean loggedFuel = !fuelDay.getMeals().isEmpty();
            MacroSet consumed = fuelDay.getConsumed();
            MacroSet targets = fuelDay.getTargets();
            // KNOWN AMPLIFICATION (review round 1, Important 3 — filed, deliberately not fixed
            // here): windowsFor is a per-DATE query costing ~5 statements, so a week read pays it
            // 14 times (7 rendered days + the 7 rhythm-window priors). The fix is a ranged
            // windowsFor(userId, from, to) in the train feature — a cross-feature change that does
            // not belong in this slice. Correct and bounded meanwhile, just chatty.
            List<Window> windows = workoutWindowQueryService.windowsFor(userId, day);
            int planned = windows.size();
            int done = (int) windows.stream().filter(Window::done).count();
            Double quality = sleepQuality.get(day);
            WeightLogEntity weight = weightByDate.get(day);
            Double xp = xpSeries.get(day);

            inputs.put(day, new DayInputs(
                    day, day.isBefore(today),
                    loggedFuel ? dbl(consumed.getKcal()) : null,
                    loggedFuel ? dbl(consumed.getP()) : null,
                    loggedFuel ? dbl(consumed.getC()) : null,
                    loggedFuel ? dbl(consumed.getF()) : null,
                    dbl(targets.getKcal()), dbl(targets.getP()), dbl(targets.getC()), dbl(targets.getF()),
                    planned > 0 || done > 0,
                    planned, done,
                    sleepH.get(day), quality == null ? null : (int) Math.round(quality),
                    mealFacts(fuelDay, mealWrittenAt),
                    wateredDays.contains(day),
                    checkinCounts.getOrDefault(day, 0L).intValue(),
                    weight != null ? dbl(weight.getWeightKg()) : null,
                    xp == null ? null : (int) Math.round(xp),
                    List.of()));
        }
        return inputs;
    }

    /** Latest (by {@code createdAt}) weigh-in per calendar day inside {@code [from, to]} — the
     *  same "latest entry per day" fold {@code MeWeekService.latestWeightByDate} already does,
     *  one ranged query rather than a per-day fan-out (mezo-jcpt.6). */
    private Map<LocalDate, WeightLogEntity> latestWeightByDate(UUID userId, LocalDate from, LocalDate to) {
        Map<LocalDate, WeightLogEntity> byDate = new HashMap<>();
        weightLogRepository.findByCreatedByAndDeletedFalseAndDateGreaterThanEqualOrderByDateDesc(userId, from)
                .stream()
                .filter(w -> !w.getDate().isAfter(to))
                .sorted(Comparator.comparing(WeightLogEntity::getCreatedAt))
                .forEach(w -> byDate.put(w.getDate(), w)); // last write per date wins = most recent createdAt
        return byDate;
    }

    /** Each day's base score computed WITHOUT the rhythm dimension (empty prior list) — the values
     *  the in-range days' rhythm dimension averages, and the reason rhythm can never recurse. */
    private Map<LocalDate, Integer> rhythmFreeBases(Map<LocalDate, DayInputs> window) {
        Map<LocalDate, Integer> bases = new HashMap<>();
        window.forEach((day, inputs) -> {
            Integer base = dayEvaluationEngine.evaluate(inputs).base();
            if (base != null) {
                bases.put(day, base);
            }
        });
        return bases;
    }

    /** The same inputs with the day's prior {@code rhythmWindowDays} base scores attached (oldest
     *  first); days without a base are simply absent, never padded. */
    private DayInputs withPriors(DayInputs inputs, Map<LocalDate, Integer> rhythmFreeBases) {
        List<Integer> priors = new ArrayList<>();
        for (int back = properties.rhythmWindowDays(); back >= 1; back--) {
            Integer base = rhythmFreeBases.get(inputs.date().minusDays(back));
            if (base != null) {
                priors.add(base);
            }
        }
        return new DayInputs(inputs.date(), inputs.closed(),
                inputs.kcal(), inputs.proteinG(), inputs.carbsG(), inputs.fatG(),
                inputs.kcalTarget(), inputs.proteinTargetG(), inputs.carbsTargetG(), inputs.fatTargetG(),
                inputs.workoutDay(), inputs.plannedWorkouts(), inputs.doneWorkouts(),
                inputs.sleepH(), inputs.sleepQuality1to10(), inputs.meals(),
                inputs.waterLogged(), inputs.checkinCount(),
                inputs.weightKg(), inputs.xp(), List.copyOf(priors));
    }

    /** Slot count per day inside the window — canonical Heartbeat cadence is 4/day (the engine's
     *  own denominator). B2 (mezo-8tp8): queries the {@code [from, to]} window directly instead of
     *  loading every check-in the user has ever logged and filtering in Java. */
    private Map<LocalDate, Long> checkinCounts(UUID userId, LocalDate from, LocalDate to) {
        Map<LocalDate, Long> counts = new HashMap<>();
        for (CheckInEntity checkIn : checkInRepository.findByCreatedByAndDeletedFalseAndDateBetween(userId, from, to)) {
            counts.merge(checkIn.getDate(), 1L, Long::sum);
        }
        return counts;
    }

    /** Days with any water logged at all — the logging dimension only asks the boolean question. */
    private Set<LocalDate> wateredDays(UUID userId, LocalDate from, LocalDate to) {
        Set<LocalDate> days = new HashSet<>();
        for (Object[] row : waterLogRepository.sumsBetween(userId, from, to)) {
            if (row[1] != null && ((Number) row[1]).longValue() > 0) {
                days.add((LocalDate) row[0]);
            }
        }
        return days;
    }

    /** {@code meal.created_at} per meal id — when the row was actually WRITTEN, as opposed to the
     *  {@code logged_at} the {@link MealResponse} carries (when the meal was eaten). */
    private Map<UUID, Instant> mealWrittenAt(UUID userId, LocalDate from, LocalDate to) {
        Map<UUID, Instant> writtenAt = new HashMap<>();
        for (MealEntity meal : mealRepository
                .findByCreatedByAndDeletedFalseAndMealDateBetweenOrderByMealDateAsc(userId, from, to)) {
            writtenAt.put(meal.getId(), meal.getCreatedAt());
        }
        return writtenAt;
    }

    private static List<MealLogFact> mealFacts(FuelDayResponse fuelDay, Map<UUID, Instant> mealWrittenAt) {
        List<MealLogFact> facts = new ArrayList<>();
        for (MealResponse meal : fuelDay.getMeals()) {
            Instant writtenAt = mealWrittenAt.get(meal.getId());
            facts.add(new MealLogFact(
                    meal.getSlot(),
                    writtenAt == null ? null : LocalTime.ofInstant(writtenAt, ZoneOffset.UTC),
                    meal.getLoggedAt() == null ? null : meal.getLoggedAt()
                            .withOffsetSameInstant(ZoneOffset.UTC).toLocalTime(),
                    mealDimScore(meal, MEAL_DIM_NOVA),
                    mealDimScore(meal, MEAL_DIM_MICRO),
                    meal.getMacros() == null ? 0.0 : dblOrZero(meal.getMacros().getKcal())));
        }
        return facts;
    }

    /** One meal-envelope dimension's 0..1 score, or {@code null} when the meal is unscored or that
     *  dimension DEGRADED (weight 0, the scorer's honest "no input coverage" marker) — a degraded
     *  dimension's stored 0 is not a measurement and must never drag the day's quality down. */
    private static Double mealDimScore(MealResponse meal, String dimensionId) {
        if (meal.getScore() == null || meal.getScore().getBreakdown() == null
                || meal.getScore().getBreakdown().getDimensions() == null) {
            return null;
        }
        return meal.getScore().getBreakdown().getDimensions().stream()
                .filter(d -> dimensionId.equals(d.getId()))
                .filter(d -> d.getWeight() != null && d.getWeight().signum() > 0)
                .findFirst()
                .map(MealScoreDimension::getScore)
                .map(BigDecimal::doubleValue)
                .orElse(null);
    }

    // --- Dimension-vector projection ---------------------------------------------------------

    private static DaySubscores toSubscores(DayEvaluation evaluation) {
        return new DaySubscores(
                dimScore(evaluation, DIM_NUTRITION),
                dimScore(evaluation, DIM_QUALITY),
                dimScore(evaluation, DIM_TRAINING),
                dimScore(evaluation, DIM_SLEEP),
                dimScore(evaluation, DIM_LOGGING),
                dimScore(evaluation, DIM_RHYTHM));
    }

    private static Integer dimScore(DayEvaluation evaluation, String dimensionId) {
        return evaluation.dimensions().stream()
                .filter(d -> d.id().equals(dimensionId))
                .findFirst()
                .map(DayDimension::score)
                .orElse(null);
    }

    private static Double dbl(BigDecimal value) {
        return value == null ? null : value.doubleValue();
    }

    /** The kcal a meal contributes to the day's NOVA weighting — a meal always has a mass, so an
     *  absent rollup is 0 (it simply carries no weight), never a null the engine would unbox. */
    private static double dblOrZero(BigDecimal value) {
        return value == null ? 0.0 : value.doubleValue();
    }
}
