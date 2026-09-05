package io.mrkuhne.mezo.feature.lifegoal;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.LifeGoalDimension;
import io.mrkuhne.mezo.api.dto.LifeGoalPillarInput;
import io.mrkuhne.mezo.api.dto.LifeGoalResponse;
import io.mrkuhne.mezo.api.dto.LifeGoalStatus;
import io.mrkuhne.mezo.api.dto.LifeGoalStatusRequest;
import io.mrkuhne.mezo.api.dto.LifeGoalUpsertRequest;
import io.mrkuhne.mezo.api.dto.PillarKind;
import io.mrkuhne.mezo.api.dto.PillarRule;
import io.mrkuhne.mezo.api.dto.PillarSource;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

class LifeGoalApiIT extends ApiIntegrationTest {

    static LifeGoalPillarInput sleepPillar() {
        return LifeGoalPillarInput.builder().label("Alvás").skillKey("recovery").kind(PillarKind.AVERAGE)
            .source(PillarSource.builder().type(PillarSource.TypeEnum.METRIC).key("SLEEP_DURATION_H").build())
            .rule(PillarRule.builder().threshold(new BigDecimal("7.0")).comparator(PillarRule.ComparatorEnum.GTE).windowDays(7).build())
            .build();
    }

    static LifeGoalUpsertRequest kockahas(List<LifeGoalPillarInput> pillars) {
        return LifeGoalUpsertRequest.builder().title("Kockahas").whyText("Erős, egészséges test.")
            .dimension(LifeGoalDimension.HEALTH).startDate(LocalDate.of(2026, 8, 10))
            .targetDate(LocalDate.of(2026, 11, 30)).pillars(pillars).build();
    }

    @Test
    void testCreateLifeGoal_shouldReturnDraftWithPillars_whenValid() {
        LifeGoalResponse res = postForBody("/api/life-goals", kockahas(List.of(sleepPillar())),
            ownerAuthHeaders(), HttpStatus.CREATED, LifeGoalResponse.class);
        assertThat(res.getStatus()).isEqualTo(LifeGoalStatus.DRAFT);
        assertThat(res.getPillars()).hasSize(1);
        assertThat(res.getPillars().get(0).getSource().getKey()).isEqualTo("SLEEP_DURATION_H");
        assertThat(getForList("/api/life-goals", ownerAuthHeaders(), HttpStatus.OK, LifeGoalResponse.class)).hasSize(1);
    }

    @Test
    void testChangeStatus_shouldActivateThenParkThenReactivate_whenTransitionsLegal() {
        LifeGoalResponse g = postForBody("/api/life-goals", kockahas(List.of(sleepPillar())),
            ownerAuthHeaders(), HttpStatus.CREATED, LifeGoalResponse.class);
        LifeGoalResponse active = postForBody("/api/life-goals/" + g.getId() + "/status",
            LifeGoalStatusRequest.builder().status(LifeGoalStatus.ACTIVE).build(), ownerAuthHeaders(), HttpStatus.OK, LifeGoalResponse.class);
        assertThat(active.getStatus()).isEqualTo(LifeGoalStatus.ACTIVE);
        assertThat(active.getActivatedAt()).isNotNull();
        LifeGoalResponse parked = postForBody("/api/life-goals/" + g.getId() + "/status",
            LifeGoalStatusRequest.builder().status(LifeGoalStatus.PARKED).build(), ownerAuthHeaders(), HttpStatus.OK, LifeGoalResponse.class);
        assertThat(parked.getStatus()).isEqualTo(LifeGoalStatus.PARKED);
        LifeGoalResponse again = postForBody("/api/life-goals/" + g.getId() + "/status",
            LifeGoalStatusRequest.builder().status(LifeGoalStatus.ACTIVE).build(), ownerAuthHeaders(), HttpStatus.OK, LifeGoalResponse.class);
        assertThat(again.getStatus()).isEqualTo(LifeGoalStatus.ACTIVE);
    }

    @Test
    void testChangeStatus_shouldBeIdempotentNoOp_whenTargetEqualsCurrentStatus() {
        LifeGoalResponse g = postForBody("/api/life-goals", kockahas(List.of(sleepPillar())),
            ownerAuthHeaders(), HttpStatus.CREATED, LifeGoalResponse.class);
        LifeGoalResponse active = postForBody("/api/life-goals/" + g.getId() + "/status",
            LifeGoalStatusRequest.builder().status(LifeGoalStatus.ACTIVE).build(), ownerAuthHeaders(), HttpStatus.OK, LifeGoalResponse.class);
        assertThat(active.getStatus()).isEqualTo(LifeGoalStatus.ACTIVE);

        LifeGoalResponse again = postForBody("/api/life-goals/" + g.getId() + "/status",
            LifeGoalStatusRequest.builder().status(LifeGoalStatus.ACTIVE).build(), ownerAuthHeaders(), HttpStatus.OK, LifeGoalResponse.class);

        assertThat(again.getStatus()).isEqualTo(LifeGoalStatus.ACTIVE);
        assertThat(again.getActivatedAt()).isEqualTo(active.getActivatedAt());
    }

    @Test
    void testChangeStatus_shouldKeepCompletionDate_whenArchivingADoneGoal() {
        LifeGoalResponse g = postForBody("/api/life-goals", kockahas(List.of(sleepPillar())),
            ownerAuthHeaders(), HttpStatus.CREATED, LifeGoalResponse.class);
        postForBody("/api/life-goals/" + g.getId() + "/status",
            LifeGoalStatusRequest.builder().status(LifeGoalStatus.ACTIVE).build(), ownerAuthHeaders(), HttpStatus.OK, LifeGoalResponse.class);
        LifeGoalResponse done = postForBody("/api/life-goals/" + g.getId() + "/status",
            LifeGoalStatusRequest.builder().status(LifeGoalStatus.DONE).build(), ownerAuthHeaders(), HttpStatus.OK, LifeGoalResponse.class);
        assertThat(done.getClosedAt()).isNotNull();

        LifeGoalResponse archived = postForBody("/api/life-goals/" + g.getId() + "/status",
            LifeGoalStatusRequest.builder().status(LifeGoalStatus.ARCHIVED).build(), ownerAuthHeaders(), HttpStatus.OK, LifeGoalResponse.class);

        assertThat(archived.getStatus()).isEqualTo(LifeGoalStatus.ARCHIVED);
        assertThat(archived.getClosedAt()).isEqualTo(done.getClosedAt());
    }

    @Test
    void testChangeStatus_shouldAllowFourActiveGoals_whenNoCap() {
        for (int i = 0; i < 4; i++) {
            LifeGoalResponse g = postForBody("/api/life-goals", kockahas(List.of(sleepPillar())),
                ownerAuthHeaders(), HttpStatus.CREATED, LifeGoalResponse.class);
            postForBody("/api/life-goals/" + g.getId() + "/status",
                LifeGoalStatusRequest.builder().status(LifeGoalStatus.ACTIVE).build(), ownerAuthHeaders(), HttpStatus.OK, LifeGoalResponse.class);
        }
        List<LifeGoalResponse> all = getForList("/api/life-goals", ownerAuthHeaders(), HttpStatus.OK, LifeGoalResponse.class);
        assertThat(all).extracting(LifeGoalResponse::getStatus).containsOnly(LifeGoalStatus.ACTIVE);
        assertThat(all).hasSize(4);
    }

    @Test
    void testChangeStatus_shouldReturn409_whenReopeningDoneGoal() {
        LifeGoalResponse g = postForBody("/api/life-goals", kockahas(List.of(sleepPillar())),
            ownerAuthHeaders(), HttpStatus.CREATED, LifeGoalResponse.class);
        postForBody("/api/life-goals/" + g.getId() + "/status",
            LifeGoalStatusRequest.builder().status(LifeGoalStatus.ACTIVE).build(), ownerAuthHeaders(), HttpStatus.OK, LifeGoalResponse.class);
        postForBody("/api/life-goals/" + g.getId() + "/status",
            LifeGoalStatusRequest.builder().status(LifeGoalStatus.DONE).build(), ownerAuthHeaders(), HttpStatus.OK, LifeGoalResponse.class);
        ResponseEntity<String> res = exchangeForResponse(HttpMethod.POST,
            "/api/life-goals/" + g.getId() + "/status",
            LifeGoalStatusRequest.builder().status(LifeGoalStatus.ACTIVE).build(), ownerAuthHeaders());
        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertHasRequestError(res.getBody(), "LIFE_GOAL_INVALID_STATUS_TRANSITION");
    }

    @Test
    void testCreateLifeGoal_shouldReturn400_whenPillarSourceUnknown() {
        LifeGoalPillarInput bad = LifeGoalPillarInput.builder().label("X").skillKey("recovery").kind(PillarKind.AVERAGE)
            .source(PillarSource.builder().type(PillarSource.TypeEnum.METRIC).key("NOT_A_METRIC").build()).build();
        ResponseEntity<String> res = exchangeForResponse(HttpMethod.POST, "/api/life-goals",
            kockahas(List.of(bad)), ownerAuthHeaders());
        assertThat(res.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertHasFieldError(res.getBody(), "pillars", "LIFE_GOAL_UNKNOWN_SIGNAL");
    }

    @Test
    void testGetLifeGoal_shouldReturn404_whenNotOwned() {
        getForBody("/api/life-goals/00000000-0000-0000-0000-000000000001", ownerAuthHeaders(), HttpStatus.NOT_FOUND, String.class);
    }
}
