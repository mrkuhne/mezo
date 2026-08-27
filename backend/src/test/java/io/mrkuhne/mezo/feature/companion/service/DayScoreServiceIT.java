package io.mrkuhne.mezo.feature.companion.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.MacroSet;
import io.mrkuhne.mezo.feature.meal.entity.MealEntity;
import io.mrkuhne.mezo.feature.meal.entity.MealItemEntity;
import io.mrkuhne.mezo.feature.meal.repository.MealRepository;
import io.mrkuhne.mezo.feature.meal.service.FuelDayService;
import io.mrkuhne.mezo.feature.pantry.entity.PantryItemEntity;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.CheckInPopulator;
import io.mrkuhne.mezo.support.populator.PantryItemPopulator;
import io.mrkuhne.mezo.support.populator.SleepLogPopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

/**
 * Weekly review (mezo-p2tr) — the deterministic per-day score service, over populator-seeded
 * days. Honest-null semantics are the load-bearing behavior: a day with fewer than two present
 * subscores never gets a synthesized score.
 */
@Transactional
@ActiveProfiles("companion-fake")
class DayScoreServiceIT extends AbstractIntegrationTest {

    private static final LocalDate DAY = LocalDate.of(2026, 6, 20);

    @Autowired private DayScoreService dayScoreService;
    @Autowired private FuelDayService fuelDayService;
    @Autowired private UserPopulator userPopulator;
    @Autowired private SleepLogPopulator sleepLogPopulator;
    @Autowired private CheckInPopulator checkInPopulator;
    @Autowired private TrainPopulator trainPopulator;
    @Autowired private PantryItemPopulator pantryItemPopulator;
    @Autowired private MealRepository mealRepository;

    /**
     * A pantry-arm meal on {@code date} whose consumed kcal/protein land EXACTLY at
     * {@code kcalFactor * target} / {@code proteinFactor * target} — snapshotPer=amount=1 makes
     * MealMapper's {@code factor = amount / snapshotPer} exactly 1, so the snapshot values ARE the
     * line's contribution (no rounding noise from an intermediate serving-size ratio).
     */
    private void seedMeal(UUID owner, LocalDate date, double kcalFactor, double proteinFactor) {
        MacroSet targets = fuelDayService.getDay(owner, date).getTargets();
        PantryItemEntity item = pantryItemPopulator.createFood(owner, "test-food-" + UUID.randomUUID(), null);

        MealEntity meal = new MealEntity();
        meal.setCreatedBy(owner);
        meal.setLoggedAt(date.atStartOfDay(ZoneOffset.UTC).toInstant().plusSeconds(3600));
        meal.setMealDate(date);
        meal.setSlot("lunch");
        meal.setTitle("Weekly review fixture");

        MealItemEntity line = new MealItemEntity();
        line.setMeal(meal);
        line.setCreatedBy(owner);
        line.setLineOrder(0);
        line.setSource("pantry");
        line.setPantryItemId(item.getId());
        line.setAmount(BigDecimal.ONE);
        line.setUnit("g");
        line.setSnapshotName(item.getName());
        line.setSnapshotPer(BigDecimal.ONE);
        line.setSnapshotBasisUnit("g");
        line.setSnapshotKcal(BigDecimal.valueOf(targets.getKcal().doubleValue() * kcalFactor));
        line.setSnapshotProteinG(BigDecimal.valueOf(targets.getP().doubleValue() * proteinFactor));
        line.setSnapshotCarbsG(BigDecimal.ZERO);
        line.setSnapshotFatG(BigDecimal.ZERO);
        line.setSnapshotNova((short) 1);
        meal.getItems().add(line);
        mealRepository.saveAndFlush(meal);
    }

    private DayScoreService.DayScore dayFor(UUID owner, LocalDate date) {
        List<DayScoreService.DayScore> scores = dayScoreService.scores(owner, date, date);
        assertThat(scores).hasSize(1);
        assertThat(scores.get(0).date()).isEqualTo(date);
        return scores.get(0);
    }

    @Test
    void fullDayScoresAllFourSubscores() {
        UUID owner = userPopulator.createUser().getId();
        // sleep: 8h at quality 10/10 (the FE dial is 1-10, not 1-5) hits the 8.0h default target
        // exactly and the top of the quality dial -> d=1, quality-term=1 -> subscore 1.0.
        sleepLogPopulator.createSleepLog(owner, DAY, new BigDecimal("8.0"), 10);
        // fuel: kcal and protein both exactly at target -> closeness/ratio both 1.0 -> subscore 1.0.
        seedMeal(owner, DAY, 1.0, 1.0);
        // checkin: all four canonical slots, energy 10/10 throughout -> count-term and
        // energy-term both 1.0 -> subscore 1.0.
        checkInPopulator.createCheckIn(owner, DAY, "08:00", 10, 5, null);
        checkInPopulator.createCheckIn(owner, DAY, "12:00", 10, 5, null);
        checkInPopulator.createCheckIn(owner, DAY, "16:00", 10, 5, null);
        checkInPopulator.createCheckIn(owner, DAY, "20:00", 10, 5, null);
        // activity: a logged workout alone maxes the subscore regardless of xp.
        trainPopulator.createSportSession(owner, DAY);

        DayScoreService.DayScore day = dayFor(owner, DAY);

        assertThat(day.subscores().sleep()).isEqualTo(100);
        assertThat(day.subscores().fuel()).isEqualTo(100);
        assertThat(day.subscores().checkin()).isEqualTo(100);
        assertThat(day.subscores().activity()).isEqualTo(100);
        assertThat(day.score()).isEqualTo(100);
    }

    @Test
    void sparseDayWithOneDomainIsHonestNull() {
        UUID owner = userPopulator.createUser().getId();
        sleepLogPopulator.createSleepLog(owner, DAY, new BigDecimal("8.0"), 10);

        DayScoreService.DayScore day = dayFor(owner, DAY);

        assertThat(day.subscores().sleep()).isNotNull();
        assertThat(day.subscores().fuel()).isNull();
        assertThat(day.subscores().checkin()).isNull();
        assertThat(day.subscores().activity()).isNull();
        assertThat(day.score()).isNull();
    }

    @Test
    void emptyDayYieldsNullEverything() {
        UUID owner = userPopulator.createUser().getId();

        DayScoreService.DayScore day = dayFor(owner, DAY);

        assertThat(day.subscores().sleep()).isNull();
        assertThat(day.subscores().fuel()).isNull();
        assertThat(day.subscores().checkin()).isNull();
        assertThat(day.subscores().activity()).isNull();
        assertThat(day.score()).isNull();
    }

    @Test
    void kcalOutsideBandScoresZeroFuelCloseness() {
        UUID owner = userPopulator.createUser().getId();
        // 2x kcal target, way outside the default 0.25 band -> closeness floors at 0; no protein
        // logged (factor 0) -> the protein-ratio half is also 0 -> fuel subscore == 0, not null
        // (kcal WAS logged that day, it is just badly off-target).
        seedMeal(owner, DAY, 2.0, 0.0);
        // give the day a second present domain so the honest-null gate (>=2 subscores) does not
        // swallow the fuel value under test.
        sleepLogPopulator.createSleepLog(owner, DAY, new BigDecimal("8.0"), 10);

        DayScoreService.DayScore day = dayFor(owner, DAY);

        assertThat(day.subscores().fuel()).isEqualTo(0);
    }
}
