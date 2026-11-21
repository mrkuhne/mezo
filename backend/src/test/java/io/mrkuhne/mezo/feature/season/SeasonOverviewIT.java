package io.mrkuhne.mezo.feature.season;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.api.dto.SeasonMapLink;
import io.mrkuhne.mezo.api.dto.SeasonMapPillar;
import io.mrkuhne.mezo.api.dto.SeasonOverview;
import io.mrkuhne.mezo.api.dto.SeasonOverviewHead;
import io.mrkuhne.mezo.api.dto.SeasonUpcoming;
import io.mrkuhne.mezo.feature.season.entity.SeasonDraftJson;
import io.mrkuhne.mezo.feature.season.service.SeasonOverviewService;
import io.mrkuhne.mezo.feature.season.service.SeasonService;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import io.mrkuhne.mezo.support.populator.WeightLogPopulator;
import jakarta.persistence.EntityManager;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Import;
import org.springframework.transaction.annotation.Transactional;

/** Boop B6 Évad (mezo-r36n9.16): the one read model the Évad tab renders. All numbers invented. */
@Transactional
@Import(SeasonFixture.class)
class SeasonOverviewIT extends AbstractIntegrationTest {

    @Autowired private SeasonOverviewService overviewService;
    @Autowired private SeasonService seasonService;
    @Autowired private SeasonFixture fixture;
    @Autowired private WeightLogPopulator weightLogPopulator;
    @Autowired private TrainPopulator trainPopulator;
    @Autowired private EntityManager em;

    @Test
    void noActiveSeasonIs404() {
        UUID owner = fixture.owner("season-overview-none@test.local");

        assertThatThrownBy(() -> overviewService.overview(owner)).hasMessage("RESOURCE_NOT_FOUND");
    }

    @Test
    void overviewForMaintainShowsBand() {
        UUID owner = fixture.owner("season-overview-maintain@test.local");
        for (int d = 2; d <= 5; d++) {
            weightLogPopulator.createWeightLog(owner, LocalDate.now().minusDays(d), new BigDecimal("84.0"));
        }
        activate(owner, SeasonFixture.draft("maintain", null, null, SeasonFixture.GYM, SeasonFixture.SPORT));

        SeasonOverview o = overviewService.overview(owner);

        assertThat(o.getHead().getTrajectory().getValue()).isEqualTo("maintain");
        assertThat(o.getHead().getStatus()).isEqualTo(SeasonOverviewHead.StatusEnum.IN_BAND);
        assertThat(o.getHead().getWeek()).isEqualTo(1);
        assertThat(o.getWeight().getBand().getLowKg()).isEqualByComparingTo("83.0");
        assertThat(o.getWeight().getBand().getHighKg()).isEqualByComparingTo("85.0");
        assertThat(o.getWeight().getTargetKg()).isNull();
        assertThat(o.getPillars().getWeight().getBand()).isNotNull();
        assertThat(o.getPillars().getWeight().getTargetKg()).isNull();
        assertThat(o.getPillars().getWeight().getTargetDate()).isNull();
        assertThat(link(o, SeasonMapLink.KeyEnum.FOOD_WEIGHT).getValue()).isNull();
        assertThat(pillar(o, SeasonMapPillar.KeyEnum.EDZES)).isEqualTo("4 edzés + 2 röpi");
        assertThat(pillar(o, SeasonMapPillar.KeyEnum.ALVAS)).isEqualTo("8 ó 6 p");
        assertThat(pillar(o, SeasonMapPillar.KeyEnum.SULY)).isEqualTo("84,0 kg");
        assertThat(pillar(o, SeasonMapPillar.KeyEnum.ETEL)).matches("\\d \\d{3} kcal");
        assertThat(o.getAdherence()).isNotNull();
        assertThat(o.getAdherence().getSessionsPlanned()).isEqualTo(4);
        assertThat(o.getAdherence().getSessionsDone()).isZero();
        assertThat(o.getAdherence().getFoodJudged()).isZero();
        assertThat(o.getInsights()).isEmpty();
        assertThat(o.getSeason().getStatus().getValue()).isEqualTo("active");
        assertThat(o.getSeason().getDraft().getGymDays()).containsExactly(0, 1, 3, 4);
        assertThat(o.getPillars().getSleep().getBaseMin()).isEqualTo(450);
        assertThat(o.getPillars().getSleep().getNeedMin()).isEqualTo(486);
        assertThat(link(o, SeasonMapLink.KeyEnum.TRAIN_SLEEP).getValue()).isEqualByComparingTo("36");
    }

    @Test
    void noRestDayLinkIsNull() {
        UUID owner = fixture.owner("season-overview-allweek@test.local");
        activate(owner, SeasonFixture.draft("cut", new BigDecimal("80.0"), null, List.of(0, 1, 2, 3, 4),
            List.of(new SeasonDraftJson.SportSlot(5, "10:00", 90, "volleyball"),
                new SeasonDraftJson.SportSlot(6, "10:00", 90, "volleyball"))));

        SeasonOverview o = overviewService.overview(owner);

        assertThat(link(o, SeasonMapLink.KeyEnum.TRAIN_FOOD).getValue()).isNull();
        assertThat(o.getPillars().getFood().getRestDayKcal()).isNull();
        assertThat(link(o, SeasonMapLink.KeyEnum.FOOD_WEIGHT).getValue()).isNegative();
        assertThat(link(o, SeasonMapLink.KeyEnum.SLEEP_FOOD).getValue()).isNull();
    }

    @Test
    void slowerWhenTrendHalfOfPlan() {
        UUID owner = fixture.owner("season-overview-slower@test.local");
        // Losing ~0.15 kg/week over three weeks, ending at the fixture's 84.0 yesterday.
        for (int d = 2; d <= 21; d++) {
            BigDecimal kg = new BigDecimal("84.0").add(new BigDecimal("0.15").multiply(BigDecimal.valueOf(d - 1))
                .divide(BigDecimal.valueOf(7), 2, RoundingMode.HALF_UP));
            weightLogPopulator.createWeightLog(owner, LocalDate.now().minusDays(d), kg);
        }
        // Planned: 84.0 → 80.8 in 8 weeks = −0.4 kg/week.
        SeasonDraftJson d = SeasonFixture.draft("cut", new BigDecimal("80.8"), null, SeasonFixture.GYM, SeasonFixture.SPORT);
        activate(owner, new SeasonDraftJson(d.title(), d.trajectory(), d.targetWeightKg(), null, null, d.startDate(), 8,
            d.gymDays(), d.gymTime(), d.sport(), d.sleepAnchor(), d.allowedRecipeIds(), null));

        SeasonOverview o = overviewService.overview(owner);

        assertThat(o.getHead().getStatus()).isEqualTo(SeasonOverviewHead.StatusEnum.SLOWER);
        assertThat(o.getWeight().getKgPerWeek()).isEqualByComparingTo("-0.40");
        assertThat(o.getWeight().getProjection()).isNotEmpty();
        assertThat(o.getWeight().getProjection().get(o.getWeight().getProjection().size() - 1).getKg())
            .isLessThan(new BigDecimal("84.0"));
    }

    @Test
    void noDataWithThreeWeighIns() {
        UUID owner = fixture.owner("season-overview-nodata@test.local");
        weightLogPopulator.createWeightLog(owner, LocalDate.now().minusDays(3), new BigDecimal("84.2"));
        weightLogPopulator.createWeightLog(owner, LocalDate.now().minusDays(6), new BigDecimal("84.4"));
        activate(owner, SeasonFixture.draft());

        assertThat(overviewService.overview(owner).getHead().getStatus())
            .isEqualTo(SeasonOverviewHead.StatusEnum.NO_DATA);
    }

    @Test
    void deloadWeekListedFromBlock() {
        UUID owner = fixture.owner("season-overview-deload@test.local");
        MesocycleEntity meso = trainPopulator.createActiveMeso(owner); // MEV, MAV, Deload
        meso.setStartDate(LocalDate.now());
        meso.setEndDate(LocalDate.now().plusWeeks(3));
        meso.setWeeks(3);
        em.flush();
        SeasonDraftJson d = SeasonFixture.draft();
        activate(owner, new SeasonDraftJson(d.title(), d.trajectory(), d.targetWeightKg(), null, null, d.startDate(),
            d.weeks(), d.gymDays(), d.gymTime(), d.sport(), d.sleepAnchor(), d.allowedRecipeIds(),
            new SeasonDraftJson.Block("adopt", meso.getId(), null)));

        SeasonOverview o = overviewService.overview(owner);

        assertThat(o.getUpcoming()).extracting(SeasonUpcoming::getWeek, u -> u.getKind().getValue(), SeasonUpcoming::getText)
            .containsExactly(
                org.assertj.core.groups.Tuple.tuple(3, "deload", "könnyebb edzéshét"),
                org.assertj.core.groups.Tuple.tuple(12, "end", "az évad vége"));
        assertThat(o.getPillars().getBlock().getTitle()).isEqualTo("P1 meso");
        assertThat(o.getPillars().getBlock().getFromWeek()).isEqualTo(1);
        assertThat(o.getPillars().getBlock().getToWeek()).isEqualTo(3);
        assertThat(o.getSeason().getMesocycleId()).isEqualTo(meso.getId());
    }


    @Test
    void projectionStopsAtTheTargetAndStaysFlat() {
        UUID owner = fixture.owner("season-overview-flat@test.local");
        // 84 → 82 at 0.4 kg/week: the target is reached in week 5 of a 12-week season.
        activate(owner, new SeasonDraftJson("Őszi évad", "cut", new BigDecimal("82.0"), null, new BigDecimal("0.4"),
            LocalDate.now(), 12, SeasonFixture.GYM, "17:30", SeasonFixture.SPORT,
            new SeasonDraftJson.SleepAnchor("WAKE", "06:30"), List.of(), null));

        SeasonOverview o = overviewService.overview(owner);

        List<java.math.BigDecimal> kg = o.getWeight().getProjection().stream().map(p -> p.getKg()).toList();
        assertThat(kg.get(kg.size() - 1)).isEqualByComparingTo("82.0");
        assertThat(kg).allSatisfy(k -> assertThat(k).isGreaterThanOrEqualTo(new BigDecimal("82.0")));
    }

    @Test
    void overviewPastTheGoalsTargetKeepsComputing() {
        UUID owner = fixture.owner("season-overview-pasttarget@test.local");
        activate(owner, new SeasonDraftJson("Őszi évad", "cut", new BigDecimal("82.0"), null, new BigDecimal("0.4"),
            LocalDate.now().minusWeeks(7), 12, SeasonFixture.GYM, "17:30", SeasonFixture.SPORT,
            new SeasonDraftJson.SleepAnchor("WAKE", "06:30"), List.of(), null));

        SeasonOverview o = overviewService.overview(owner);

        assertThat(o.getHead().getWeek()).isEqualTo(8);
        assertThat(o.getPillars().getFood().getTrainDayKcal()).isPositive();
    }

    private void activate(UUID owner, SeasonDraftJson d) {
        seasonService.activate(owner, seasonService.create(owner, d).getId());
        em.flush();
    }

    private static SeasonMapLink link(SeasonOverview o, SeasonMapLink.KeyEnum key) {
        return o.getMap().getLinks().stream().filter(l -> l.getKey() == key).findFirst().orElseThrow();
    }

    private static String pillar(SeasonOverview o, SeasonMapPillar.KeyEnum key) {
        return o.getMap().getPillars().stream().filter(p -> p.getKey() == key).findFirst().orElseThrow().getValue();
    }
}
