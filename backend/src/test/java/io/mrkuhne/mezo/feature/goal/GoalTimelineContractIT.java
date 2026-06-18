package io.mrkuhne.mezo.feature.goal;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.GoalGap;
import io.mrkuhne.mezo.api.dto.GoalPlanAttachRequest;
import io.mrkuhne.mezo.api.dto.GoalPlanLinkResponse;
import io.mrkuhne.mezo.api.dto.GoalResponse;
import io.mrkuhne.mezo.api.dto.GoalTimelineResponse;
import io.mrkuhne.mezo.api.dto.GoalUpsertRequest;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;

/**
 * HTTP round-trips through the GENERATED G3 goal-timeline contract (api/openapi.yml):
 * attach a plan -> read the timeline -> detach it. The goal window is 8 weeks
 * (2026-06-01..2026-07-27); the seeded mesocycle is 6 weeks, so a week-1 attach covers
 * weeks 1..6 and leaves an uncovered gym gap at [7,8].
 *
 * <p>The mesocycle is seeded directly via {@link TrainPopulator} under the demodata owner's id
 * (the principal behind {@code ownerAuthHeaders()}) — the same cross-aggregate seeding pattern as
 * {@code WorkoutContractIT}; the goal itself is created over HTTP via {@code POST /api/goals}.
 */
class GoalTimelineContractIT extends ApiIntegrationTest {

    @Autowired private TrainPopulator trainPopulator;
    @Autowired private OwnerProperties ownerProperties;

    /** Find-or-create yields the demodata-seeded owner's id — the principal behind ownerAuthHeaders(). */
    private UUID ownerId() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    private static GoalUpsertRequest.GoalUpsertRequestBuilder goalReq() {
        return GoalUpsertRequest.builder()
            .title("Nyári cut").trajectory("cut").guards(List.of("strength", "muscle"))
            .startDate(LocalDate.of(2026, 6, 1)).targetDate(LocalDate.of(2026, 7, 27)) // 8-week window
            .startWeightKg(new BigDecimal("84.20")).targetWeightKg(new BigDecimal("80.00"))
            .rateTargetPctPerWeek(new BigDecimal("0.70")).identityFrame("Erő megtartva.");
    }

    private UUID createGoalOverHttp(HttpHeaders auth) {
        return postForBody("/api/goals", goalReq().build(), auth, HttpStatus.CREATED, GoalResponse.class)
            .getId();
    }

    @Test
    void testAttachGoalPlan_shouldReturn201WithDerivedEndWeek_whenMesocycleAttached() {
        UUID owner = ownerId();
        HttpHeaders auth = ownerAuthHeaders();
        UUID goalId = createGoalOverHttp(auth);
        MesocycleEntity meso = trainPopulator.createMesocycle(owner, "RP block", "active"); // weeks = 6

        GoalPlanAttachRequest req = new GoalPlanAttachRequest()
            .planType("mesocycle").planId(meso.getId()).startWeek(1);
        GoalPlanLinkResponse link = postForBody("/api/goals/" + goalId + "/plans", req, auth,
            HttpStatus.CREATED, GoalPlanLinkResponse.class);

        assertThat(link.getId()).isNotNull();
        assertThat(link.getPlanType()).isEqualTo(GoalPlanLinkResponse.PlanTypeEnum.MESOCYCLE);
        assertThat(link.getStartWeek()).isEqualTo(1);
        // end_week derived server-side from the plan's own weeks (1 + 6 - 1 = 6), never from the request.
        assertThat(link.getEndWeek()).isEqualTo(6);
        assertThat(link.getPlan().getTitle()).isEqualTo("RP block");
    }

    @Test
    void testTimelineRoundTrip_shouldShowLinkAndGapThenGoneAfterDetach_whenDrivenOverHttp() {
        UUID owner = ownerId();
        HttpHeaders auth = ownerAuthHeaders();
        UUID goalId = createGoalOverHttp(auth);
        MesocycleEntity meso = trainPopulator.createMesocycle(owner, "RP block", "active"); // weeks = 6

        GoalPlanAttachRequest req = new GoalPlanAttachRequest()
            .planType("mesocycle").planId(meso.getId()).startWeek(1);
        GoalPlanLinkResponse link = postForBody("/api/goals/" + goalId + "/plans", req, auth,
            HttpStatus.CREATED, GoalPlanLinkResponse.class);

        // GET timeline: the link is present and the uncovered tail [7,8] is reported as a gym gap.
        GoalTimelineResponse timeline = getForBody("/api/goals/" + goalId + "/timeline", auth,
            HttpStatus.OK, GoalTimelineResponse.class);
        assertThat(timeline.getGoalId()).isEqualTo(goalId);
        assertThat(timeline.getWeeks()).isEqualTo(8);
        assertThat(timeline.getLinks())
            .extracting(GoalPlanLinkResponse::getId)
            .containsExactly(link.getId());
        assertThat(timeline.getGaps())
            .extracting(GoalGap::getFromWeek, GoalGap::getToWeek)
            .containsExactly(org.assertj.core.groups.Tuple.tuple(7, 8));

        // DELETE the link -> 204, then the timeline shows no links and the whole window is one gap.
        deleteAndExpect("/api/goals/" + goalId + "/plans/" + link.getId(), auth, HttpStatus.NO_CONTENT);

        GoalTimelineResponse after = getForBody("/api/goals/" + goalId + "/timeline", auth,
            HttpStatus.OK, GoalTimelineResponse.class);
        assertThat(after.getLinks()).isEmpty();
        assertThat(after.getGaps())
            .extracting(GoalGap::getFromWeek, GoalGap::getToWeek)
            .containsExactly(org.assertj.core.groups.Tuple.tuple(1, 8));
    }

    @Test
    void testAttachGoalPlan_shouldReturn404_whenPlanIdUnknown() {
        ownerId();
        HttpHeaders auth = ownerAuthHeaders();
        UUID goalId = createGoalOverHttp(auth);

        GoalPlanAttachRequest req = new GoalPlanAttachRequest()
            .planType("mesocycle").planId(UUID.randomUUID()).startWeek(1);
        String body = postForBody("/api/goals/" + goalId + "/plans", req, auth,
            HttpStatus.NOT_FOUND, String.class);
        assertHasRequestError(body, "RESOURCE_NOT_FOUND");
    }

    @Test
    void testAttachGoalPlan_shouldReturn401_whenUnauthenticated() {
        postForBody("/api/goals/" + UUID.randomUUID() + "/plans",
            new GoalPlanAttachRequest().planType("mesocycle").planId(UUID.randomUUID()).startWeek(1),
            null, HttpStatus.UNAUTHORIZED, Void.class);
    }

    @Test
    void testListGoalTimeline_shouldReturn401_whenUnauthenticated() {
        getForBody("/api/goals/" + UUID.randomUUID() + "/timeline", null,
            HttpStatus.UNAUTHORIZED, Void.class);
    }
}
