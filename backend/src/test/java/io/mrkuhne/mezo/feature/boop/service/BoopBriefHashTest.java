package io.mrkuhne.mezo.feature.boop.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.boop.port.BoopCapacityPort;
import java.time.LocalTime;
import java.util.List;
import org.junit.jupiter.api.Test;

/** Boop B7 K1 final fix (mezo-r36n9.17): what of the capacity block re-generates the brief. */
class BoopBriefHashTest {

    private static final LocalTime MORNING = LocalTime.of(8, 30);

    private static BoopCapacityPort.View view(double ratio, List<BoopCapacityPort.Factor> factors) {
        return new BoopCapacityPort.View("rendben", ratio, true, 0, true, 4.0, new double[19], List.of(), factors, "");
    }

    private static String hash(BoopCapacityPort.View v) {
        return BoopBriefService.inputHash(BoopBriefFixtures.day(null, null, List.of()), MORNING, v);
    }

    @Test
    void ratioChangesTheHashInFivePercentSteps() {
        List<BoopCapacityPort.Factor> none = List.of();
        assertThat(hash(view(0.80, none))).isNotEqualTo(hash(view(0.86, none)));
        assertThat(hash(view(0.80, none))).isEqualTo(hash(view(0.81, none)));
    }

    @Test
    void factorKeysAndEffectsChangeTheHash() {
        var sleepBad = new BoopCapacityPort.Factor("sleep", "Alvás", "6 ó", "rossz");
        var sleepOk = new BoopCapacityPort.Factor("sleep", "Alvás", "6 ó", "semleges");
        var hrvBad = new BoopCapacityPort.Factor("hrv", "HRV", "40 ms", "rossz");
        assertThat(hash(view(0.8, List.of(sleepBad)))).isNotEqualTo(hash(view(0.8, List.of(sleepOk))));
        assertThat(hash(view(0.8, List.of(sleepBad)))).isNotEqualTo(hash(view(0.8, List.of(hrvBad))));
        assertThat(hash(view(0.8, List.of(sleepBad)))).isNotEqualTo(hash(view(0.8, List.of())));
    }

    @Test
    void anEventLabelChangesTheHashEvenWhenUnitsRoundTheSame() {
        var drains = new BoopCapacityPort.Item("Tervezés", "meeting", java.time.Instant.parse("2026-11-23T08:00:00Z"),
            "kozepes", "cal-1", "drains");
        var feeds = new BoopCapacityPort.Item("Tervezés", "meeting", java.time.Instant.parse("2026-11-23T08:00:00Z"),
            "tolt", "cal-1", "feeds");
        var a = new BoopCapacityPort.View("rendben", 0.8, true, 0, true, 4.0, new double[19], List.of(drains),
            List.of(), "");
        var b = new BoopCapacityPort.View("rendben", 0.8, true, 0, true, 4.0, new double[19], List.of(feeds),
            List.of(), "");
        assertThat(hash(a)).isNotEqualTo(hash(b));
    }

    @Test
    void aLabelThatKeepsTheLevelStillChangesTheHash() {
        // a small item labelled "neutral" stays "kicsi": the stored brief must still learn the label (its row shows it)
        var unlabelled = new BoopCapacityPort.Item("Hívás", "call", java.time.Instant.parse("2026-11-23T08:00:00Z"),
            "kicsi", "cal-2", null);
        var neutral = new BoopCapacityPort.Item("Hívás", "call", java.time.Instant.parse("2026-11-23T08:00:00Z"),
            "kicsi", "cal-2", "neutral");
        var a = new BoopCapacityPort.View("rendben", 0.8, true, 0, true, 4.0, new double[19], List.of(unlabelled),
            List.of(), "");
        var b = new BoopCapacityPort.View("rendben", 0.8, true, 0, true, 4.0, new double[19], List.of(neutral),
            List.of(), "");
        assertThat(hash(a)).isNotEqualTo(hash(b));
    }

    // ── K3 final review finding 2: every brief field an accepted day adjustment can change re-generates the brief ──

    private static BoopDay with(LocalTime bedtimeTarget, BoopDay.Session session, List<BoopDay.Meal> meals) {
        BoopDay d = BoopBriefFixtures.day(null, null, List.of(), meals);
        return new BoopDay(d.date(), d.sleep(), d.sleepTargetMin(), bedtimeTarget, d.nightsKnown(), d.deepSleepWeek(),
            d.restingHrWeek(), d.baselineRestingHr(), d.baselineDeepMin(), d.restingHr(), d.hrToday(), d.steps(),
            d.activeKcal(), session, d.yesterdayLoad(), d.meals(), d.kcalSoFar(), d.kcalTarget(), d.proteinG(),
            d.proteinTarget(), d.carbsG(), d.fatG(), d.checkins(), d.intention(), d.observations(), d.calendar(),
            d.weight(), d.recovery(), d.seasonRules());
    }

    private static BoopDay.Session session(LocalTime time, Integer minutes, int sets) {
        return new BoopDay.Session("Pull 1", time, LocalTime.of(17, 30), minutes,
            List.of(new BoopDay.Exercise("Evezés", sets)));
    }

    private static List<BoopDay.Meal> meals(int lunchKcal, int dinnerKcal) {
        return List.of(new BoopDay.Meal(LocalTime.of(12, 30), "Ebéd", "lunch", lunchKcal, 40, false),
            new BoopDay.Meal(LocalTime.of(19, 0), "Vacsora", "dinner", dinnerKcal, 40, false));
    }

    private static String hash(BoopDay d) {
        return BoopBriefService.inputHash(d, MORNING, null);
    }

    @Test
    void everyLedgerChangeableFieldChangesTheHash() {
        LocalTime bed = LocalTime.of(22, 30);
        BoopDay base = with(bed, session(LocalTime.of(17, 30), 60, 3), meals(600, 700));

        // SHIFT_BEDTIME
        assertThat(hash(with(LocalTime.of(22, 0), base.session(), base.meals()))).isNotEqualTo(hash(base));
        // SHIFT_SESSION_TIME
        assertThat(hash(with(bed, session(LocalTime.of(18, 15), 60, 3), base.meals()))).isNotEqualTo(hash(base));
        // SHORTEN_SESSION
        assertThat(hash(with(bed, session(LocalTime.of(17, 30), 40, 3), base.meals()))).isNotEqualTo(hash(base));
        // LIGHTEN_SESSION
        assertThat(hash(with(bed, session(LocalTime.of(17, 30), 60, 2), base.meals()))).isNotEqualTo(hash(base));
        // MOVE_SESSION_DAY / SKIP_SESSION (the session leaves the day)
        assertThat(hash(with(bed, null, base.meals()))).isNotEqualTo(hash(base));
        // MOVE_MEAL_ENERGY (the day total stays, the split moves)
        assertThat(hash(with(bed, base.session(), meals(500, 800)))).isNotEqualTo(hash(base));
    }
}
