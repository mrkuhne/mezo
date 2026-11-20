package io.mrkuhne.mezo.feature.season;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.api.dto.FuelDayRollup;
import io.mrkuhne.mezo.feature.meal.service.FuelDayService;
import io.mrkuhne.mezo.feature.season.port.SeasonGoalPort;
import io.mrkuhne.mezo.feature.season.port.SeasonSleepPort;
import io.mrkuhne.mezo.feature.season.service.AdherenceService;
import io.mrkuhne.mezo.feature.season.service.AdherenceService.AdherenceDay;
import io.mrkuhne.mezo.feature.season.service.AdherenceService.Result;
import io.mrkuhne.mezo.feature.season.service.SeasonDraftMath;
import io.mrkuhne.mezo.feature.season.service.SeasonService;
import io.mrkuhne.mezo.feature.train.entity.PlannedSkipEntity.Kind;
import io.mrkuhne.mezo.feature.train.entity.PlannedSkipEntity.Reason;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.MealPopulator;
import io.mrkuhne.mezo.support.populator.PlannedSkipPopulator;
import io.mrkuhne.mezo.support.populator.RecoveryPeriodPopulator;
import io.mrkuhne.mezo.support.populator.SleepLogPopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import jakarta.persistence.EntityManager;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Import;
import org.springframework.transaction.annotation.Transactional;

/** Boop B6 Évad S2 (mezo-r36n9.16): the single source of day judgement. All numbers invented. */
@Transactional
@Import(SeasonFixture.class)
class AdherenceServiceIT extends AbstractIntegrationTest {

    @Autowired private AdherenceService adherence;
    @Autowired private SeasonFixture fixture;
    @Autowired private SeasonService seasonService;
    @Autowired private SeasonGoalPort goalPort;
    @Autowired private SeasonSleepPort sleepPort;
    @Autowired private FuelDayService fuelDayService;
    @Autowired private MealPopulator mealPopulator;
    @Autowired private RecoveryPeriodPopulator recoveryPopulator;
    @Autowired private PlannedSkipPopulator skipPopulator;
    @Autowired private SleepLogPopulator sleepLogPopulator;
    @Autowired private TrainPopulator trainPopulator;
    @Autowired private EntityManager em;

    private final LocalDate today = LocalDate.now();

    @Test
    void kimeloDayIsExcused() {
        UUID owner = fixture.owner("adherence-kimelo@test.local");
        LocalDate day = today.minusDays(3);
        recoveryPopulator.ended(owner, Reason.ILLNESS, today.minusDays(4), today.minusDays(2));
        meal(owner, day, 2000);

        Result r = adherence.range(owner, day, day);

        AdherenceDay d = r.days().get(0);
        assertThat(d.excused()).isTrue();
        assertThat(d.excuse()).isEqualTo("kimelo");
        assertThat(d.judged()).isFalse();
        assertThat(d.foodInBand()).isNull();
        assertThat(d.sessionDone()).isNull();
        assertThat(r.summary().excusedDays()).isEqualTo(1);
        assertThat(r.summary().foodJudged()).isZero();
        assertThat(r.summary().sessionsPlanned()).isZero();
    }

    @Test
    void reasonedSkipNotCountedAsMissed() {
        UUID owner = fixture.owner("adherence-skip@test.local");
        LocalDate monday = lastBefore(today, 0);
        LocalDate previousMonday = monday.minusDays(7);
        skipPopulator.create(owner, monday, Kind.GYM, null, null, null, Reason.ILLNESS);

        Result skipped = adherence.range(owner, monday, monday);
        Result missed = adherence.range(owner, previousMonday, previousMonday);

        assertThat(skipped.days().get(0).excused()).isTrue();
        assertThat(skipped.days().get(0).excuse()).isEqualTo("skip");
        assertThat(skipped.days().get(0).sessionDone()).isNull();
        assertThat(skipped.summary().sessionsPlanned()).isZero();
        assertThat(skipped.summary().excusedDays()).isEqualTo(1);
        assertThat(missed.days().get(0).sessionPlanned()).isTrue();
        assertThat(missed.days().get(0).sessionDone()).isFalse();
        assertThat(missed.summary().sessionsPlanned()).isEqualTo(1);
        assertThat(missed.summary().sessionsDone()).isZero();
    }

    @Test
    void sessionDoneCountsACompletedWorkoutOrSportSession() {
        UUID owner = fixture.owner("adherence-done@test.local");
        LocalDate tuesday = lastBefore(today, 1);
        LocalDate wednesday = lastBefore(today, 2);
        trainPopulator.createSportSession(owner, tuesday);

        Result r = adherence.range(owner, tuesday, tuesday);
        Result rest = adherence.range(owner, wednesday, wednesday);

        assertThat(r.days().get(0).sessionPlanned()).isTrue();
        assertThat(r.days().get(0).sessionDone()).isTrue();
        assertThat(r.summary().sessionsDone()).isEqualTo(1);
        assertThat(rest.days().get(0).sessionPlanned()).isFalse();
        assertThat(rest.days().get(0).sessionDone()).isNull();
    }

    @Test
    void noSeasonStillJudgesFoodAgainstGoal() {
        UUID owner = fixture.owner("adherence-noseason@test.local");
        UUID goal = goalPort.createGoal(owner, SeasonDraftMath.goalFields(SeasonFixture.draft(), new BigDecimal("84.0"),
            List.of("strength", "muscle")));
        goalPort.activate(owner, goal);
        em.flush();
        LocalDate day = today.minusDays(1);
        int target = servedTarget(owner, day);
        meal(owner, day, target);

        AdherenceDay d = adherence.range(owner, day, day).days().get(0);

        assertThat(d.targetKcal()).isEqualTo(target);
        assertThat(d.kcal()).isEqualTo(target);
        assertThat(d.judged()).isTrue();
        assertThat(d.excused()).isFalse();
        assertThat(d.foodInBand()).isTrue();
    }

    @Test
    void todayIsNotJudged() {
        UUID owner = fixture.owner("adherence-today@test.local");
        meal(owner, today, 1800);

        AdherenceDay d = adherence.range(owner, today, today).days().get(0);

        assertThat(d.kcal()).isEqualTo(1800);
        assertThat(d.judged()).isFalse();
        assertThat(d.foodInBand()).isNull();
        assertThat(d.sessionDone()).isNull();
    }

    @Test
    void unloggedDayIsNotJudged() {
        UUID owner = fixture.owner("adherence-unlogged@test.local");
        LocalDate day = today.minusDays(2);

        AdherenceDay d = adherence.range(owner, day, day).days().get(0);

        assertThat(d.kcal()).isNull();
        assertThat(d.judged()).isFalse();
        assertThat(d.foodInBand()).isNull();
        assertThat(d.targetKcal()).isNotNull();
    }

    @Test
    void foodInBandIsTenPercent() {
        UUID owner = fixture.owner("adherence-band@test.local");
        LocalDate d1 = today.minusDays(3);
        LocalDate d2 = today.minusDays(2);
        LocalDate d3 = today.minusDays(1);
        int target = servedTarget(owner, d1);
        meal(owner, d1, (int) Math.floor(target * 1.09));
        meal(owner, d2, (int) Math.ceil(target * 1.12));
        meal(owner, d3, (int) Math.ceil(target * 0.91));

        Result r = adherence.range(owner, d1, d3);

        assertThat(r.days()).extracting(AdherenceDay::foodInBand).containsExactly(true, false, true);
        assertThat(r.summary().foodJudged()).isEqualTo(3);
        assertThat(r.summary().foodInBand()).isEqualTo(2);
    }

    @Test
    void sleepOkUsesSeasonNeed() {
        UUID owner = fixture.owner("adherence-sleep@test.local");
        seasonService.activate(owner, seasonService.create(owner, SeasonFixture.draft()).getId());
        em.flush();
        sleepPort.setTargetMinutes(owner, 420);
        em.flush();
        LocalDate d1 = today.minusDays(2);
        LocalDate d2 = today.minusDays(1);
        sleepLogPopulator.createSleepLog(owner, d1, new BigDecimal("7.90"), 3);
        sleepLogPopulator.createSleepLog(owner, d2, new BigDecimal("7.75"), 3);

        Result r = adherence.range(owner, d1, d2);

        assertThat(r.days()).extracting(AdherenceDay::needMin).containsExactly(486, 486);
        assertThat(r.days()).extracting(AdherenceDay::sleepMin).containsExactly(474, 465);
        assertThat(r.days()).extracting(AdherenceDay::sleepOk).containsExactly(true, false);
        assertThat(r.summary().nightsJudged()).isEqualTo(2);
        assertThat(r.summary().nightsOk()).isEqualTo(1);
    }

    @Test
    void rangeIsValidated() {
        UUID owner = fixture.owner("adherence-range@test.local");

        assertThatThrownBy(() -> adherence.range(owner, today, today.minusDays(1)))
            .hasMessage("VALIDATION_INVALID_VALUE");
        assertThatThrownBy(() -> adherence.range(owner, today.minusDays(62), today))
            .hasMessage("VALIDATION_INVALID_VALUE");
        assertThat(adherence.range(owner, today.minusDays(61), today).days()).hasSize(62);
    }

    @Test
    void lastWeekIsEmptyWhenNothingCouldBeJudged() {
        UUID owner = fixture.owner("adherence-empty@test.local");
        em.createNativeQuery("update gym_schedule_slot set is_deleted = true where created_by = :o")
            .setParameter("o", owner).executeUpdate();
        em.createNativeQuery("update sport_schedule_slot set is_deleted = true where created_by = :o")
            .setParameter("o", owner).executeUpdate();
        em.clear();

        assertThat(adherence.lastWeek(owner, today)).isEmpty();

        meal(owner, today.minusDays(1), 2000);
        assertThat(adherence.lastWeek(owner, today)).hasValueSatisfying(s -> {
            assertThat(s.foodJudged()).isEqualTo(1);
            assertThat(s.sessionsPlanned()).isZero();
        });
    }

    private int servedTarget(UUID owner, LocalDate day) {
        FuelDayRollup r = fuelDayService.getWeek(owner, day).getDays().get(0);
        return r.getTargets().getKcal().intValue();
    }

    private void meal(UUID owner, LocalDate day, int kcal) {
        mealPopulator.createMealWithItems(owner, day, "dinner", List.of(
            new MealPopulator.Line("Adherence teszt " + day + " " + kcal, Integer.toString(kcal), "40", "100", "30",
                (short) 1)));
    }

    /** The most recent date strictly before {@code day} on weekday {@code dow} (0 = hétfő). */
    private static LocalDate lastBefore(LocalDate day, int dow) {
        LocalDate d = day.minusDays(1);
        while (d.getDayOfWeek().getValue() - 1 != dow) {
            d = d.minusDays(1);
        }
        return d;
    }
}
