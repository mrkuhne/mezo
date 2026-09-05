package io.mrkuhne.mezo.feature.companion.controller;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.MacroSet;
import io.mrkuhne.mezo.api.dto.MeWeekResponse;
import io.mrkuhne.mezo.api.dto.MeWeekTrendPoint;
import io.mrkuhne.mezo.api.dto.MeWeekTrendResponse;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.companion.entity.WeeklyScoreEntity;
import io.mrkuhne.mezo.feature.meal.entity.MealEntity;
import io.mrkuhne.mezo.feature.meal.entity.MealItemEntity;
import io.mrkuhne.mezo.feature.meal.repository.MealRepository;
import io.mrkuhne.mezo.feature.meal.service.FuelDayService;
import io.mrkuhne.mezo.feature.pantry.entity.PantryItemEntity;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.CheckInPopulator;
import io.mrkuhne.mezo.support.populator.PantryItemPopulator;
import io.mrkuhne.mezo.support.populator.SleepLogPopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import io.mrkuhne.mezo.support.populator.WeeklyScorePopulator;
import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.time.temporal.TemporalAdjusters;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.test.context.ActiveProfiles;

/**
 * Persisted weekly score + trend (mezo-d20.7.5, handoff 2026-08-28 §6.3) — the HTTP contract of
 * {@code GET /api/me/week/{start}/trend} and the cache rules behind it: a scored week is written
 * through on the week read and comes back from the trend; a RETROACTIVE log invalidates the
 * cached value on the next read (the freshness probe); a shorter history yields a SHORTER series
 * (never a zero-padded one); and one user never sees another's scores.
 *
 * <p>Weeks are anchored relative to today so "the week has finished" — the condition under which
 * a cached value may be served at all — is true regardless of when the suite runs.
 */
@ActiveProfiles("companion-fake")
class MeWeekTrendIT extends ApiIntegrationTest {

    @Autowired private SleepLogPopulator sleepLogPopulator;
    @Autowired private CheckInPopulator checkInPopulator;
    @Autowired private TrainPopulator trainPopulator;
    @Autowired private PantryItemPopulator pantryItemPopulator;
    @Autowired private MealRepository mealRepository;
    @Autowired private FuelDayService fuelDayService;
    @Autowired private AppUserRepository appUserRepository;
    @Autowired private OwnerProperties ownerProperties;
    @Autowired private WeeklyScorePopulator weeklyScorePopulator;
    @Autowired private UserPopulator userPopulator;

    /** The Monday {@code n} completed weeks back — always a week that has already ended. */
    private static LocalDate weeksAgo(int n) {
        return LocalDate.now().with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)).minusWeeks(n);
    }

    private UUID ownerId() {
        return appUserRepository.findByEmail(ownerProperties.ownerEmail()).orElseThrow().getId();
    }

    private MeWeekResponse week(LocalDate start) {
        return getForBody("/api/me/week/" + start, ownerAuthHeaders(), HttpStatus.OK, MeWeekResponse.class);
    }

    private MeWeekTrendResponse trend(LocalDate start, Integer weeks) {
        String uri = "/api/me/week/" + start + "/trend" + (weeks == null ? "" : "?weeks=" + weeks);
        return getForBody(uri, ownerAuthHeaders(), HttpStatus.OK, MeWeekTrendResponse.class);
    }

    /** A dense day: sleep + a pantry-arm meal at target + all four check-in slots + a workout
     *  (the {@code MeWeekControllerIT} recipe — a day that scores 100 across all four subscores). */
    private void seedDenseDay(UUID owner, LocalDate date) {
        sleepLogPopulator.createSleepLog(owner, date, new BigDecimal("8.0"), 10);
        seedMeal(owner, date, 1.0, 1.0);
        checkInPopulator.createCheckIn(owner, date, "08:00", 10, 5, null);
        checkInPopulator.createCheckIn(owner, date, "12:00", 10, 5, null);
        checkInPopulator.createCheckIn(owner, date, "16:00", 10, 5, null);
        checkInPopulator.createCheckIn(owner, date, "20:00", 10, 5, null);
        trainPopulator.createSportSession(owner, date);
    }

    /** A thin day that still scores: a short, poor-quality sleep + a single check-in — two
     *  subscores, both low, so adding it to a week of dense days MOVES the weekly score down. */
    private void seedWeakDay(UUID owner, LocalDate date) {
        sleepLogPopulator.createSleepLog(owner, date, new BigDecimal("3.0"), 1);
        checkInPopulator.createCheckIn(owner, date, "08:00", 1, 9, null);
    }

    /** {@code MeWeekControllerIT.seedMeal} — a pantry-arm meal landing exactly at the day's target. */
    private void seedMeal(UUID owner, LocalDate date, double kcalFactor, double proteinFactor) {
        MacroSet targets = fuelDayService.getDay(owner, date).getTargets();
        PantryItemEntity item = pantryItemPopulator.createFood(owner, "trend-food-" + UUID.randomUUID(), null);

        MealEntity meal = new MealEntity();
        meal.setCreatedBy(owner);
        // Eaten at today's wall-clock time-of-day so the row's Hibernate-stamped created_at (when
        // it was WRITTEN — no test can choose it) lands inside the logging dimension's 120-minute
        // timeliness band: the fixture is "logged as it was eaten", the normal case.
        meal.setLoggedAt(date.atTime(LocalTime.now(ZoneOffset.UTC).truncatedTo(ChronoUnit.MINUTES))
            .toInstant(ZoneOffset.UTC));
        meal.setMealDate(date);
        meal.setSlot("lunch");
        meal.setTitle("Trend fixture");

        MealItemEntity line = new MealItemEntity();
        line.setMeal(meal);
        line.setCreatedBy(owner);
        line.setLineOrder(0);
        line.setSource("pantry");
        line.setPantryItemId(item.getId());
        line.setAmount(BigDecimal.ONE);
        line.setUnit("g");
        line.setSnapshotName(item.getCatalog().getName());
        line.setSnapshotPer(BigDecimal.ONE);
        line.setSnapshotBasisUnit("g");
        line.setSnapshotKcal(BigDecimal.valueOf(targets.getKcal().doubleValue() * kcalFactor));
        line.setSnapshotProteinG(BigDecimal.valueOf(targets.getP().doubleValue() * proteinFactor));
        line.setSnapshotCarbsG(BigDecimal.TEN);
        line.setSnapshotFatG(BigDecimal.ONE);
        line.setSnapshotNova((short) 1);
        meal.getItems().add(line);
        mealRepository.saveAndFlush(meal);
    }

    @Test
    void weekReadPersistsTheScoreAndTheTrendReadsItBack() {
        UUID owner = ownerId();
        LocalDate week = weeksAgo(1);
        seedDenseDay(owner, week);
        seedDenseDay(owner, week.plusDays(1));

        // Two identical dense days at 89 each (the 6-dimension engine's reading of this fixture —
        // see MeWeekControllerIT for the arithmetic), so the week rolls up to 89.
        Integer liveScore = week(week).getWeekly().getScore();
        assertThat(liveScore).isEqualTo(89);

        // Write-through: the week read itself persisted the score.
        WeeklyScoreEntity persisted = weeklyScorePopulator.find(owner, week).orElseThrow();
        assertThat(persisted.getScore()).isEqualTo(89);
        assertThat(persisted.getSleepAvg()).isEqualByComparingTo("100.00");
        assertThat(persisted.getFuelAvg()).isEqualByComparingTo("80.00");
        // checkin←logging's ABSENCE semantics changed twice now. mezo-jcpt.4 first made a
        // wholly-untouched day's logging dimension a real, measured 0 (unlike the old check-in
        // subscore's null) — a process dimension that refused to score an untouched day would be
        // exactly the free pass it exists to catch. mezo-el0t (Task 2 of this branch) narrowed
        // that: a day with genuinely NO log activity at all (no meals/water/checkin/sleep/
        // workouts/weight/xp) is not-measurable (null again), because "0" there asserted a
        // measurement that never happened; a day that logged SOMETHING but skipped check-ins
        // specifically still gets an honest 0. This fixture's five unseeded days of the week are
        // wholly untouched, so they now DROP OUT of the average instead of dragging it toward 0:
        // the week averages just the two dense days, 80 and 80 → 80.00 (mezo-el0t, deliberate —
        // do not "restore" 22.86; see WeeklyScoreService.aggregate's javadoc).
        assertThat(persisted.getCheckinAvg()).isEqualByComparingTo("80.00");
        assertThat(persisted.getActivityAvg()).isEqualByComparingTo("100.00");
        assertThat(persisted.getComputedAt()).isNotNull();

        MeWeekTrendResponse trend = trend(week, 8);
        assertThat(trend.getStart()).isEqualTo(week);
        assertThat(trend.getWeeks()).isEqualTo(8);
        assertThat(trend.getPoints()).hasSize(1);
        MeWeekTrendPoint point = trend.getPoints().get(0);
        assertThat(point.getWeekStart()).isEqualTo(week);
        assertThat(point.getScore()).isEqualTo(liveScore);
        assertThat(point.getSleepAvg()).isEqualByComparingTo("100.00");
        assertThat(point.getComputedAt()).isNotNull();
    }

    @Test
    void aRetroactiveLogInvalidatesTheCachedScoreOnTheNextRead() {
        UUID owner = ownerId();
        LocalDate week = weeksAgo(2);
        seedDenseDay(owner, week);
        seedDenseDay(owner, week.plusDays(1));

        MeWeekTrendResponse before = trend(week, 1);
        assertThat(before.getPoints()).hasSize(1);
        assertThat(before.getPoints().get(0).getScore()).isEqualTo(89);
        Instant firstComputedAt = weeklyScorePopulator.find(owner, week).orElseThrow().getComputedAt();

        // A log written AFTER the score was computed, into a day of that same past week.
        seedWeakDay(owner, week.plusDays(3));

        MeWeekTrendResponse after = trend(week, 1);
        assertThat(after.getPoints()).hasSize(1);
        assertThat(after.getPoints().get(0).getScore()).isLessThan(89);
        assertThat(weeklyScorePopulator.find(owner, week).orElseThrow().getComputedAt())
                .isAfterOrEqualTo(firstComputedAt);
        // and the cache now agrees with the live computation
        assertThat(after.getPoints().get(0).getScore()).isEqualTo(week(week).getWeekly().getScore());
    }

    @Test
    void aShorterHistoryYieldsAShorterSeriesNeverPaddedWithZeros() {
        UUID owner = ownerId();
        LocalDate lastWeek = weeksAgo(1);
        LocalDate threeWeeksAgo = weeksAgo(3);
        seedDenseDay(owner, lastWeek);
        seedDenseDay(owner, lastWeek.plusDays(1));
        seedDenseDay(owner, threeWeeksAgo);
        seedDenseDay(owner, threeWeeksAgo.plusDays(1));

        MeWeekTrendResponse trend = trend(lastWeek, 8);

        assertThat(trend.getPoints()).hasSize(2);
        assertThat(trend.getPoints()).extracting(MeWeekTrendPoint::getWeekStart)
                .containsExactly(threeWeeksAgo, lastWeek); // oldest first, the empty weeks absent
        assertThat(trend.getPoints()).extracting(MeWeekTrendPoint::getScore)
                .allSatisfy(score -> assertThat(score).isNotNull().isNotZero());
    }

    @Test
    void aWeekWithASingleScoredDayProducesNoPoint() {
        UUID owner = ownerId();
        LocalDate week = weeksAgo(1);
        seedDenseDay(owner, week); // ONE scored day — below the <2 weekly honesty gate

        assertThat(week(week).getWeekly().getScore()).isNull();
        assertThat(weeklyScorePopulator.find(owner, week)).isEmpty();
        assertThat(trend(week, 8).getPoints()).isEmpty();
    }

    @Test
    void anotherUsersScoresAreNeverVisibleAndNeverTouched() {
        UUID owner = ownerId();
        UUID stranger = userPopulator.createUser().getId();
        LocalDate week = weeksAgo(2);
        LocalDate ownWeek = weeksAgo(1);

        weeklyScorePopulator.weeklyScore(stranger, week, 91,
                Instant.now().minus(1, ChronoUnit.DAYS));
        seedDenseDay(owner, ownWeek);
        seedDenseDay(owner, ownWeek.plusDays(1));

        MeWeekTrendResponse trend = trend(ownWeek, 8);

        assertThat(trend.getPoints()).extracting(MeWeekTrendPoint::getWeekStart)
                .containsExactly(ownWeek);
        assertThat(trend.getPoints()).extracting(MeWeekTrendPoint::getScore).doesNotContain(91);
        // the stranger's row survived the owner's read untouched
        assertThat(weeklyScorePopulator.find(stranger, week)).isPresent()
                .get().extracting(WeeklyScoreEntity::getScore).isEqualTo(91);
    }

    @Test
    void trendDefaultsToEightWeeksWhenTheParameterIsOmitted() {
        MeWeekTrendResponse trend = trend(weeksAgo(1), null);
        assertThat(trend.getWeeks()).isEqualTo(8);
        assertThat(trend.getPoints()).isEmpty();
    }

    @Test
    void nonMondayStartIs400() {
        LocalDate tuesday = weeksAgo(1).plusDays(1);
        String body = exchangeForBody(org.springframework.http.HttpMethod.GET,
                "/api/me/week/" + tuesday + "/trend", null, ownerAuthHeaders(),
                HttpStatus.BAD_REQUEST, String.class);
        assertHasRequestError(body, "ME_WEEK_START_NOT_MONDAY");
    }

    @Test
    void theCachedValueIsServedWhenNothingChanged() {
        UUID owner = ownerId();
        LocalDate week = weeksAgo(2);
        seedDenseDay(owner, week);
        seedDenseDay(owner, week.plusDays(1));

        trend(week, 1);
        Instant computedAt = weeklyScorePopulator.find(owner, week).orElseThrow().getComputedAt();

        List<MeWeekTrendPoint> points = trend(week, 1).getPoints();

        assertThat(points).hasSize(1);
        // untouched stamp = the second read did NOT recompute
        assertThat(weeklyScorePopulator.find(owner, week).orElseThrow().getComputedAt())
                .isEqualTo(computedAt);
    }
}
