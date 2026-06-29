package io.mrkuhne.mezo.feature.progression.controller;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.ProgressionProfileResponse;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

/** HTTP round-trip through the switch-gated progression profile contract. */
class ProgressionProfileApiIT extends ApiIntegrationTest {

    @Test
    void testGetProfile_shouldReturnGhostProfile_whenOwnerHasNoXp() {
        ProgressionProfileResponse p = getForBody("/api/progression/profile",
            ownerAuthHeaders(), HttpStatus.OK, ProgressionProfileResponse.class);

        assertThat(p.getAthleteLevel()).isNull();
        assertThat(p.getStreakWeeks()).isZero();
        assertThat(p.getAthletic()).hasSize(12);
        assertThat(p.getMuscle()).hasSize(13);
        assertThat(p.getRadarAxes()).hasSize(6);
    }

    @Test
    void testGetProfile_shouldReturn401_whenNoToken() {
        getForBody("/api/progression/profile", null, HttpStatus.UNAUTHORIZED, Void.class);
    }
}
