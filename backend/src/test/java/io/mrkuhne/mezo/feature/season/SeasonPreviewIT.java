package io.mrkuhne.mezo.feature.season;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.biometrics.sleep.repository.SleepGoalRepository;
import io.mrkuhne.mezo.feature.goal.repository.GoalRepository;
import io.mrkuhne.mezo.feature.season.entity.SeasonDraftJson;
import io.mrkuhne.mezo.feature.season.entity.SeasonEntity;
import io.mrkuhne.mezo.feature.season.entity.SeasonNumbersJson;
import io.mrkuhne.mezo.feature.season.service.SeasonPreviewService;
import io.mrkuhne.mezo.feature.season.service.SeasonPreviewService.Preview;
import io.mrkuhne.mezo.feature.season.service.SeasonTodoRules.Todo;
import io.mrkuhne.mezo.feature.train.repository.GymScheduleSlotRepository;
import io.mrkuhne.mezo.feature.train.repository.SportScheduleSlotRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import jakarta.persistence.EntityManager;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

/** Boop B6 Évad (mezo-r36n9.16): the no-persist live preview of a season change. All numbers invented. */
@Transactional
@Import(SeasonFixture.class)
class SeasonPreviewIT extends AbstractIntegrationTest {

    @Autowired private SeasonPreviewService previewService;
    @Autowired private SeasonFixture fixture;
    @Autowired private GoalRepository goalRepository;
    @Autowired private GymScheduleSlotRepository gymRepo;
    @Autowired private SportScheduleSlotRepository sportRepo;
    @Autowired private SleepGoalRepository sleepGoalRepository;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private EntityManager em;
    @Autowired private io.mrkuhne.mezo.support.populator.GoalPopulator goalPopulator;

    @Test
    void sameDraftGivesEqualBeforeAfter() {
        UUID owner = fixture.owner("season-preview-same@test.local");
        SeasonEntity season = fixture.plannedSeason(owner, SeasonFixture.draft());

        Preview p = previewService.preview(owner, season.getId(), SeasonFixture.draft());

        assertThat(p.after()).isEqualTo(p.before());
        assertThat(p.todo()).isEmpty();
        assertThat(p.fingerprint()).hasSize(64);
        assertThat(p.after().gymPerWeek()).isEqualTo(4);
        assertThat(p.after().sportPerWeek()).isEqualTo(2);
        assertThat(p.after().restDayKcal()).isNotNull();
        assertThat(p.after().targetDate()).isEqualTo(season.getStartDate().plusWeeks(12));
        assertThat(p.after().kgPerWeek()).isNegative();
    }

    @Test
    void fifthSessionRaisesSleepNeedButNotTheTrainDayTarget() {
        UUID owner = fixture.owner("season-preview-fifth@test.local");
        SeasonEntity season = fixture.plannedSeason(owner, SeasonFixture.draft());
        SeasonDraftJson five = SeasonFixture.draft("cut", new BigDecimal("80.0"), null, List.of(0, 1, 2, 3, 4),
            SeasonFixture.SPORT);

        Preview p = previewService.preview(owner, season.getId(), five);

        assertThat(p.after().sleepNeedMin()).isEqualTo(p.before().sleepNeedMin() + 6);
        assertThat(p.before().sleepNeedMin()).isEqualTo(486);
        assertThat(p.after().bedtime()).isEqualTo("22:03");
        // The served-target model: a training day is base + one session + the goal balance — unchanged per day.
        assertThat(p.after().trainDayKcal()).isEqualTo(p.before().trainDayKcal());
        assertThat(p.after().gymPerWeek()).isEqualTo(5);
        assertThat(p.todo()).extracting(Todo::key).containsExactly("earlier_bed", "block");
    }

    @Test
    void noRestDayWhenAllDaysActive() {
        UUID owner = fixture.owner("season-preview-allweek@test.local");
        SeasonEntity season = fixture.plannedSeason(owner, SeasonFixture.draft());
        SeasonDraftJson everyDay = SeasonFixture.draft("cut", new BigDecimal("80.0"), null, List.of(0, 1, 2, 3, 4),
            List.of(new SeasonDraftJson.SportSlot(5, "10:00", 90, "volleyball"),
                new SeasonDraftJson.SportSlot(6, "10:00", 90, "volleyball")));

        Preview p = previewService.preview(owner, season.getId(), everyDay);

        assertThat(p.before().restDayKcal()).isNotNull();
        assertThat(p.after().restDayKcal()).isNull();
    }

    @Test
    void maintainSeasonHasBandNoTarget() {
        UUID owner = fixture.owner("season-preview-maintain@test.local");
        SeasonDraftJson maintain = SeasonFixture.draft("maintain", null, null, SeasonFixture.GYM, SeasonFixture.SPORT);
        SeasonEntity season = fixture.plannedSeason(owner, maintain);

        SeasonNumbersJson n = previewService.preview(owner, season.getId(), maintain).after();

        assertThat(n.bandLowKg()).isEqualByComparingTo("83.0");
        assertThat(n.bandHighKg()).isEqualByComparingTo("85.0");
        assertThat(n.targetDate()).isNull();
        assertThat(n.weeksToTarget()).isNull();
        assertThat(n.paceVerdict()).isNull();
        assertThat(n.kgPerWeek()).isNull();
    }

    @Test
    void aggressivePaceAddsWarning() {
        UUID owner = fixture.owner("season-preview-aggressive@test.local");
        SeasonEntity season = fixture.plannedSeason(owner, SeasonFixture.draft());
        SeasonDraftJson fast = SeasonFixture.draft("cut", null, new BigDecimal("1.2"), SeasonFixture.GYM,
            SeasonFixture.SPORT);

        Preview p = previewService.preview(owner, season.getId(), fast);

        assertThat(p.after().paceVerdict()).isEqualTo("aggressive");
        assertThat(p.warnings()).extracting(SeasonPreviewService.Warning::text)
            .contains("Ilyen tempónál izmot is veszítenél, nem csak zsírt.");
        assertThat(p.after().trainDayKcal()).isLessThan(p.before().trainDayKcal());
    }

    @Test
    void previewPersistsNothing() {
        UUID owner = fixture.owner("season-preview-nopersist@test.local");
        SeasonEntity season = fixture.plannedSeason(owner, SeasonFixture.draft());
        em.flush();
        String before = snapshot(owner);

        previewService.preview(owner, season.getId(), SeasonFixture.draft("cut", null, new BigDecimal("1.2"),
            List.of(0, 1, 2, 3, 4), List.of()));
        previewService.previewDraft(owner, SeasonFixture.draft("bulk", new BigDecimal("88.0"), null,
            List.of(0, 2), List.of()));
        em.flush();

        assertThat(snapshot(owner)).isEqualTo(before);
    }

    @Test
    void draftPreviewStartsFromTheLiveStateAndHasNoFingerprint() {
        UUID owner = fixture.owner("season-preview-draft@test.local");

        Preview p = previewService.previewDraft(owner, SeasonFixture.draft());

        assertThat(p.fingerprint()).isEmpty();
        assertThat(p.before().gymPerWeek()).isEqualTo(4);
        assertThat(p.after().gymPerWeek()).isEqualTo(4);
        assertThat(p.after().sleepNeedMin()).isEqualTo(486);
    }


    @Test
    void addingSportDayRaisesWeekKcal() {
        UUID owner = fixture.owner("season-preview-weekkcal-sport@test.local");
        SeasonEntity season = fixture.plannedSeason(owner, SeasonFixture.draft());
        List<SeasonDraftJson.SportSlot> withSaturday = new java.util.ArrayList<>(SeasonFixture.SPORT);
        withSaturday.add(new SeasonDraftJson.SportSlot(5, "10:00", 90, "volleyball"));

        Preview p = previewService.preview(owner, season.getId(),
            SeasonFixture.draft("cut", new BigDecimal("80.0"), null, SeasonFixture.GYM, withSaturday));

        assertThat(p.before().weekKcal()).isEqualTo(p.before().trainDayKcal() * 4 + p.before().restDayKcal() * 3);
        assertThat(p.after().weekKcal() - p.before().weekKcal())
            .isEqualTo(p.before().trainDayKcal() - p.before().restDayKcal());
    }

    @Test
    void fifthGymSessionRaisesWeekKcal() {
        UUID owner = fixture.owner("season-preview-weekkcal-gym@test.local");
        SeasonEntity season = fixture.plannedSeason(owner, SeasonFixture.draft());

        Preview p = previewService.preview(owner, season.getId(), SeasonFixture.draft("cut", new BigDecimal("80.0"),
            null, List.of(0, 1, 2, 3, 4), SeasonFixture.SPORT));

        assertThat(p.after().weekKcal()).isGreaterThan(p.before().weekKcal());
    }

    @Test
    void weekKcalIsSevenTrainingDaysWithoutARestDay() {
        UUID owner = fixture.owner("season-preview-weekkcal-allweek@test.local");
        SeasonEntity season = fixture.plannedSeason(owner, SeasonFixture.draft());

        SeasonNumbersJson n = previewService.preview(owner, season.getId(), SeasonFixture.draft("cut",
            new BigDecimal("80.0"), null, List.of(0, 1, 2, 3, 4), List.of(new SeasonDraftJson.SportSlot(5, "10:00", 90,
                "volleyball"), new SeasonDraftJson.SportSlot(6, "10:00", 90, "volleyball")))).after();

        assertThat(n.weekKcal()).isEqualTo(n.trainDayKcal() * 7);
    }

    @Test
    void seasonPastTheGoalsTargetKeepsComputingAndHolds() {
        UUID owner = fixture.owner("season-preview-pasttarget@test.local");
        // 84 → 82 at 0.4 kg/week = a 5-week goal inside a 12-week season that started 7 weeks ago.
        SeasonDraftJson shortGoal = new SeasonDraftJson("Őszi évad", "cut", new BigDecimal("82.0"), null,
            new BigDecimal("0.4"), java.time.LocalDate.now().minusWeeks(7), 12, SeasonFixture.GYM, "17:30",
            SeasonFixture.SPORT, new SeasonDraftJson.SleepAnchor("WAKE", "06:30"), List.of(), null);
        SeasonEntity season = fixture.plannedSeason(owner, shortGoal);
        SeasonDraftJson maintain = new SeasonDraftJson("Őszi évad", "maintain", null, null, null,
            java.time.LocalDate.now().minusWeeks(7), 12, SeasonFixture.GYM, "17:30", SeasonFixture.SPORT,
            new SeasonDraftJson.SleepAnchor("WAKE", "06:30"), List.of(), null);

        SeasonNumbersJson n = previewService.preview(owner, season.getId(), shortGoal).after();
        SeasonNumbersJson hold = previewService.compute(owner, null, maintain).numbers();

        assertThat(n.weeksToTarget()).isEqualTo(5);
        // Past the target the goal holds: the same served targets as keeping the weight.
        assertThat(n.restDayKcal()).isEqualTo(hold.restDayKcal());
        assertThat(n.trainDayKcal()).isEqualTo(hold.trainDayKcal());
    }

    @Test
    void draftPreviewWithALiveGoalPastItsTargetDateComputes() {
        UUID owner = fixture.owner("season-preview-livepast@test.local");
        goalPopulator.createGoal(owner, "cut", "active"); // 2026-06-01 → 2026-07-27, long over

        Preview p = previewService.previewDraft(owner, SeasonFixture.draft());

        assertThat(p.before().trainDayKcal()).isPositive();
    }

    /** Every row the preview could touch, as text: goals (prescription included), slots, sleep goal, seasons. */
    private String snapshot(UUID owner) {
        return String.join("\n",
            jdbc.queryForList("select id, status, prescription::text, tdee_bootstrap::text, target_date, target_weight_kg"
                + " from goal where created_by = ? order by id", owner).toString(),
            jdbc.queryForList("select id, day_of_week, time, is_deleted from gym_schedule_slot where created_by = ?"
                + " order by id", owner).toString(),
            jdbc.queryForList("select id, day_of_week, time, is_deleted from sport_schedule_slot where created_by = ?"
                + " order by id", owner).toString(),
            jdbc.queryForList("select target_minutes, anchor, anchor_time from sleep_goal where created_by = ?", owner)
                .toString(),
            jdbc.queryForList("select id, status, draft::text from season where created_by = ?", owner).toString(),
            jdbc.queryForList("select count(*) from season_revision where created_by = ?", owner).toString());
    }
}
