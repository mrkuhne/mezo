package io.mrkuhne.mezo.feature.biometrics.checkin;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.AdaptiveReason;
import io.mrkuhne.mezo.api.dto.CheckInItemId;
import io.mrkuhne.mezo.api.dto.CheckInPlanResponse;
import io.mrkuhne.mezo.api.dto.CheckInResponse;
import io.mrkuhne.mezo.api.dto.SaveCheckInRequest;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;

/** HTTP contract of GET /api/biometrics/checkin/plan (mezo-ck2). */
class CheckInPlanApiIT extends ApiIntegrationTest {

    private static final String PLAN = "/api/biometrics/checkin/plan?date=2026-06-15&slotTime=";

    @Test
    void testGetCheckInPlan_shouldReturn401_whenNoToken() {
        getForBody(PLAN + "06:30", null, HttpStatus.UNAUTHORIZED, Void.class);
    }

    @Test
    void testGetCheckInPlan_shouldReturnPlanShape_whenOwnerAsks() {
        HttpHeaders headers = ownerAuthHeaders();
        String json = getForBody(PLAN + "20:00", headers, HttpStatus.OK, String.class);
        assertThat(json).contains("\"id\":\"energy\"", "\"label\":\"Energia\"",
            "\"question\":\"Mennyi energia van benned most?\"", "\"low\":\"Üres\"", "\"high\":\"Tele\"",
            "\"kind\":\"SCALE\"", "\"kind\":\"PAIN\"", "\"kind\":\"CRAVING\"", "\"id\":\"day\"",
            "\"adaptive\":{", "\"why\":", "\"reason\":");

        CheckInPlanResponse plan = getForBody(PLAN + "20:00", headers, HttpStatus.OK, CheckInPlanResponse.class);
        assertThat(plan.getItems()).hasSize(11);
        assertThat(plan.getAdaptive().getId()).isIn(CheckInItemId.MOTIVATION, CheckInItemId.HUNGER);
    }

    @Test
    void testGetCheckInPlan_shouldBeStable_whenRequestedRepeatedly() {
        HttpHeaders headers = ownerAuthHeaders();
        for (String slot : new String[] {"06:30", "10:00", "14:00", "20:00"}) {
            CheckInPlanResponse a = getForBody(PLAN + slot, headers, HttpStatus.OK, CheckInPlanResponse.class);
            CheckInPlanResponse b = getForBody(PLAN + slot, headers, HttpStatus.OK, CheckInPlanResponse.class);
            assertThat(b).isEqualTo(a);
        }
    }

    @Test
    void testGetCheckInPlan_shouldReturn400_whenSlotUnknown() {
        String body = getForBody(PLAN + "09:00", ownerAuthHeaders(), HttpStatus.BAD_REQUEST, String.class);
        assertHasFieldError(body, "slotTime", "VALIDATION_INVALID_VALUE");
    }

    @Test
    void testGetCheckInPlan_shouldNotSeeOwnersSavedPick_whenOtherUserAsks() {
        HttpHeaders owner = ownerAuthHeaders();
        // "day" can never be computed for 06:30, so seeing it proves the stored row was read.
        postForBody("/api/biometrics/checkin", SaveCheckInRequest.builder()
                .date(LocalDate.parse("2026-06-15")).slotTime("06:30").state("done").energy(6)
                .adaptiveItem(CheckInItemId.DAY).adaptiveReason(AdaptiveReason.RANDOM).build(),
            owner, HttpStatus.OK, CheckInResponse.class);
        assertThat(getForBody(PLAN + "06:30", owner, HttpStatus.OK, CheckInPlanResponse.class)
            .getAdaptive().getId()).isEqualTo(CheckInItemId.DAY);

        RegisteredUser other = registerUser("Bea");
        CheckInPlanResponse otherPlan = getForBody(PLAN + "06:30", other.headers(), HttpStatus.OK,
            CheckInPlanResponse.class);
        assertThat(otherPlan.getAdaptive().getId()).isNotEqualTo(CheckInItemId.DAY);
    }
}
