package io.mrkuhne.mezo.feature.goal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.tuple;

import io.mrkuhne.mezo.api.dto.GoalGap;
import io.mrkuhne.mezo.api.dto.GoalPlanLinkResponse;
import io.mrkuhne.mezo.api.dto.GoalTimelineResponse;
import io.mrkuhne.mezo.feature.goal.entity.GoalEntity;
import io.mrkuhne.mezo.feature.goal.service.GoalTimelineService;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.RunningBlockEntity;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.GoalPlanLinkPopulator;
import io.mrkuhne.mezo.support.populator.GoalPopulator;
import io.mrkuhne.mezo.support.populator.RunningPopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

/**
 * Coverage + gym-lane gap behaviour of {@link GoalTimelineService}. The goal window is 8 weeks
 * (GoalPopulator: 2026-06-01..2026-07-27). Only {@code mesocycle} links tile coverage; running
 * links are episodic and never fill a gap. Links come back ordered by {@code start_week}.
 */
@Transactional
class GoalTimelineServiceIT extends AbstractIntegrationTest {

    @Autowired private GoalTimelineService service;
    @Autowired private GoalPopulator goalPopulator;
    @Autowired private GoalPlanLinkPopulator linkPopulator;
    @Autowired private TrainPopulator trainPopulator;
    @Autowired private RunningPopulator runningPopulator;
    @Autowired private DatabasePopulator databasePopulator;

    @Test
    void testGetTimeline_shouldReportTailGap_whenMesoCoversOnlyFirstSixOfEightWeeks() {
        UUID user = databasePopulator.populateUser("timeline@test.local");
        GoalEntity goal = goalPopulator.createGoal(user, "cut", "active"); // 8-week window
        MesocycleEntity meso = trainPopulator.createMesocycle(user, "RP block", "active");
        // 6-week meso at week 1 -> covers weeks 1..6, leaving [7,8] uncovered.
        linkPopulator.createLink(user, goal.getId(), "mesocycle", meso.getId(), 1, 6);

        GoalTimelineResponse timeline = service.getTimeline(user, goal.getId());

        assertThat(timeline.getGoalId()).isEqualTo(goal.getId());
        assertThat(timeline.getWeeks()).isEqualTo(8);
        assertThat(timeline.getLinks()).hasSize(1);
        assertThat(timeline.getGaps())
            .extracting(GoalGap::getFromWeek, GoalGap::getToWeek)
            .containsExactly(tuple(7, 8));
    }

    @Test
    void testGetTimeline_shouldReportNoGaps_whenMesoTilesTheFullWindow() {
        UUID user = databasePopulator.populateUser("timeline@test.local");
        GoalEntity goal = goalPopulator.createGoal(user, "cut", "active"); // 8-week window
        MesocycleEntity meso = trainPopulator.createMesocycle(user, "full block", "active");
        // a meso spanning weeks 1..8 covers the whole window -> no gaps.
        linkPopulator.createLink(user, goal.getId(), "mesocycle", meso.getId(), 1, 8);

        GoalTimelineResponse timeline = service.getTimeline(user, goal.getId());

        assertThat(timeline.getWeeks()).isEqualTo(8);
        assertThat(timeline.getLinks()).hasSize(1);
        assertThat(timeline.getGaps()).isEmpty();
    }

    @Test
    void testGetTimeline_shouldNotFillGapWithRunningLink_whenRunningSpansUncoveredWeeks() {
        UUID user = databasePopulator.populateUser("timeline@test.local");
        GoalEntity goal = goalPopulator.createGoal(user, "cut", "active"); // 8-week window
        MesocycleEntity meso = trainPopulator.createMesocycle(user, "RP block", "active");
        RunningBlockEntity block = runningPopulator.createBlock(user, "8w base", "planned");
        // meso covers 1..6; a running block sitting on 7..8 must NOT count toward coverage.
        linkPopulator.createLink(user, goal.getId(), "mesocycle", meso.getId(), 1, 6);
        linkPopulator.createLink(user, goal.getId(), "running_block", block.getId(), 7, 8);

        GoalTimelineResponse timeline = service.getTimeline(user, goal.getId());

        assertThat(timeline.getLinks()).hasSize(2);
        // running is episodic -> the tail stays an uncovered gym gap.
        assertThat(timeline.getGaps())
            .extracting(GoalGap::getFromWeek, GoalGap::getToWeek)
            .containsExactly(tuple(7, 8));
    }

    @Test
    void testGetTimeline_shouldReturnLinksOrderedByStartWeek_whenMultipleLinks() {
        UUID user = databasePopulator.populateUser("timeline@test.local");
        GoalEntity goal = goalPopulator.createGoal(user, "cut", "active");
        MesocycleEntity meso = trainPopulator.createMesocycle(user, "second block", "active");
        RunningBlockEntity block = runningPopulator.createBlock(user, "early base", "planned");
        // insert out of order; the timeline must return them sorted by start_week (running first).
        linkPopulator.createLink(user, goal.getId(), "mesocycle", meso.getId(), 5, 8);
        linkPopulator.createLink(user, goal.getId(), "running_block", block.getId(), 1, 4);

        GoalTimelineResponse timeline = service.getTimeline(user, goal.getId());

        assertThat(timeline.getLinks())
            .extracting(GoalPlanLinkResponse::getStartWeek)
            .containsExactly(1, 5);
        // running on 1..4 does not cover; only the meso on 5..8 does -> [1,4] is an uncovered gap.
        assertThat(timeline.getGaps())
            .extracting(GoalGap::getFromWeek, GoalGap::getToWeek)
            .containsExactly(tuple(1, 4));
    }

    @Test
    void testGetTimeline_shouldRejectWithNotFound_whenGoalForeign() {
        UUID me = databasePopulator.populateUser("me@test.local");
        UUID other = databasePopulator.populateUser("other@test.local");
        GoalEntity foreignGoal = goalPopulator.createGoal(other, "cut", "active");

        assertThatThrownBy(() -> service.getTimeline(me, foreignGoal.getId()))
            .isInstanceOf(SystemRuntimeErrorException.class)
            .hasMessageContaining("RESOURCE_NOT_FOUND");
    }
}
