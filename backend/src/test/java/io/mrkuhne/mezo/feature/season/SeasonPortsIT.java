package io.mrkuhne.mezo.feature.season;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.goal.engine.service.GoalEngineService;
import io.mrkuhne.mezo.feature.goal.entity.GoalEntity;
import io.mrkuhne.mezo.feature.goal.entity.GoalPrescriptionJson;
import io.mrkuhne.mezo.feature.goal.repository.GoalRepository;
import io.mrkuhne.mezo.feature.season.entity.SeasonDraftJson;
import io.mrkuhne.mezo.feature.season.port.SeasonGoalPort;
import io.mrkuhne.mezo.feature.season.port.SeasonSleepPort;
import io.mrkuhne.mezo.feature.season.port.SeasonTrainPort;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.BiometricProfilePopulator;
import io.mrkuhne.mezo.support.populator.GoalPopulator;
import io.mrkuhne.mezo.support.populator.SleepGoalPopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import io.mrkuhne.mezo.support.populator.WeightLogPopulator;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

/** Boop B6 Évad (mezo-r36n9.16): the season's ports into goal, train and sleep write through the owning services. */
@Transactional
class SeasonPortsIT extends AbstractIntegrationTest {

    @Autowired private SeasonTrainPort trainPort;
    @Autowired private SeasonSleepPort sleepPort;
    @Autowired private SeasonGoalPort goalPort;
    @Autowired private GoalRepository goalRepository;
    @Autowired private GoalEngineService engine;
    @Autowired private GoalPopulator goalPopulator;
    @Autowired private TrainPopulator trainPopulator;
    @Autowired private WeightLogPopulator weightLogPopulator;
    @Autowired private BiometricProfilePopulator profilePopulator;
    @Autowired private SleepGoalPopulator sleepGoalPopulator;
    @Autowired private DatabasePopulator databasePopulator;

    @Test
    void replaceSlotsRecomputesGoal() {
        UUID owner = databasePopulator.populateUser("season-ports@test.local");
        profilePopulator.create(owner);
        LocalDate today = LocalDate.now();
        weightLogPopulator.createWeightLog(owner, today.minusDays(1), new BigDecimal("84.0"));
        GoalEntity goal = goalPopulator.createGoalFull(owner, today.minusWeeks(1), today.plusWeeks(7), null, null, null, null);
        for (int d : new int[] {0, 1, 3, 4}) {
            trainPopulator.createGymSlot(owner, d, "17:30");
        }
        engine.evaluate(owner, goal.getId());
        goalRepository.flush();
        int before = GoalPrescriptionJson.currentSegment(
            goalRepository.findById(goal.getId()).orElseThrow().getPrescription(), 2).kcal();

        trainPort.replaceSlots(owner, draft(List.of(0, 1, 2, 3, 4)));
        goalRepository.flush();

        int after = GoalPrescriptionJson.currentSegment(
            goalRepository.findById(goal.getId()).orElseThrow().getPrescription(), 2).kcal();
        assertThat(after).isGreaterThan(before);
        assertThat(trainPort.currentSchedule(owner).gymDays()).containsExactly(0, 1, 2, 3, 4);
        assertThat(trainPort.currentSchedule(owner).gymTime()).isEqualTo("17:30");
        assertThat(goalPort.liveActive(owner)).map(SeasonGoalPort.GoalView::id).contains(goal.getId());
    }

    @Test
    void setTargetMinutesKeepsAnchor() {
        UUID owner = databasePopulator.populateUser("season-ports-sleep@test.local");
        sleepGoalPopulator.goal(owner, 450, "WAKE", "06:30", 15);

        sleepPort.setTargetMinutes(owner, 486);

        SeasonSleepPort.SleepGoal g = sleepPort.get(owner);
        assertThat(g.targetMinutes()).isEqualTo(486);
        assertThat(g.anchor()).isEqualTo("WAKE");
        assertThat(g.anchorTime()).isEqualTo("06:30");
        assertThat(g.isSet()).isTrue();
    }

    private static SeasonDraftJson draft(List<Integer> gymDays) {
        return new SeasonDraftJson("Évad", "cut", null, null, null, LocalDate.now(), 8, gymDays, null, List.of(),
            null, List.of(), null);
    }
}
