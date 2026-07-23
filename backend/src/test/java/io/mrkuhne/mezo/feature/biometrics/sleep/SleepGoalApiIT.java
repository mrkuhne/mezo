package io.mrkuhne.mezo.feature.biometrics.sleep;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.SetSleepGoalRequest;
import io.mrkuhne.mezo.api.dto.SleepGoalResponse;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;

/** HTTP round-trips through the generated {@code SleepGoalApi} contract (api/openapi.yml). */
class SleepGoalApiIT extends ApiIntegrationTest {

    @Test
    void testGetSleepGoal_shouldReturnConfigDefaultGhost_whenNoneSet() {
        SleepGoalResponse goal =
            getForBody("/api/sleep/goal", ownerAuthHeaders(), HttpStatus.OK, SleepGoalResponse.class);

        assertThat(goal.getTargetMinutes()).isEqualTo(480);
        assertThat(goal.getAnchor()).isEqualTo("WAKE");
        assertThat(goal.getAnchorTime()).isEqualTo("06:00");
        assertThat(goal.getWakeTime()).isEqualTo("06:00");
        assertThat(goal.getBedTime()).isEqualTo("22:00"); // 06:00 − 480 min
        assertThat(goal.getRegularityBandMin()).isEqualTo(15);
    }

    @Test
    void testSetSleepGoal_shouldDeriveBed_whenWakeAnchored() {
        HttpHeaders auth = ownerAuthHeaders();
        SetSleepGoalRequest req = SetSleepGoalRequest.builder()
            .targetMinutes(450).anchor("WAKE").anchorTime("06:45").regularityBandMin(20).build();

        SleepGoalResponse saved =
            putForBody("/api/sleep/goal", req, auth, HttpStatus.OK, SleepGoalResponse.class);

        assertThat(saved.getWakeTime()).isEqualTo("06:45");
        assertThat(saved.getBedTime()).isEqualTo("23:15"); // 06:45 − 450 min
        assertThat(saved.getRegularityBandMin()).isEqualTo(20);

        SleepGoalResponse read =
            getForBody("/api/sleep/goal", auth, HttpStatus.OK, SleepGoalResponse.class);
        assertThat(read.getBedTime()).isEqualTo("23:15");
    }

    @Test
    void testSetSleepGoal_shouldDeriveWakeAcrossMidnight_whenBedAnchored() {
        SetSleepGoalRequest req = SetSleepGoalRequest.builder()
            .targetMinutes(480).anchor("BED").anchorTime("00:30").build();

        SleepGoalResponse saved =
            putForBody("/api/sleep/goal", req, ownerAuthHeaders(), HttpStatus.OK, SleepGoalResponse.class);

        assertThat(saved.getBedTime()).isEqualTo("00:30");
        assertThat(saved.getWakeTime()).isEqualTo("08:30"); // 00:30 + 480 min
        assertThat(saved.getRegularityBandMin()).isEqualTo(15); // band omitted -> config default
    }

    @Test
    void testSetSleepGoal_shouldUpdateSingleRow_whenUpsertedTwice() {
        HttpHeaders auth = ownerAuthHeaders();
        putForBody("/api/sleep/goal",
            SetSleepGoalRequest.builder().targetMinutes(450).anchor("WAKE").anchorTime("06:45").build(),
            auth, HttpStatus.OK, SleepGoalResponse.class);
        putForBody("/api/sleep/goal",
            SetSleepGoalRequest.builder().targetMinutes(480).anchor("BED").anchorTime("23:00").build(),
            auth, HttpStatus.OK, SleepGoalResponse.class);

        SleepGoalResponse read =
            getForBody("/api/sleep/goal", auth, HttpStatus.OK, SleepGoalResponse.class);
        assertThat(read.getAnchor()).isEqualTo("BED");
        assertThat(read.getWakeTime()).isEqualTo("07:00"); // 23:00 + 480 min
    }

    @Test
    void testSetSleepGoal_shouldReturn400FieldErrors_whenInvalid() {
        SetSleepGoalRequest req = SetSleepGoalRequest.builder()
            .targetMinutes(1441).anchor("MID").anchorTime("25:00").build();

        String body = putForBody("/api/sleep/goal", req, ownerAuthHeaders(),
            HttpStatus.BAD_REQUEST, String.class);

        assertHasFieldError(body, "targetMinutes", "VALIDATION_INVALID_VALUE");
        assertHasFieldError(body, "anchor", "VALIDATION_INVALID_VALUE");
        assertHasFieldError(body, "anchorTime", "VALIDATION_INVALID_VALUE");
    }

    @Test
    void testSleepGoalEndpoints_shouldReturn401_whenNoToken() {
        getForBody("/api/sleep/goal", null, HttpStatus.UNAUTHORIZED, Void.class);
    }
}
