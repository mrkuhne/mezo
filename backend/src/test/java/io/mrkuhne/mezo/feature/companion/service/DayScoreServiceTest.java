package io.mrkuhne.mezo.feature.companion.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

import io.mrkuhne.mezo.api.dto.FuelDayResponse;
import io.mrkuhne.mezo.api.dto.MacroSet;
import io.mrkuhne.mezo.api.dto.Macros;
import io.mrkuhne.mezo.api.dto.MealBreakdown;
import io.mrkuhne.mezo.api.dto.MealResponse;
import io.mrkuhne.mezo.api.dto.MealScore;
import io.mrkuhne.mezo.api.dto.MealScoreDimension;
import io.mrkuhne.mezo.feature.biometrics.checkin.entity.CheckInEntity;
import io.mrkuhne.mezo.feature.biometrics.checkin.repository.CheckInRepository;
import io.mrkuhne.mezo.feature.companion.config.DayEvaluationProperties;
import io.mrkuhne.mezo.feature.companion.service.DayEvaluationEngine.DayDimension;
import io.mrkuhne.mezo.feature.companion.service.DayEvaluationEngine.DayInputs;
import io.mrkuhne.mezo.feature.meal.entity.MealEntity;
import io.mrkuhne.mezo.feature.meal.repository.MealRepository;
import io.mrkuhne.mezo.feature.meal.repository.WaterLogRepository;
import io.mrkuhne.mezo.feature.meal.service.FuelDayService;
import io.mrkuhne.mezo.feature.train.service.WorkoutWindowQueryService;
import io.mrkuhne.mezo.feature.train.service.WorkoutWindowQueryService.Window;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

/**
 * The Task-5 wiring test (mezo-jcpt.4): {@link DayScoreService} no longer owns any day math — it
 * LOADS a {@link DayInputs} and hands it to the real {@link DayEvaluationEngine}. The engine is
 * therefore a REAL instance here (with the config defaults), not a mock: a mocked engine would
 * happily accept a mis-wired input and the test would still pass, whereas these assertions pin
 * exact engine outputs and so fail the moment a field is loaded from the wrong source.
 *
 * <p>Everything the loader reads is mocked at its own seam (metric series, fuel rollup, meal rows,
 * water sums, check-ins, workout windows), which is what makes the input-loading map itself the
 * subject under test.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class DayScoreServiceTest {

    private static final UUID USER = UUID.randomUUID();
    private static final UUID MEAL_ID = UUID.randomUUID();
    /** Deliberately far in the past so every day under test is {@code closed} (date < today). */
    private static final LocalDate MONDAY = LocalDate.of(2026, 6, 15);
    private static final LocalDate SUNDAY = MONDAY.plusDays(6);

    @Mock private MetricSeriesService metricSeriesService;
    @Mock private CheckInRepository checkInRepository;
    @Mock private FuelDayService fuelDayService;
    @Mock private MealRepository mealRepository;
    @Mock private WaterLogRepository waterLogRepository;
    @Mock private WorkoutWindowQueryService workoutWindowQueryService;

    private final DayEvaluationProperties props = new DayEvaluationProperties(
        new DayEvaluationProperties.Weights(0.30, 0.15, 0.20, 0.15, 0.10, 0.10),
        new DayEvaluationProperties.NutritionBands(0.10, 0.05, 3.0, 0.05, 2.5, 0.15, 1.5),
        150, 7.5, 7, 3, 120);

    private DayScoreService service;

    /** Per-day fixtures the mocked seams answer from. */
    private final Map<LocalDate, Double> sleepH = new HashMap<>();
    private final Map<LocalDate, Double> sleepQuality = new HashMap<>();
    private final Map<LocalDate, FuelDayResponse> fuelDays = new HashMap<>();
    private final Map<LocalDate, List<Window>> windows = new HashMap<>();
    private final Map<LocalDate, Integer> waterMl = new HashMap<>();
    private final Map<LocalDate, Integer> checkins = new HashMap<>();
    private final List<MealEntity> mealRows = new ArrayList<>();

    @BeforeEach
    void setUp() {
        service = new DayScoreService(metricSeriesService, checkInRepository, fuelDayService,
            mealRepository, waterLogRepository, workoutWindowQueryService,
            new DayEvaluationEngine(props), props);

        when(metricSeriesService.series(eq(USER), eq(MetricKey.SLEEP_DURATION_H), any(), any()))
            .thenAnswer(inv -> slice(sleepH, inv.getArgument(2), inv.getArgument(3)));
        when(metricSeriesService.series(eq(USER), eq(MetricKey.SLEEP_QUALITY), any(), any()))
            .thenAnswer(inv -> slice(sleepQuality, inv.getArgument(2), inv.getArgument(3)));
        when(fuelDayService.getDay(eq(USER), any()))
            .thenAnswer(inv -> fuelDays.getOrDefault(inv.getArgument(1), emptyFuelDay(inv.getArgument(1))));
        when(workoutWindowQueryService.windowsFor(eq(USER), any(), any()))
            .thenAnswer(inv -> slice(windows, inv.getArgument(1), inv.getArgument(2)));
        when(waterLogRepository.sumsBetween(eq(USER), any(), any())).thenAnswer(inv ->
            slice(waterMl, inv.getArgument(1), inv.getArgument(2)).entrySet().stream()
                .map(e -> new Object[] {e.getKey(), (long) (int) e.getValue()}).toList());
        when(checkInRepository.findByCreatedByAndDeletedFalseAndDateBetween(eq(USER), any(), any()))
            .thenAnswer(inv -> checkinRows(inv.getArgument(1), inv.getArgument(2)));
        when(mealRepository.findByCreatedByAndDeletedFalseAndMealDateBetweenOrderByMealDateAsc(
            eq(USER), any(), any())).thenAnswer(inv -> mealRows.stream()
                .filter(m -> !m.getMealDate().isBefore(inv.getArgument(1))
                          && !m.getMealDate().isAfter(inv.getArgument(2)))
                .toList());
    }

    private static <T> Map<LocalDate, T> slice(Map<LocalDate, T> src, LocalDate from, LocalDate to) {
        Map<LocalDate, T> out = new HashMap<>();
        src.forEach((d, v) -> {
            if (!d.isBefore(from) && !d.isAfter(to)) {
                out.put(d, v);
            }
        });
        return out;
    }

    private List<CheckInEntity> checkinRows(LocalDate from, LocalDate to) {
        List<CheckInEntity> rows = new ArrayList<>();
        checkins.forEach((d, n) -> {
            if (!d.isBefore(from) && !d.isAfter(to)) {
                for (int i = 0; i < n; i++) {
                    CheckInEntity c = new CheckInEntity();
                    c.setCreatedBy(USER);
                    c.setDate(d);
                    rows.add(c);
                }
            }
        });
        return rows;
    }

    // --- Fixture builders ------------------------------------------------------------------

    private static MacroSet macroSet(double kcal, double p, double c, double f) {
        return MacroSet.builder().kcal(BigDecimal.valueOf(kcal)).p(BigDecimal.valueOf(p))
            .c(BigDecimal.valueOf(c)).f(BigDecimal.valueOf(f)).water(BigDecimal.valueOf(2500)).build();
    }

    private static FuelDayResponse emptyFuelDay(LocalDate date) {
        return FuelDayResponse.builder().date(date)
            .targets(macroSet(2600, 170, 310, 80))
            .consumed(macroSet(0, 0, 0, 0))
            .meals(List.of())
            .build();
    }

    /** A day whose consumed macros sit EXACTLY on the target set, with one scored, timely meal. */
    private void seedOnTargetFuelDay(LocalDate date) {
        fuelDays.put(date, FuelDayResponse.builder().date(date)
            .targets(macroSet(2600, 170, 310, 80))
            .consumed(macroSet(2600, 170, 310, 80))
            .meals(List.of(meal(date, "lunch", 2600, 0.9, 0.6)))
            .build());
        seedMealRow(date, LocalTime.of(12, 30));   // logged 30 min after the 12:00 meal -> timely
    }

    private static MealResponse meal(LocalDate date, String slot, double kcal, Double nova, Double micro) {
        List<MealScoreDimension> dims = new ArrayList<>();
        dims.add(new MealScoreDimension().id("nova").label("NOVA")
            .weight(BigDecimal.valueOf(nova == null ? 0 : 0.25))
            .score(BigDecimal.valueOf(nova == null ? 0 : nova)).detail("-"));
        dims.add(new MealScoreDimension().id("micro").label("Mikro")
            .weight(BigDecimal.valueOf(micro == null ? 0 : 0.10))
            .score(BigDecimal.valueOf(micro == null ? 0 : micro)).detail("-"));
        return new MealResponse()
            .id(MEAL_ID)
            .slot(slot)
            .mealDate(date)
            .loggedAt(OffsetDateTime.of(date, LocalTime.of(12, 0), ZoneOffset.UTC))
            .macros(Macros.builder().kcal(BigDecimal.valueOf(kcal)).p(BigDecimal.ZERO)
                .c(BigDecimal.ZERO).f(BigDecimal.ZERO).build())
            .score(new MealScore().value(BigDecimal.valueOf(0.8))
                .breakdown(new MealBreakdown().value(BigDecimal.valueOf(0.8))
                    .confidence(BigDecimal.ONE).dimensions(dims)
                    .improve(List.of()).tools(List.of())))
            .items(List.of());
    }

    /** The row behind {@link #meal}: {@code created_at} is the REAL logging instant (the
     *  {@code loggedAt} the DTO carries is when the meal was EATEN). */
    private void seedMealRow(LocalDate date, LocalTime createdAt) {
        MealEntity row = new MealEntity();
        row.setId(MEAL_ID);
        row.setCreatedBy(USER);
        row.setMealDate(date);
        row.setSlot("lunch");
        row.setLoggedAt(date.atTime(12, 0).toInstant(ZoneOffset.UTC));
        row.setCreatedAt(date.atTime(createdAt).toInstant(ZoneOffset.UTC));
        mealRows.add(row);
    }

    private static Integer dim(DayScoreService.DayScore day, String id) {
        return day.evaluation().dimensions().stream().filter(d -> d.id().equals(id))
            .findFirst().map(DayDimension::score).orElseThrow();
    }

    private static DayDimension dimension(DayScoreService.DayScore day, String id) {
        return day.evaluation().dimensions().stream().filter(d -> d.id().equals(id))
            .findFirst().orElseThrow();
    }

    // --- Tests ----------------------------------------------------------------------------

    /**
     * The wire-compat regression the brief asks for: {@code scores()} still yields one element per
     * calendar day, and {@link DayScoreService.DaySubscores}'s six fields are populated from the
     * evaluation's six dimensions under their own dimension-ids — a straight 1:1 projection — with
     * {@code score == evaluation.base()}.
     */
    @Test
    void scoresReturnsSevenDaysWithSubscoresProjectedFromTheSixDimensions() {
        seedOnTargetFuelDay(MONDAY);
        sleepH.put(MONDAY, 7.5);
        sleepQuality.put(MONDAY, 10.0);
        windows.put(MONDAY, List.of(new Window(LocalTime.of(18, 0), LocalTime.of(19, 0), "gym", true, "Pull")));
        waterMl.put(MONDAY, 2000);
        checkins.put(MONDAY, 4);

        List<DayScoreService.DayScore> days = service.scores(USER, MONDAY, SUNDAY);

        assertThat(days).hasSize(7);
        assertThat(days.stream().map(DayScoreService.DayScore::date))
            .containsExactlyElementsOf(MONDAY.datesUntil(SUNDAY.plusDays(1)).toList());

        DayScoreService.DayScore monday = days.get(0);
        assertThat(monday.subscores().nutrition()).isEqualTo(dim(monday, "nutrition"));
        assertThat(monday.subscores().quality()).isEqualTo(dim(monday, "quality"));
        assertThat(monday.subscores().training()).isEqualTo(dim(monday, "training"));
        assertThat(monday.subscores().sleep()).isEqualTo(dim(monday, "sleep"));
        assertThat(monday.subscores().logging()).isEqualTo(dim(monday, "logging"));
        // rhythm is degraded (no priors seeded) — NULL, not 0 (the "tanulom" signal).
        assertThat(monday.subscores().rhythm()).isNull();
        assertThat(monday.score()).isEqualTo(monday.evaluation().base());
        assertThat(monday.evaluation().date()).isEqualTo(MONDAY);
    }

    /**
     * The Step-1 pin (mezo-jcpt.5): {@code toSubscores} projects all six dimensions, and a
     * degraded one (weight 0, status != DONE) projects to {@code null}, never a fabricated 0 —
     * exercised through the public {@link DayScoreService#scores(UUID, LocalDate, LocalDate)}
     * entry point since no {@code DayScoreServiceTestAccess} helper exists to reach the private
     * {@code toSubscores} directly.
     */
    @Test
    void toSubscores_projects_all_six_dimensions_and_nulls_a_degraded_one() {
        seedOnTargetFuelDay(MONDAY);
        sleepH.put(MONDAY, 7.5);
        sleepQuality.put(MONDAY, 10.0);
        windows.put(MONDAY, List.of(new Window(LocalTime.of(18, 0), LocalTime.of(19, 0), "gym", true, "Pull")));
        waterMl.put(MONDAY, 2000);
        checkins.put(MONDAY, 4);
        // rhythm stays degraded: no prior days seeded, so its weight is 0 and status != DONE.

        DayScoreService.DaySubscores s = service.scores(USER, MONDAY, MONDAY).get(0).subscores();

        assertThat(s.nutrition()).isEqualTo(100);
        assertThat(s.quality()).isEqualTo(83);
        assertThat(s.training()).isEqualTo(100);
        assertThat(s.sleep()).isEqualTo(100);
        assertThat(s.logging()).isEqualTo(100);
        // A degradált dimenzió NULL, nem 0 — ez a "tanulom" jel, amit a csempe már ma is renderel.
        assertThat(s.rhythm()).isNull();
    }

    /**
     * Every {@link DayInputs} field, pinned through the REAL engine's arithmetic — a value loaded
     * from the wrong source moves at least one of these numbers.
     *
     * <p>nutrition: consumed == targets on all four macros -> 100. quality: nova .9 kcal-weighted,
     * micro .6 -> 0.75*.9 + 0.25*.6 = 0.825 -> 83. training: 1 planned window, done -> 0.3+0.7 =
     * 100. sleep: 7.5h at the 7.5h target with quality 10 -> 0.7*1 + 0.3*1 = 100. logging: the
     * meal was logged 30 min after it was eaten (within the 120 min band) -> 1.0; water logged;
     * 4/4 check-ins -> 100. rhythm: no prior day has a base -> NO_DATA (weight 0).
     */
    @Test
    void everyInputIsLoadedFromItsDocumentedSource() {
        seedOnTargetFuelDay(MONDAY);
        sleepH.put(MONDAY, 7.5);
        sleepQuality.put(MONDAY, 10.0);
        windows.put(MONDAY, List.of(new Window(LocalTime.of(18, 0), LocalTime.of(19, 0), "gym", true, "Pull")));
        waterMl.put(MONDAY, 2000);
        checkins.put(MONDAY, 4);

        DayScoreService.DayScore monday = service.scores(USER, MONDAY, MONDAY).get(0);

        assertThat(dim(monday, "nutrition")).isEqualTo(100);
        assertThat(dim(monday, "quality")).isEqualTo(83);
        assertThat(dim(monday, "training")).isEqualTo(100);
        assertThat(dim(monday, "sleep")).isEqualTo(100);
        assertThat(dim(monday, "logging")).isEqualTo(100);
        assertThat(dimension(monday, "rhythm").status()).isEqualTo("NO_DATA");
        // rhythm is out, so the other five renormalize over 0.90 -> base is their weighted mean.
        assertThat(monday.score()).isEqualTo(97);
    }

    /** A meal logged the NEXT morning for yesterday's dinner blows the 120-minute timeliness
     *  band — proving {@code loggedAt} comes from the row's {@code created_at} and {@code eatenAt}
     *  from the meal's own {@code logged_at}, not the same timestamp twice (which would make every
     *  meal trivially timely). */
    @Test
    void mealTimelinessComparesTheRowsCreationInstantAgainstTheMealsOwnTime() {
        seedOnTargetFuelDay(MONDAY);
        mealRows.clear();
        seedMealRow(MONDAY, LocalTime.of(23, 30));   // eaten 12:00, logged 23:30 -> 690 min late
        waterMl.put(MONDAY, 2000);
        checkins.put(MONDAY, 4);

        DayScoreService.DayScore monday = service.scores(USER, MONDAY, MONDAY).get(0);

        // meal component 0 -> 0.5*0 + 0.2*1 + 0.3*1 = 0.5 -> 50
        assertThat(dim(monday, "logging")).isEqualTo(50);
    }

    /** A day with no meal rows at all has NO nutrition measurement — never a "0 kcal vs target"
     *  reading synthesized out of an empty consumed rollup. */
    @Test
    void aDayWithoutMealsHasNoNutritionData() {
        sleepH.put(MONDAY, 7.5);

        DayScoreService.DayScore monday = service.scores(USER, MONDAY, MONDAY).get(0);

        assertThat(dimension(monday, "nutrition").status()).isEqualTo("NO_DATA");
        assertThat(dimension(monday, "quality").status()).isEqualTo("NO_DATA");
        assertThat(monday.subscores().nutrition()).isNull();
    }

    /** Rest day: no planned window means training drops out rather than scoring a penalty. */
    @Test
    void aRestDayDropsTrainingInsteadOfPenalizingIt() {
        seedOnTargetFuelDay(MONDAY);

        DayScoreService.DayScore monday = service.scores(USER, MONDAY, MONDAY).get(0);

        assertThat(dimension(monday, "training").status()).isEqualTo("NO_DATA");
        assertThat(dimension(monday, "training").weight()).isZero();
        assertThat(monday.subscores().training()).isNull();
    }

    /**
     * Rhythm is fed by the PRIOR days' base scores. Seeding the three days before Monday (the
     * configured {@code rhythmMinDays}) flips rhythm from NO_DATA to DONE, and its score is the
     * mean of those days' own base scores — which are themselves computed WITHOUT rhythm, so the
     * dimension can never recurse into itself.
     *
     * <p>Each prior day is nutrition 100 · quality 83 · sleep 100 · logging 100 with training and
     * rhythm both degraded (no planned workout, no priors of its own), so its rhythm-free base is
     * {@code (.30*100 + .15*83 + .15*100 + .10*100) / .70 = 96.36 -> 96}; the mean of three
     * identical 96s is 96.
     */
    @Test
    void rhythmAveragesThePriorDaysBaseScoresWithoutRecursing() {
        for (LocalDate d : List.of(MONDAY.minusDays(3), MONDAY.minusDays(2), MONDAY.minusDays(1))) {
            seedOnTargetFuelDay(d);
            sleepH.put(d, 7.5);
            sleepQuality.put(d, 10.0);
            waterMl.put(d, 2000);
            checkins.put(d, 4);
        }
        seedOnTargetFuelDay(MONDAY);
        sleepH.put(MONDAY, 7.5);

        DayScoreService.DayScore monday = service.scores(USER, MONDAY, MONDAY).get(0);

        DayDimension rhythm = dimension(monday, "rhythm");
        assertThat(rhythm.status()).isEqualTo("DONE");
        assertThat(rhythm.score()).isEqualTo(96);
        assertThat(rhythm.facts()).anySatisfy(f -> assertThat(f.value()).isEqualTo("3 / 7"));
    }

    /** Task 8's entry point: the same loading map, for one arbitrary day, priors included. */
    @Test
    void inputsForBuildsOneDaysInputsIncludingItsPriorBaseScores() {
        for (LocalDate d : List.of(MONDAY.minusDays(3), MONDAY.minusDays(2), MONDAY.minusDays(1))) {
            seedOnTargetFuelDay(d);
            sleepH.put(d, 7.5);
            sleepQuality.put(d, 10.0);
            waterMl.put(d, 2000);
            checkins.put(d, 4);
        }
        seedOnTargetFuelDay(MONDAY);
        sleepH.put(MONDAY, 7.5);
        sleepQuality.put(MONDAY, 10.0);
        windows.put(MONDAY, List.of(new Window(LocalTime.of(18, 0), LocalTime.of(19, 0), "gym", true, "Pull")));
        waterMl.put(MONDAY, 2000);
        checkins.put(MONDAY, 4);

        DayInputs in = service.inputsFor(USER, MONDAY);

        assertThat(in.date()).isEqualTo(MONDAY);
        assertThat(in.closed()).isTrue();
        assertThat(in.kcal()).isEqualTo(2600.0);
        assertThat(in.proteinG()).isEqualTo(170.0);
        assertThat(in.carbsG()).isEqualTo(310.0);
        assertThat(in.fatG()).isEqualTo(80.0);
        assertThat(in.kcalTarget()).isEqualTo(2600.0);
        assertThat(in.proteinTargetG()).isEqualTo(170.0);
        assertThat(in.plannedWorkouts()).isEqualTo(1);
        assertThat(in.doneWorkouts()).isEqualTo(1);
        assertThat(in.workoutDay()).isTrue();
        assertThat(in.sleepH()).isEqualTo(7.5);
        assertThat(in.sleepQuality1to10()).isEqualTo(10);
        assertThat(in.waterLogged()).isTrue();
        assertThat(in.checkinCount()).isEqualTo(4);
        assertThat(in.meals()).singleElement().satisfies(m -> {
            assertThat(m.slot()).isEqualTo("lunch");
            assertThat(m.eatenAt()).isEqualTo(LocalTime.of(12, 0));
            assertThat(m.loggedAt()).isEqualTo(LocalTime.of(12, 30));
            assertThat(m.novaDimScore()).isEqualTo(0.9);
            assertThat(m.microDimScore()).isEqualTo(0.6);
            assertThat(m.kcal()).isEqualTo(2600.0);
        });
        assertThat(in.priorBaseScores()).hasSize(3);
    }

    /** An unfinished day carries no overall score: {@code closed} is {@code date < today}. */
    @Test
    void todayIsNotClosedSoItHasNoBaseScore() {
        LocalDate today = LocalDate.now();
        seedOnTargetFuelDay(today);
        sleepH.put(today, 7.5);

        DayScoreService.DayScore day = service.scores(USER, today, today).get(0);

        assertThat(day.evaluation().base()).isNull();
        assertThat(day.score()).isNull();
        assertThat(dimension(day, "nutrition").status()).isEqualTo("IN_PROGRESS");
    }

    /** The pre-fetched overload degrades to its own fetch for a day the caller's map omits
     *  (mezo-8tp8 I1) instead of NPE-ing. */
    @Test
    void mapOverloadFallsBackToFetchWhenADayIsMissingFromTheSuppliedMap() {
        seedOnTargetFuelDay(MONDAY);
        sleepH.put(MONDAY, 7.5);

        DayScoreService.DayScore monday =
            service.scores(USER, MONDAY, MONDAY, Map.<LocalDate, FuelDayResponse>of()).get(0);

        assertThat(dim(monday, "nutrition")).isEqualTo(100);
    }
}
