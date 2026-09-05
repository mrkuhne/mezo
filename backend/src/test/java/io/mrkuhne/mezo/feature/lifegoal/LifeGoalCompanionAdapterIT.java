package io.mrkuhne.mezo.feature.lifegoal;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.appnotification.repository.AppNotificationRepository;
import io.mrkuhne.mezo.feature.companion.LifeGoalSource;
import io.mrkuhne.mezo.feature.lifegoal.entity.IfThenPlanJson;
import io.mrkuhne.mezo.feature.lifegoal.entity.LifeGoalEntity;
import io.mrkuhne.mezo.feature.lifegoal.entity.PlanTriggerJson;
import io.mrkuhne.mezo.feature.lifegoal.repository.LifeGoalRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.CheckInPopulator;
import io.mrkuhne.mezo.support.populator.LifeGoalPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

/** mezo-iizd.10: a companion-port lifegoal-oldali adaptere — read-only, sosem emittál. */
@Transactional
class LifeGoalCompanionAdapterIT extends AbstractIntegrationTest {

    @Autowired private LifeGoalSource adapter;
    @Autowired private UserPopulator userPopulator;
    @Autowired private LifeGoalPopulator lifeGoalPopulator;
    @Autowired private CheckInPopulator checkInPopulator;
    @Autowired private LifeGoalRepository goalRepository;
    @Autowired private AppNotificationRepository notificationRepository;

    @Test
    void testSummary_shouldListActiveGoalsAndWeakestPillar_whenPillarDaysExist() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate today = LocalDate.now();
        LifeGoalEntity goal = lifeGoalPopulator.goal(owner, "active");
        var sleep = lifeGoalPopulator.sleepPillar(goal);
        // 3 hit-nap a héten a pillérre — van adat, tehát a leggyengébb ő (egyetlenként)
        lifeGoalPopulator.pillarDay(sleep, today.minusDays(1), "hit");
        lifeGoalPopulator.pillarDay(sleep, today.minusDays(2), "miss");
        lifeGoalPopulator.pillarDay(sleep, today.minusDays(3), "hit");

        LifeGoalSource.Summary summary = adapter.summary(owner, today);

        assertThat(summary.goals()).hasSize(1);
        assertThat(summary.goals().getFirst().title()).isEqualTo("Kockahas");
        assertThat(summary.goals().getFirst().dimension()).isEqualTo("health");
        assertThat(summary.weakestPillar()).isEqualTo("Alvás");
    }

    @Test
    void testSummary_shouldExcludeDraftAndParkedGoals_whenMixedStatuses() {
        UUID owner = userPopulator.createUser().getId();
        lifeGoalPopulator.goal(owner, "draft");
        lifeGoalPopulator.goal(owner, "parked");

        LifeGoalSource.Summary summary = adapter.summary(owner, LocalDate.now());

        assertThat(summary.goals()).isEmpty();
        assertThat(summary.weakestPillar()).isNull();
        assertThat(summary.livePlans()).isEmpty();
    }

    @Test
    void testSummary_shouldMarkPlanLive_andNeverEmit_whenEnergyTriggerMatchesToday() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate today = LocalDate.now();
        LifeGoalEntity goal = lifeGoalPopulator.goal(owner, "active");
        goal.setIfThenPlans(List.of(new IfThenPlanJson(
            "ha az energiám 4 alatt van", "akkor 10 perc séta",
            new PlanTriggerJson("checkin_energy_lte", "4", null))));
        goalRepository.saveAndFlush(goal);
        checkInPopulator.createCheckIn(owner, today, "06:30", 3, 5, null); // energia 3 ≤ 4 → él

        LifeGoalSource.Summary summary = adapter.summary(owner, today);

        assertThat(summary.livePlans()).containsExactly("ha az energiám 4 alatt van, akkor 10 perc séta");
        // a blokk KONTEXTUS: az adapter sosem emittál (a nudge a LifeGoalTriggerService-é)
        assertThat(notificationRepository.findAll()).isEmpty();
    }

    @Test
    void testDetails_shouldCarryPillarsAndPlans_whenGoalHasBoth() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate today = LocalDate.now();
        LifeGoalEntity goal = lifeGoalPopulator.goal(owner, "active");
        lifeGoalPopulator.sleepPillar(goal);
        goal.setIfThenPlans(List.of(new IfThenPlanJson(
            "ha este képernyő", "akkor olvasás", null))); // kézi terv — sosem "él" gépileg
        goalRepository.saveAndFlush(goal);

        LifeGoalSource.Details details = adapter.details(owner, today);

        assertThat(details.goals()).hasSize(1);
        LifeGoalSource.GoalDetail d = details.goals().getFirst();
        assertThat(d.title()).isEqualTo("Kockahas");
        assertThat(d.frame()).isEqualTo("intrinsic");
        assertThat(d.pillars()).singleElement().satisfies(p -> {
            assertThat(p.label()).isEqualTo("Alvás");
            assertThat(p.kind()).isEqualTo("average");
        });
        assertThat(d.plans()).singleElement().satisfies(p -> {
            assertThat(p.ha()).isEqualTo("ha este képernyő");
            assertThat(p.liveToday()).isFalse();
        });
    }
}
