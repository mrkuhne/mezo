package io.mrkuhne.mezo.feature.season;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.SeasonMapLink;
import io.mrkuhne.mezo.api.dto.SeasonOverview;
import io.mrkuhne.mezo.feature.season.entity.SeasonDraftJson;
import io.mrkuhne.mezo.feature.season.entity.SeasonEntity;
import io.mrkuhne.mezo.feature.season.service.SeasonInsights;
import io.mrkuhne.mezo.feature.season.service.SeasonInsights.Insight;
import io.mrkuhne.mezo.feature.season.service.SeasonOverviewService;
import io.mrkuhne.mezo.feature.season.service.SeasonService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.MealPopulator;
import io.mrkuhne.mezo.support.populator.SleepLogPopulator;
import jakarta.persistence.EntityManager;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Import;
import org.springframework.transaction.annotation.Transactional;

/** Boop B6 Évad S2 (mezo-r36n9.16): „Amit Boop észrevett" — each insight only past its gate. All numbers invented. */
@Transactional
@Import(SeasonFixture.class)
class SeasonInsightsIT extends AbstractIntegrationTest {

    private static final String LEARNED = "learned_expenditure";
    private static final String SHORT_NIGHT = "short_night_intake";
    private static final String GUARD = "guard";

    @Autowired private SeasonInsights insights;
    @Autowired private SeasonOverviewService overviewService;
    @Autowired private SeasonService seasonService;
    @Autowired private SeasonFixture fixture;
    @Autowired private MealPopulator mealPopulator;
    @Autowired private SleepLogPopulator sleepLogPopulator;
    @Autowired private EntityManager em;

    private final LocalDate today = LocalDate.now();

    @Test
    void noLearnedInsightBeforeLearning() {
        UUID owner = fixture.owner("insights-learned@test.local");
        SeasonEntity season = activate(owner, SeasonFixture.draft());

        assertThat(keys(insights.insights(owner))).doesNotContain(LEARNED);

        learned(season, 30);
        assertThat(keys(insights.insights(owner))).as("under 50 kcal is not worth saying").doesNotContain(LEARNED);

        learned(season, 120);
        Insight i = insights.insights(owner).stream().filter(x -> LEARNED.equals(x.key())).findFirst().orElseThrow();
        assertThat(i.title()).isEqualTo("Kevesebbet égetsz, mint gondoltuk");
        assertThat(i.body()).matches("A terv napi \\d \\d{2}0 kcal-lal számolt, de a mérleged és az étkezéseid alapján"
            + " inkább \\d \\d{2}0 kcal körül égetsz\\.");

        learned(season, -120);
        assertThat(insights.insights(owner)).filteredOn(x -> LEARNED.equals(x.key()))
            .extracting(Insight::title).containsExactly("Többet égetsz, mint gondoltuk");
    }

    @Test
    void shortNightInsightNeedsEffect() {
        UUID owner = fixture.owner("insights-sleep@test.local");
        activate(owner, SeasonFixture.draft());
        for (int d = 1; d <= 10; d++) {
            night(owner, today.minusDays(d), "8.00", 2200);
        }
        for (int d = 11; d <= 14; d++) {
            night(owner, today.minusDays(d), "6.00", 2600);
        }

        assertThat(keys(insights.insights(owner))).as("four short nights are below the gate").doesNotContain(SHORT_NIGHT);
        assertThat(sleepFood(overviewService.overview(owner))).isNull();

        night(owner, today.minusDays(15), "6.00", 2600);
        night(owner, today.minusDays(16), "6.50", 2600);

        Insight i = insights.insights(owner).stream().filter(x -> SHORT_NIGHT.equals(x.key())).findFirst().orElseThrow();
        assertThat(i.title()).isEqualTo("Rossz alvás után többet eszel");
        assertThat(i.body()).startsWith("Ha 7 óránál kevesebbet alszol, másnap átlagosan 400 kcal-lal többet eszel.");
        assertThat(sleepFood(overviewService.overview(owner))).isEqualByComparingTo("400");
    }

    @Test
    void noShortNightInsightWithoutADifference() {
        UUID owner = fixture.owner("insights-sleep-flat@test.local");
        activate(owner, SeasonFixture.draft());
        for (int d = 1; d <= 10; d++) {
            night(owner, today.minusDays(d), "8.00", 2300);
        }
        for (int d = 11; d <= 16; d++) {
            night(owner, today.minusDays(d), "6.00", 2300);
        }

        assertThat(keys(insights.insights(owner))).doesNotContain(SHORT_NIGHT);
    }

    @Test
    void atMostThree() {
        UUID owner = fixture.owner("insights-three@test.local");
        SeasonEntity season = activate(owner, SeasonFixture.draft("cut", null, new BigDecimal("1.2"), SeasonFixture.GYM,
            SeasonFixture.SPORT));
        learned(season, 150);
        for (int d = 1; d <= 10; d++) {
            night(owner, today.minusDays(d), "8.00", 2200);
        }
        for (int d = 11; d <= 16; d++) {
            night(owner, today.minusDays(d), "6.00", 2600);
        }

        List<Insight> all = insights.insights(owner);
        SeasonOverview o = overviewService.overview(owner);

        assertThat(all).hasSizeLessThanOrEqualTo(3);
        assertThat(keys(all)).containsExactly(LEARNED, SHORT_NIGHT, GUARD);
        Insight guard = all.get(2);
        assertThat(guard.title()).isEqualTo("Erre figyelek");
        assertThat(guard.body()).contains("Ilyen tempónál izmot is veszítenél, nem csak zsírt.");
        assertThat(o.getInsights()).extracting(x -> x.getKey()).containsExactly(LEARNED, SHORT_NIGHT, GUARD);
    }

    @Test
    void noInsightsWithoutAnActiveSeason() {
        UUID owner = fixture.owner("insights-none@test.local");

        assertThat(insights.insights(owner)).isEmpty();
    }

    private SeasonEntity activate(UUID owner, SeasonDraftJson d) {
        SeasonEntity s = seasonService.activate(owner, seasonService.create(owner, d).getId());
        em.flush();
        return s;
    }

    /** The engine's bootstrap as if it had learned a base {@code formulaMinusLearned} kcal under the formula. */
    private void learned(SeasonEntity season, int formulaMinusLearned) {
        em.flush();
        em.createNativeQuery("""
                update goal set tdee_bootstrap = tdee_bootstrap || jsonb_build_object('baseSource', 'learned',
                  'formulaNeatBaselineKcal', (tdee_bootstrap->>'neatBaselineKcal')::numeric + :delta)
                where id = :id""")
            .setParameter("delta", formulaMinusLearned).setParameter("id", season.getGoalId()).executeUpdate();
        em.clear();
    }

    /** The night ending on {@code day} and that day's intake. */
    private void night(UUID owner, LocalDate day, String hours, int kcal) {
        sleepLogPopulator.createSleepLog(owner, day, new BigDecimal(hours), 3);
        mealPopulator.createMealWithItems(owner, day, "dinner", List.of(
            new MealPopulator.Line("Insight teszt " + day + " " + kcal, Integer.toString(kcal), "40", "100", "30",
                (short) 1)));
    }

    private static List<String> keys(List<Insight> all) {
        return all.stream().map(Insight::key).toList();
    }

    private static BigDecimal sleepFood(SeasonOverview o) {
        return o.getMap().getLinks().stream().filter(l -> l.getKey() == SeasonMapLink.KeyEnum.SLEEP_FOOD).findFirst()
            .orElseThrow().getValue();
    }
}
