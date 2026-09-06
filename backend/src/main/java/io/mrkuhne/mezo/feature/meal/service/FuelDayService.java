package io.mrkuhne.mezo.feature.meal.service;

import io.mrkuhne.mezo.api.dto.FuelDayResponse;
import io.mrkuhne.mezo.api.dto.FuelDayRollup;
import io.mrkuhne.mezo.api.dto.FuelWeekResponse;
import io.mrkuhne.mezo.api.dto.MacroSet;
import io.mrkuhne.mezo.api.dto.Macros;
import io.mrkuhne.mezo.api.dto.MealResponse;
import io.mrkuhne.mezo.feature.biometrics.weight.entity.WeightLogEntity;
import io.mrkuhne.mezo.feature.biometrics.weight.repository.WeightLogRepository;
import io.mrkuhne.mezo.feature.goal.entity.GoalEntity;
import io.mrkuhne.mezo.feature.goal.entity.GoalPrescriptionJson;
import io.mrkuhne.mezo.feature.goal.repository.GoalRepository;
import io.mrkuhne.mezo.feature.nutrition.config.NutritionTargetsProperties;
import io.mrkuhne.mezo.feature.nutrition.service.DailyTargets;
import io.mrkuhne.mezo.feature.nutrition.service.DayContext;
import io.mrkuhne.mezo.feature.nutrition.service.DayTargetProjector;
import io.mrkuhne.mezo.feature.nutrition.service.DietPreferencesResolver;
import io.mrkuhne.mezo.feature.meal.entity.MealEntity;
import io.mrkuhne.mezo.feature.meal.entity.MealItemEntity;
import io.mrkuhne.mezo.feature.meal.mapper.MealMapper;
import io.mrkuhne.mezo.feature.meal.repository.MealRepository;
import io.mrkuhne.mezo.feature.train.service.WorkoutWindowQueryService;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Assembles {@link FuelDayResponse} for the Fuel-day MacroHero: {@code targets} come from the
 * active goal's prescribed recept when one covers the date — kcal + protein + carbs + fat from the
 * {@link GoalPrescriptionJson} segment of that date's goal-week (mezo-najo; the recept IS the
 * TDEE + training + deficit prescription; carbs/fat since mezo-xwgb) — falling back to the
 * config-driven {@link NutritionTargetsProperties} per field when there is no active/evaluated
 * goal, no covering segment, or the segment predates the carbs/fat split. Water is never
 * prescribed by the goal; it always comes from {@link DietPreferencesResolver} (the saved
 * preference row, or its config ghost when none exists). {@code consumed}
 * = Σ the day's meal macros; {@code water} consumed is the real Σ of the day's water-log entries
 * (via {@link WaterLogService}); no meal carries water in v1.
 *
 * <p>Slice 3 (mezo-sxlj): when a segment carries a day-type split ({@code trainingDayKcal} /
 * {@code restDayKcal}), the served kcal is picked at serve time by {@link DayTargetProjector} —
 * a date is a training day when it carries a SCHEDULE-derived training source
 * ({@link WorkoutWindowQueryService#hasScheduledTrainingOn}: gym schedule slots, sport schedule
 * slots, dated sport events, prescribed runs) — the same basis the FE's {@code deriveBlocks} and
 * the engine's weekly split use. An ad-hoc LOGGED session with no matching schedule/event does
 * NOT flip the day. The whole kcal delta lands in carbs (ISSN), derived at serve time and never
 * stored.
 */
@Service
@RequiredArgsConstructor
public class FuelDayService {

    private final MealRepository mealRepository;
    private final MealMapper mapper;
    private final NutritionTargetsProperties targets;
    private final WaterLogService waterLogService;
    private final GoalRepository goalRepository;
    private final DietPreferencesResolver dietPreferences;
    private final WeightLogRepository weightLogRepository;
    private final WorkoutWindowQueryService workoutWindowQueryService;

    // Annotated by exception: the meal mapper walks LAZY items with open-in-view false (spring_patterns.md).
    @Transactional(readOnly = true)
    public FuelDayResponse getDay(UUID userId, LocalDate date) {
        List<MealResponse> meals = mealRepository
            .findByCreatedByAndMealDateAndDeletedFalseOrderByLoggedAtAsc(userId, date).stream()
            .map(mapper::toResponse)
            .toList();
        int water = waterLogService.sumForDay(userId, date);
        int waterMl = dietPreferences.resolve(userId).waterMl();
        return FuelDayResponse.builder()
            .date(date)
            .targets(targetSet(activeGoal(userId), date, waterMl, userId))
            .consumed(consumed(meals, water))
            .meals(meals)
            .build();
    }

    /**
     * Seven-day rollup {@code start..start+6} — per-day targets (the goal recept is week-segmented,
     * so a segment boundary can fall inside the rendered week) + consumed Σ, no meal bodies. Feeds
     * the Terv weekly stats (kcal avg / protein-hit days), the week-centric Fuel Napló page and the
     * Insights Weekly review (Phase-2 roadmap D′).
     *
     * <p>Slice 3: each of the 7 days does its own {@link WorkoutWindowQueryService#hasScheduledTrainingOn}
     * lookup via {@link #targetSet} — 7 lookups per call. Acceptable single-owner cost;
     * revisit with a week-bulk query only if it ever shows up in traces.
     *
     * <p>The two week-level scalars (mezo-d20.7.2) are DERIVED AT READ, not stored: Fuel has no
     * per-week row to hang them on, and both are pure functions of already-persisted data
     * ({@code meal.score} — itself the denormalized scalar of the score envelope, ADR 0006 §4 — and
     * {@code weight_log}). A new week table would be a cache with an invalidation duty (every meal
     * edit / delete / re-score and every weigh-in would have to write through) and no new
     * information, so it is deliberately NOT introduced. Both are NULLABLE: an unscored week and a
     * weigh-in-less week return {@code null}, never a 0-as-a-fake.
     */
    @Transactional(readOnly = true)
    public FuelWeekResponse getWeek(UUID userId, LocalDate start) {
        GoalEntity goal = activeGoal(userId);
        // Resolve preferences ONCE for the whole week, not per day (7 identical queries otherwise).
        int waterMl = dietPreferences.resolve(userId).waterMl();
        LocalDate end = start.plusDays(6);
        List<FuelDayRollup> days = start.datesUntil(start.plusDays(7))
            .map(d -> FuelDayRollup.builder()
                .date(d)
                .targets(targetSet(goal, d, waterMl, userId))
                .consumed(consumedFor(userId, d))
                .build())
            .toList();
        return FuelWeekResponse.builder()
            .start(start)
            .days(days)
            .mealScoreAvg(mealScoreAvg(userId, start, end))
            .weightAvgKg(weightAvgKg(userId, start, end))
            .build();
    }

    /**
     * Weekly "AI-atlag": the mean of the week's SCORED meals' deterministic scores (0..1), 3
     * decimals. Unscored (pre-mezo-yta) rows are excluded by the query — a week whose meals are all
     * unscored averages nothing and returns {@code null}.
     */
    private BigDecimal mealScoreAvg(UUID userId, LocalDate start, LocalDate end) {
        return mean(mealRepository.findScoresBetween(userId, start, end), 3);
    }

    /**
     * Weekly weight average (kg, 2 decimals). Folded to ONE value per day first — the day's latest
     * weigh-in, matching the day-level {@code findFirstBy...OrderByCreatedAtDesc} semantics — so a
     * day weighed three times does not out-vote the other six. {@code null} when the week holds no
     * weigh-in.
     */
    private BigDecimal weightAvgKg(UUID userId, LocalDate start, LocalDate end) {
        Map<LocalDate, BigDecimal> latestPerDay = new LinkedHashMap<>();
        for (WeightLogEntity w : weightLogRepository
                .findByCreatedByAndDeletedFalseAndDateBetweenOrderByDateAscCreatedAtAsc(userId, start, end)) {
            latestPerDay.put(w.getDate(), w.getWeightKg()); // ordered asc ⇒ last write per date wins
        }
        return mean(List.copyOf(latestPerDay.values()), 2);
    }

    /** Arithmetic mean, HALF_UP to {@code scale}; {@code null} for an empty sample (honest state). */
    private BigDecimal mean(List<BigDecimal> values, int scale) {
        if (values.isEmpty()) {
            return null;
        }
        BigDecimal sum = BigDecimal.ZERO;
        for (BigDecimal v : values) {
            sum = sum.add(v);
        }
        return sum.divide(BigDecimal.valueOf(values.size()), scale, RoundingMode.HALF_UP);
    }

    private MacroSet consumedFor(UUID userId, LocalDate date) {
        List<MealResponse> meals = mealRepository
            .findByCreatedByAndMealDateAndDeletedFalseOrderByLoggedAtAsc(userId, date).stream()
            .map(mapper::toResponse)
            .toList();
        return consumed(meals, waterLogService.sumForDay(userId, date));
    }

    private GoalEntity activeGoal(UUID userId) {
        return goalRepository.findByCreatedByAndStatusAndDeletedFalse(userId, "active")
            .stream().findFirst().orElse(null);
    }

    /**
     * The active goal's recept segment covering {@code date}'s goal-week (week derived from
     * startDate — the ContextSnapshotAssembler#goalBlock idiom); {@code null} when there is no
     * goal, no evaluated prescription, or no covering segment (e.g. a date before the goal
     * started). SHARED by {@link #targetSet} (the FuelDay MacroHero) and {@link #dailyTargets}
     * (the meal scorer, mezo-3g5w) — one resolution, two projections, so the two surfaces can
     * never judge a day against different numbers.
     */
    private GoalPrescriptionJson.Segment segmentFor(GoalEntity goal, LocalDate date) {
        if (goal == null || goal.getStartDate() == null) {
            return null;
        }
        long week = ChronoUnit.DAYS.between(goal.getStartDate(), date) / 7 + 1;
        return GoalPrescriptionJson.currentSegment(goal.getPrescription(), week);
    }

    /**
     * kcal + protein + carbs + fat from {@link #segmentFor}; config fallback per field when there
     * is no covering segment, or the segment predates the carbs/fat split (pre-slice-1
     * prescriptions carry null carbsG/fatG). The day-type pick ({@link #project}) overrides
     * kcal and shifts carbs when the segment carries a day-type split. {@code waterMl} is
     * caller-resolved (once per request, via {@link DietPreferencesResolver}) since water is never
     * goal-prescribed.
     */
    private MacroSet targetSet(GoalEntity goal, LocalDate date, int waterMl, UUID userId) {
        DailyTargets t = project(segmentFor(goal, date), userId, date);
        return MacroSet.builder()
            .kcal(BigDecimal.valueOf(t.kcal()))
            .p(BigDecimal.valueOf(t.p()))
            .c(BigDecimal.valueOf(t.c()))
            .f(BigDecimal.valueOf(t.f()))
            .water(BigDecimal.valueOf(waterMl))
            .build();
    }

    /**
     * The shared segment → served-targets projection ({@link DayTargetProjector}, mezo-u2pd) with
     * this service's config fallback and the SCHEDULE-derived day-type probe bound in. The probe is
     * passed lazily because {@link WorkoutWindowQueryService#hasScheduledTrainingOn} is a DB
     * round-trip a uniform (pre-slice-3) segment must not pay — and it is deliberately NOT
     * {@code windowsFor}, which also counts ad-hoc LOGGED sessions: an unplanned sport session on
     * an otherwise rest day must not flip the day-type kcal pick.
     */
    private DailyTargets project(GoalPrescriptionJson.Segment seg, UUID userId, LocalDate date) {
        return DayTargetProjector.project(
            seg, () -> workoutWindowQueryService.hasScheduledTrainingOn(userId, date), targets);
    }

    /**
     * The day's resolved macro targets for the meal scorer (mezo-3g5w): the active goal's covering
     * segment via {@link #segmentFor}, per-field config fallback, with the SAME day-type pick
     * ({@link #project}) {@link #targetSet} applies — so the score and the hero can never
     * judge against different numbers.
     */
    @Transactional(readOnly = true)
    public DailyTargets dailyTargets(UUID userId, LocalDate date) {
        return project(segmentFor(activeGoal(userId), date), userId, date);
    }

    /**
     * A nap állapota EGY adott étkezés ELŐTT (mezo-jcpt.19) — a meal-score context dimenziójának
     * napi bemenete, a {@link #dailyTargets} párja: a hívó old fel, a scorer pure marad.
     *
     * <p>A nap logolt étkezései közül a {@code loggedAt}-nál KORÁBBIAK Σ kcal/fehérjéje, a saját
     * sor id alapján kizárva — az {@code applyScore} update-kor és re-score-kor is fut, amikor az
     * étkezés MÁR benne van a napban, és azonos {@code loggedAt} esetén az id-kizárás az egyetlen
     * biztos szűrő.
     *
     * <p>A tétel-hozzájárulás a KANONIKUS képlettel megy ({@link MealMapper#contribution}:
     * {@code factor = amount / snapshotPer}), nem a nyers snapshot-összeggel — különben egy
     * per-100 g kamra-sorból logolt 250 g a 100 g-os értékkel számolna.
     *
     * <p>A napi sorokat a {@code findWithItems...} fetch-join-os finderrel olvassa (NEM a
     * {@link #getDay} / coach {@code loadDay} által is használt sima finderrel) — így ez a
     * hot write-path hívás (minden {@code applyScore} create/update/rescore-kor lefut) EGY
     * lekérdezésből kapja a napot ÉS a tételeket, nem egy N+1 lazy-load sorozatból.
     *
     * <p>Ismert, gyakorlatban elérhetetlen szélső eset: a {@code !isBefore(loggedAt)} feltétel miatt
     * két AZONOS {@code loggedAt} pillanatú étkezés kölcsönösen kizárja egymást, tehát mindkettő
     * ugyanazt a {@code kcalBefore}-t látja. {@code MealCoachService}'s blokk-összeállítása ezzel
     * szemben lista-sorrendben fut kumulatív összeggel, tehát ott a második a listában MÁR látja az
     * elsőt — ugyanarra a napra a score és a coach-próza így (mikroszekundumos pontosságú egyezés
     * esetén) eltérő napi állapotot mondana. Nincs viselkedésbeli javítás tervezve.
     */
    @Transactional(readOnly = true)
    public DayContext dayContext(UUID userId, LocalDate date, Instant loggedAt, UUID excludeMealId) {
        BigDecimal kcal = BigDecimal.ZERO;
        BigDecimal p = BigDecimal.ZERO;
        for (MealEntity meal : mealRepository
                .findWithItemsByCreatedByAndMealDateAndDeletedFalseOrderByLoggedAtAsc(userId, date)) {
            if (meal.getId() != null && meal.getId().equals(excludeMealId)) {
                continue;
            }
            if (meal.getLoggedAt() == null || !meal.getLoggedAt().isBefore(loggedAt)) {
                continue;
            }
            for (MealItemEntity item : meal.getItems()) {
                Macros contribution = mapper.contribution(item);
                kcal = kcal.add(contribution.getKcal());
                p = p.add(contribution.getP());
            }
        }
        return DayContext.of(kcal, p);
    }

    /** consumed = Σ meal macros; water = Σ the day's water-log entries. */
    private MacroSet consumed(List<MealResponse> meals, int water) {
        BigDecimal kcal = BigDecimal.ZERO, p = BigDecimal.ZERO, c = BigDecimal.ZERO, f = BigDecimal.ZERO;
        for (MealResponse m : meals) {
            kcal = kcal.add(m.getMacros().getKcal());
            p = p.add(m.getMacros().getP());
            c = c.add(m.getMacros().getC());
            f = f.add(m.getMacros().getF());
        }
        return MacroSet.builder()
            .kcal(kcal).p(p).c(c).f(f)
            .water(BigDecimal.valueOf(water))
            .build();
    }
}
