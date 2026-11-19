package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.RunSessionLogResponse;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.train.entity.RunningBlockEntity;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.RunningPopulator;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;

/**
 * Contract IT for the run log after the XP world left the server (mezo-r36n9.97.5): logging a
 * SPRINT run session still returns 201 with the saved log, and the optional {@code levelUp} is
 * never populated. Drives the GENERATED contract over HTTP.
 */
class RunSessionNoLevelUpApiIT extends ApiIntegrationTest {

    @Autowired private RunningPopulator runningPopulator;
    @Autowired private OwnerProperties ownerProperties;

    @Test
    void testLogRunSession_shouldReturnNoLevelUp_whenSprintSessionLogged() {
        // Find-or-create yields the demodata-seeded owner's id — the principal behind ownerAuthHeaders().
        UUID owner = databasePopulator.populateUser(ownerProperties.ownerEmail());
        RunningBlockEntity block = runningPopulator.createSprintBlock(owner);

        RunSessionLogResponse body = postForBody("/api/train/run-sessions",
            Map.of("blockId", block.getId().toString(), "weekNumber", 1,
                "sessionKey", "w1-sprint", "date", "2026-06-22",
                "completedRounds", 6, "rpeActual", 8, "durationMin", 32),
            ownerAuthHeaders(), HttpStatus.CREATED, RunSessionLogResponse.class);

        assertThat(body.getSessionKey()).isEqualTo("w1-sprint");
        assertThat(body.getLevelUp()).isNull();
    }
}
