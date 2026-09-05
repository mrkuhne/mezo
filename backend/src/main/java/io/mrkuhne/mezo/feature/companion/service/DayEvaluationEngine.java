package io.mrkuhne.mezo.feature.companion.service;

import io.mrkuhne.mezo.feature.companion.config.DayEvaluationProperties;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * Pure day-evaluation engine (mezo-jcpt.4, plan 2/2): a deterministic 6-dimension score over an
 * already-resolved {@link DayInputs} carrier — no repository/data access, same house style as
 * {@code MealScoringService} (pure math over pre-scaled inputs + config, fully unit-testable).
 * {@code DayScoreService} (Task 5) resolves and fills {@link DayInputs}; this engine never reads
 * anything else.
 *
 * <p>Task 2 built the engine skeleton ({@link #evaluate}, the weight-renormalisation mechanism)
 * plus the {@code nutrition} dimension. Task 3 added {@code quality} and {@code training} to the
 * same private-method + one-list-entry seam in {@link #evaluate}; this task (4) adds {@code
 * sleep, logging, rhythm} the same way, completing all six — deliberately not a plugin framework
 * (YAGNI). {@code sleep} is the one exception to "dimensions wait for {@code closed}": it
 * finalizes as soon as it's logged, even on an open day (the "A+ lifecycle" pattern — each
 * dimension closes out on its own natural trigger rather than all waiting for day-close).
 *
 * <p>Honesty rules (binding, constraints.md): a NO_DATA/IN_PROGRESS dimension drops out with
 * weight 0; the {@code weight} each surviving DONE dimension reports is RENORMALISED so the DONE
 * dimensions' weights sum to 1.0. {@code base} is the rounded weighted sum of the DONE dimensions,
 * and is {@code null} when fewer than 2 dimensions that actually MEASURED THIS DAY are DONE
 * ({@code rhythm} is excluded from that count — it is the mean of OTHER days' bases and knows
 * nothing about this one; it still carries its weight in the sum once the gate is open), or when
 * the day is not yet {@code closed} (open/future day → no overall score, only progress). No
 * component is ever awarded an invented neutral/full score for data that was never measured
 * (mezo-jcpt review round 1): a missing TARGET means we never set an expectation (full credit,
 * doesn't penalize); missing DATA against a real target means the component drops out and the
 * remaining components renormalize — same policy as the dimension-level renormalization above,
 * applied one level down inside the nutrition dimension's own kcal/protein/carb-fat split.
 */
@Service
@RequiredArgsConstructor
public class DayEvaluationEngine {

    private final DayEvaluationProperties props;

    /** Minden, amit egy nap értékeléséhez tudni kell — a hívó ({@code DayScoreService}) tölti. */
    public record DayInputs(
        LocalDate date, boolean closed,               // closed = date < today (v1 napzárás)
        Double kcal, Double proteinG, Double carbsG, Double fatG,          // consumed (null = nincs log)
        Double kcalTarget, Double proteinTargetG, Double carbsTargetG, Double fatTargetG,
        boolean workoutDay,                            // volt-e AZNAPRA tervezett/végzett edzés
        Integer plannedWorkouts, Integer doneWorkouts, // train terv vs tény (null/0 planned = pihenőnap)
        Double sleepH, Integer sleepQuality1to10,      // null = nincs alvás-log
        List<MealLogFact> meals,                       // logolási dimenzióhoz
        boolean waterLogged, int checkinCount,
        Double weightKg,                               // null = aznap nem mérlegelt (mezo-jcpt.8)
        Integer xp,                                    // null/0 = aznap nem gyűlt XP
        List<Integer> priorBaseScores                  // az előző rhythmWindowDays nap base-scoreja (ami van)
    ) { }

    public record MealLogFact(String slot, LocalTime loggedAt, LocalTime eatenAt,
                              Double novaDimScore, Double microDimScore, double kcal) { }

    public record DimFact(String label, String value) { }

    /** status: DONE (pont van) | IN_PROGRESS (nyitott nap, még gyűlik) | NO_DATA (degraded). */
    public record DayDimension(String id, String label, double weight, Integer score,
                               String status, List<DimFact> facts) { }

    public record DayEvaluation(LocalDate date, Integer base, List<DayDimension> dimensions) { }

    private static final String DONE = "DONE";
    private static final String IN_PROGRESS = "IN_PROGRESS";
    private static final String NO_DATA = "NO_DATA";
    private static final String NO_CARB_FAT_DATA = "nincs adat";
    /** The one EXTRINSIC dimension — see the gate in {@link #evaluate}. */
    private static final String DIM_RHYTHM = "rhythm";
    /** Canonical check-in slots per day (brief's literal {@code checkinCount/4}, not config-driven
     *  -- matches {@code DayScoreService.CANONICAL_CHECKIN_SLOTS}, the legacy path's same constant). */
    private static final double CHECKIN_SLOTS = 4.0;
    /** The clock wraps: see {@link #clockDistanceMin}. */
    private static final long MINUTES_PER_DAY = 1440;

    /** A dimension before weight renormalisation — carries the raw config weight. */
    private record RawDim(String id, String label, double configWeight, Integer score,
                          String status, List<DimFact> facts) { }

    /**
     * Logolt-e a felhasználó EZEN A NAPON bármit egyáltalán — a nap „becsületes állapot"
     * modelljének egyetlen igazságforrása (mezo-el0t). SZÁNDÉKOSAN a teljes loghalmaz felett
     * kérdez, nem a logolás-dimenzió saját bemenetei felett: egy nap, amelyen a felhasználó
     * edzett vagy aludt, de étkezést/vizet/check-int nem logolt, LOGOLT napnak számít — így a
     * {@code loggingDim} ott továbbra is mérhető marad és őszinte 0-val bünteti a napot,
     * ahogy azt a {@code loggingDim} javadoc-jában rögzített korábbi review-döntés megköveteli.
     *
     * <p>{@code kcal != null} és a nem-üres {@code meals} részben átfedő diszjunkt: produkcióban
     * ({@code DayScoreService}) {@code kcal} csak akkor nem null, ha volt legalább egy meal, tehát
     * a két feltétel gyakorlatban együtt mozog. Szándékosan mindkettő szerepel itt: ez a metódus
     * bármilyen kézzel épített {@link DayInputs}-ra (tesztek, jövőbeli hívók) is védekezik, nem
     * csak a jelenlegi egyetlen élő betöltőre — a redundancia ártalmatlan defenzív fedezet, nem
     * két külön eset.
     *
     * <p>{@code sleepH} ÉS {@code sleepQuality1to10} is szerepel, nem csak {@code sleepH}: az
     * alvás-napló API-ja ({@code LogSleepRequest}, {@code api/feature/sleep/sleep.yml}) csak a
     * {@code date}-et követeli meg — {@code durationH} és {@code quality} egymástól függetlenül
     * opcionális, és az entitáson ({@code SleepLogEntity}) sincs őket összekötő megszorítás. Egy
     * „csak minőséget adtam meg, időtartamot nem" bejegyzés tehát valós eset (nem csak elméleti),
     * és e nélkül a diszjunkt nélkül tévesen érintetlennek olvasódna.
     */
    public static boolean anyLogPresent(DayInputs in) {
        return in.kcal() != null
            || (in.meals() != null && !in.meals().isEmpty())
            || in.waterLogged()
            || in.checkinCount() > 0
            || in.sleepH() != null
            || in.sleepQuality1to10() != null
            || (in.doneWorkouts() != null && in.doneWorkouts() > 0)
            || in.weightKg() != null
            || (in.xp() != null && in.xp() > 0);
    }

    public DayEvaluation evaluate(DayInputs in) {
        List<RawDim> raw = List.of(nutritionDim(in), qualityDim(in), trainingDim(in),
            sleepDim(in), loggingDim(in), rhythmDim(in));

        double doneWeightSum = raw.stream().filter(d -> DONE.equals(d.status()))
            .mapToDouble(RawDim::configWeight).sum();
        // The data-sufficiency gate counts only INTRINSIC dimensions -- the ones that actually
        // measured THIS day. `rhythm` is extrinsic: it is the mean of OTHER days' base scores, so
        // it can be DONE on a day about which nothing whatsoever is known (review round 2,
        // Important). Left in, it paired with `logging` -- which is DONE on every closed day by
        // design, scoring an honest 0 for an untouched one -- to open the gate for a day with no
        // data at all, reporting base = round(0.5*0 + 0.5*rhythmMean), i.e. half the user's
        // running average for a day they never touched. It keeps its weight in the weighted sum
        // once the gate IS open (a real dimension of the score); it just may not open it alone.
        long doneCount = raw.stream()
            .filter(d -> DONE.equals(d.status()) && !DIM_RHYTHM.equals(d.id()))
            .count();

        List<DayDimension> dimensions = raw.stream()
            .map(d -> renormalized(d, doneWeightSum))
            .toList();

        Integer base = null;
        if (in.closed() && doneCount >= 2) {
            // Folded over the already-renormalized `dimensions` list, not re-derived from `raw`:
            // one weight computation, reused everywhere — the per-dimension weight and the base
            // total can never drift apart (review round 1, Minor).
            double weighted = dimensions.stream().filter(d -> DONE.equals(d.status()))
                .mapToDouble(d -> d.weight() * d.score())
                .sum();
            base = (int) Math.round(weighted);
        }
        return new DayEvaluation(in.date(), base, dimensions);
    }

    private DayDimension renormalized(RawDim d, double doneWeightSum) {
        double weight = DONE.equals(d.status()) && doneWeightSum > 0
            ? d.configWeight() / doneWeightSum : 0.0;
        return new DayDimension(d.id(), d.label(), weight, d.score(), d.status(), d.facts());
    }

    // --- Nutrition (.30 default): kcal (.5) + protein (.3) + carb/fat (.2) fit vs the day's targets

    private RawDim nutritionDim(DayInputs in) {
        String id = "nutrition";
        String label = "Táplálkozás";
        double configWeight = props.weights().nutrition();

        if (!in.closed()) {
            return new RawDim(id, label, configWeight, null, IN_PROGRESS, nutritionFacts(in));
        }
        // A non-positive target is not a real target (review round 1, Important 2) — treated the
        // same as a null one: the dimension has nothing to score against, so it degrades to
        // NO_DATA rather than dividing by (or against) a bogus zero/negative denominator.
        if (in.kcal() == null || in.kcalTarget() == null || in.kcalTarget() <= 0
            || in.proteinG() == null || in.proteinTargetG() == null || in.proteinTargetG() <= 0) {
            return new RawDim(id, label, configWeight, null, NO_DATA, List.of());
        }

        double kcalFit = kcalFit(in.kcal(), in.kcalTarget(), in.workoutDay());
        double proteinFit = proteinFit(in.proteinG(), in.proteinTargetG());
        // null = no carb/fat DATA against a real target → the component drops out and kcal/protein
        // renormalize over their combined 0.8 share (0.5/0.8, 0.3/0.8) instead of the component
        // silently getting an invented full score (review round 1, Important 1).
        Double carbFatFit = carbFatFit(in.carbsG(), in.fatG(), in.carbsTargetG(), in.fatTargetG());
        double value = carbFatFit == null
            ? (0.5 * kcalFit + 0.3 * proteinFit) / 0.8
            : 0.5 * kcalFit + 0.3 * proteinFit + 0.2 * carbFatFit;
        int score = (int) Math.round(value * 100);

        return new RawDim(id, label, configWeight, score, DONE, nutritionFacts(in));
    }

    private double kcalFit(double kcal, double target, boolean workoutDay) {
        double top = target + (workoutDay ? props.workoutDayKcalWiden() : 0);
        double relOver = Math.max(0, kcal / top - 1);          // a tágított felső célhoz
        double relUnder = Math.max(0, 1 - kcal / target);
        double over = Math.max(0, relOver - props.nutrition().kcalOverBand());
        double under = Math.max(0, relUnder - props.nutrition().kcalUnderBand());
        return Math.max(0, 1 - (over + under) * props.nutrition().kcalSlope());
    }

    private double proteinFit(double p, double target) {
        double relUnder = Math.max(0, 1 - p / target);
        double under = Math.max(0, relUnder - props.nutrition().proteinUnderBand());
        return Math.max(0, 1 - under * props.nutrition().proteinSlope()); // surplus: teljes pont
    }

    /**
     * {@code null} means "the component has no measurement and drops out" (missing DATA against a
     * real, positive target) — the caller renormalizes kcal/protein over it. A missing or
     * non-positive TARGET is a different case: we never set an expectation, so it returns full
     * credit (1.0) rather than dropping out — same as the brief's original {@code ct == null ||
     * ft == null} policy, extended to non-positive targets (review round 1, Important 2).
     */
    private Double carbFatFit(Double c, Double f, Double ct, Double ft) {
        if (ct == null || ft == null || ct <= 0 || ft <= 0) {
            return 1.0;
        }
        if (c == null || f == null) {
            return null;
        }
        double dev = (Math.max(0, Math.abs(c / ct - 1) - props.nutrition().carbFatBand())
                    + Math.max(0, Math.abs(f / ft - 1) - props.nutrition().carbFatBand())) / 2;
        return Math.max(0, 1 - dev * props.nutrition().carbFatSlope());
    }

    private List<DimFact> nutritionFacts(DayInputs in) {
        List<DimFact> facts = new ArrayList<>();
        facts.add(new DimFact("kcal", fmtPair(in.kcal(), in.kcalTarget())));
        facts.add(new DimFact("fehérje", fmtPair(in.proteinG(), in.proteinTargetG()) + " g"));
        facts.add(new DimFact("c · f", carbFatFactValue(in)));
        if (in.workoutDay()) {
            facts.add(new DimFact("sáv", "edzésnapi +" + props.workoutDayKcalWiden() + " kcal"));
        }
        return facts;
    }

    /** "nincs adat" when carbs/fat weren't logged at all, so the tile never implies a measured
     *  value for an unmeasured component (review round 1, chosen resolution for Important 1). */
    private static String carbFatFactValue(DayInputs in) {
        if (in.carbsG() == null || in.fatG() == null) {
            return NO_CARB_FAT_DATA;
        }
        return fmtInt(in.carbsG()) + " g · " + fmtInt(in.fatG()) + " g";
    }

    private static String fmtPair(Double a, Double b) {
        return fmtInt(a) + " / " + fmtInt(b);
    }

    private static String fmtInt(Double v) {
        return v == null ? "–" : String.valueOf(Math.round(v));
    }

    // --- Quality (.15 default): kcal-weighted mean of the day's meal NOVA scores, blended with
    // the mean meal MICRO score (0.75 nova / 0.25 micro). Both fields come from the meal envelope
    // (already-scored, 1/2 plan) — this dimension only aggregates across the day's meals.

    private RawDim qualityDim(DayInputs in) {
        String id = "quality";
        String label = "Minőség";
        double configWeight = props.weights().quality();
        List<MealLogFact> meals = in.meals() == null ? List.of() : in.meals();
        Double novaPart = novaKcalWeightedAvg(meals);
        Double microAvg = microAvg(meals);
        List<DimFact> facts = qualityFacts(novaPart, microAvg);

        if (!in.closed()) {
            return new RawDim(id, label, configWeight, null, IN_PROGRESS, facts);
        }
        // No meal carries a usable nova score (or their combined kcal is non-positive, same
        // no-divide-by-nothing guard as nutrition) -> nothing to aggregate, degrade honestly
        // rather than inventing a neutral quality score.
        if (novaPart == null) {
            return new RawDim(id, label, configWeight, null, NO_DATA, List.of());
        }
        // Without any micro data the nova part stands alone at weight 1.0 (brief, explicit) --
        // not renormalized against an invented micro value.
        double value = microAvg == null ? novaPart : 0.75 * novaPart + 0.25 * microAvg;
        int score = (int) Math.round(value * 100);
        return new RawDim(id, label, configWeight, score, DONE, facts);
    }

    /** {@code null} when no meal carries a nova score, or their combined kcal is non-positive
     *  (nothing to weight by) -- the caller degrades the whole dimension to NO_DATA rather than
     *  dividing by zero or inventing a value. */
    private static Double novaKcalWeightedAvg(List<MealLogFact> meals) {
        List<MealLogFact> withNova = meals.stream().filter(m -> m.novaDimScore() != null).toList();
        double kcalSum = withNova.stream().mapToDouble(MealLogFact::kcal).sum();
        if (withNova.isEmpty() || kcalSum <= 0) {
            return null;
        }
        return withNova.stream().mapToDouble(m -> m.novaDimScore() * m.kcal()).sum() / kcalSum;
    }

    /** Simple (non kcal-weighted) mean of the meals carrying a micro score; {@code null} when
     *  none do. */
    private static Double microAvg(List<MealLogFact> meals) {
        List<MealLogFact> withMicro = meals.stream().filter(m -> m.microDimScore() != null).toList();
        if (withMicro.isEmpty()) {
            return null;
        }
        return withMicro.stream().mapToDouble(MealLogFact::microDimScore).average().orElseThrow();
    }

    private static List<DimFact> qualityFacts(Double novaPart, Double microAvg) {
        List<DimFact> facts = new ArrayList<>();
        facts.add(new DimFact("nova", novaPart == null ? "–" : Math.round(novaPart * 100) + "%"));
        facts.add(new DimFact("mikro", microAvg == null ? "–" : Math.round(microAvg * 100) + "%"));
        return facts;
    }

    // --- Training (.20 default): done/planned workouts, linear between 0.3 (0 done) and 1.0
    // (all done). plannedWorkouts of 0 (or null) is a rest day -- NO_DATA, never a penalty.

    private RawDim trainingDim(DayInputs in) {
        String id = "training";
        String label = "Edzés";
        double configWeight = props.weights().training();
        Integer planned = in.plannedWorkouts();

        // Rest day: no plan means nothing to measure against, not a missed workout -- the day
        // must not take a training penalty for resting (product decision, binding).
        if (planned == null || planned <= 0) {
            return new RawDim(id, label, configWeight, null, NO_DATA,
                List.of(new DimFact("terv", "Pihenőnap · nem számít")));
        }

        int done = in.doneWorkouts() == null ? 0 : in.doneWorkouts();
        List<DimFact> facts = List.of(new DimFact("edzés", done + " / " + planned));

        // Open day, not yet all done -> still gathering, IN_PROGRESS; a closed day is always
        // DONE regardless of the done/planned ratio (the day is over, the ratio is final).
        if (!in.closed() && done < planned) {
            return new RawDim(id, label, configWeight, null, IN_PROGRESS, facts);
        }

        double ratio = Math.min(1.0, (double) done / planned);
        double value = 0.3 + 0.7 * ratio;
        int score = (int) Math.round(value * 100);
        return new RawDim(id, label, configWeight, score, DONE, facts);
    }

    // --- Sleep (.15 default): duration-vs-target ratio blended 0.7/0.3 with the logged 1-10
    // quality dial, mapped (v-1)/9. Deliberately reuses DayScoreService#sleepSubscore's semantics
    // (Task 5 swaps that legacy path over to this engine; the formula must not drift). A+
    // lifecycle: sleep finalizes as soon as it's logged, independent of the day's own closure --
    // unlike every other dimension it can be DONE on an open day.

    private RawDim sleepDim(DayInputs in) {
        String id = "sleep";
        String label = "Alvás";
        double configWeight = props.weights().sleep();
        List<DimFact> facts = sleepFacts(in);

        if (in.sleepH() == null) {
            // No log yet: on an open day it may still arrive today (IN_PROGRESS); on a closed day
            // the day is over and nothing more will land (NO_DATA).
            return new RawDim(id, label, configWeight, null, in.closed() ? NO_DATA : IN_PROGRESS, facts);
        }

        double ratio = Math.min(1.0, in.sleepH() / props.sleepTargetH());
        Integer quality = in.sleepQuality1to10();
        double value = quality == null ? ratio
            : 0.7 * ratio + 0.3 * clamp01((quality - 1) / 9.0);
        int score = (int) Math.round(clamp01(value) * 100);
        return new RawDim(id, label, configWeight, score, DONE, facts);
    }

    private static List<DimFact> sleepFacts(DayInputs in) {
        List<DimFact> facts = new ArrayList<>();
        facts.add(new DimFact("alvás", in.sleepH() == null ? "–" : fmtInt(in.sleepH()) + " h"));
        facts.add(new DimFact("minőség",
            in.sleepQuality1to10() == null ? "–" : "Q" + in.sleepQuality1to10()));
        return facts;
    }

    private static double clamp01(double v) {
        return Math.max(0.0, Math.min(1.0, v));
    }

    // --- Logging (.10 default): 0.5 x timely-meal ratio + 0.2 x water logged + 0.3 x
    // min(1, checkinCount/4). "Timely" = |loggedAt - eatenAt| <= logTimelyMin minutes. Water
    // (boolean) and check-ins (a count) are never "unknown" on DayInputs -- false/0 IS the
    // measurement (the user logged nothing that day), not a missing-data gap, so unlike
    // nutrition's kcal/protein this dimension has no "no target was ever set" escape hatch: on a
    // closed day it is always DONE and scores exactly what the formula says, including a real 0
    // for a genuinely untouched day (review round 1: an invented NO_DATA free pass here would
    // silently drop the weight of, and refuse to penalize, a day with no logging effort at all --
    // the opposite of what this process dimension exists to measure). Only the meal-timeliness
    // component can be genuinely missing (0 meals, or none carrying timing data): it then drops
    // out and the remaining two renormalize over their combined 0.5 share (0.2/0.5=0.4,
    // 0.3/0.5=0.6).
    //
    // Narrowed (mezo-el0t): the escape hatch above still does not exist for THIS dimension's own
    // inputs (meals/water/check-ins) -- a day with those all empty but SOME other log elsewhere
    // (workout done, sleep logged, weighed in, XP earned) is still a LOGGED day, and `logging`
    // stays DONE and still scores its honest 0, exactly as the round-1 decision requires. What
    // changed is the day with NO log of ANY kind: {@link #anyLogPresent} is checked first, and
    // only that fully-untouched day degrades to NO_DATA -- safely, because such a day has zero
    // intrinsic DONE dimensions anyway, so the data-sufficiency gate in {@link #evaluate} is
    // already closed and there is no score left for dropping this weight to soften.

    private RawDim loggingDim(DayInputs in) {
        String id = "logging";
        String label = "Naplózás";
        double configWeight = props.weights().logging();
        List<MealLogFact> meals = in.meals() == null ? List.of() : in.meals();
        // Computed regardless of `closed` (like sleepDim) so an open day's facts reflect timing
        // data already logged mid-day, instead of always showing "–" until the day closes.
        Double mealPart = timelyMealRatio(meals, props.logTimelyMin());

        if (!in.closed()) {
            return new RawDim(id, label, configWeight, null, IN_PROGRESS, loggingFacts(in, mealPart));
        }

        if (!anyLogPresent(in)) {
            // No log of any kind -- nothing to measure. Dropping the weight here does NOT let a
            // penalty slip away: on such a day the gate is closed anyway (zero intrinsic DONE
            // dimensions), so there is no score for this weight to have softened.
            return new RawDim(id, label, configWeight, null, NO_DATA, loggingFacts(in, mealPart));
        }

        double waterComponent = in.waterLogged() ? 1.0 : 0.0;
        double checkinComponent = Math.min(1.0, in.checkinCount() / CHECKIN_SLOTS);
        double value = mealPart == null
            ? (0.2 * waterComponent + 0.3 * checkinComponent) / 0.5
            : 0.5 * mealPart + 0.2 * waterComponent + 0.3 * checkinComponent;
        int score = (int) Math.round(clamp01(value) * 100);
        return new RawDim(id, label, configWeight, score, DONE, loggingFacts(in, mealPart));
    }

    /** {@code null} when no meal carries both a {@code loggedAt} and an {@code eatenAt} (nothing
     *  to compare, either because no meals were logged at all or because none carry timing data)
     *  -- the caller drops the meal component out rather than inventing a ratio. */
    private static Double timelyMealRatio(List<MealLogFact> meals, int logTimelyMin) {
        List<MealLogFact> withTiming = meals.stream()
            .filter(m -> m.loggedAt() != null && m.eatenAt() != null).toList();
        if (withTiming.isEmpty()) {
            return null;
        }
        long onTime = withTiming.stream()
            .filter(m -> clockDistanceMin(m.eatenAt(), m.loggedAt()) <= logTimelyMin)
            .count();
        return (double) onTime / withTiming.size();
    }

    /**
     * Distance between two times of day AROUND THE CLOCK: {@code min(|delta|, 1440 - |delta|)}
     * minutes (review round 1, Important 4). Both fields are wall-clock {@link LocalTime}s with no
     * date, so the raw signed difference reads a dinner eaten 23:30 and logged 00:10 -- an ordinary
     * pattern -- as 1160 minutes late, zeroing the meal component of an otherwise perfectly logged
     * day. Without dates the two readings ("23 hours late" vs "40 minutes across midnight") are
     * genuinely indistinguishable; the near one is overwhelmingly the real case, and the failure
     * mode of the circular reading (forgiving a meal logged almost exactly a day late) is far
     * rarer and far less punishing than the failure mode of the linear one.
     */
    private static long clockDistanceMin(LocalTime eatenAt, LocalTime loggedAt) {
        long delta = Math.abs(Duration.between(eatenAt, loggedAt).toMinutes());
        return Math.min(delta, MINUTES_PER_DAY - delta);
    }

    private static List<DimFact> loggingFacts(DayInputs in, Double mealPart) {
        List<DimFact> facts = new ArrayList<>();
        facts.add(new DimFact("étkezés időben", mealPart == null ? "–" : Math.round(mealPart * 100) + "%"));
        facts.add(new DimFact("víz", in.waterLogged() ? "✓" : "–"));
        facts.add(new DimFact("check-in", in.checkinCount() + " / " + (int) CHECKIN_SLOTS));
        return facts;
    }

    // --- Rhythm (.10 default): mean of the PRIOR days' base scores (never today's own, which
    // would let it eat itself), gated at rhythmMinDays so a couple of stray days can't drive it.

    private RawDim rhythmDim(DayInputs in) {
        String id = DIM_RHYTHM;
        String label = "Ritmus";
        double configWeight = props.weights().rhythm();
        List<Integer> prior = in.priorBaseScores() == null ? List.of() : in.priorBaseScores();
        List<DimFact> facts = List.of(new DimFact("napok", prior.size() + " / " + props.rhythmWindowDays()));

        if (!in.closed()) {
            return new RawDim(id, label, configWeight, null, IN_PROGRESS, facts);
        }
        if (prior.size() < props.rhythmMinDays()) {
            return new RawDim(id, label, configWeight, null, NO_DATA, facts);
        }

        double mean = prior.stream().mapToInt(Integer::intValue).average().orElseThrow();
        int score = (int) Math.round(mean);
        return new RawDim(id, label, configWeight, score, DONE, facts);
    }
}
