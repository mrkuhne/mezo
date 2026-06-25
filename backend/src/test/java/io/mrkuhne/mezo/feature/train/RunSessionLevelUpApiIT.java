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
 * Contract IT for the run-log → progression trigger (T4): with the progression switch ON,
 * logging a SPRINT run session returns a populated {@code levelUp} (source RUN, a sprint_speed
 * gain). {@code levelUp} is computed ONLY inside {@code logSession} (never the GET list path) and
 * only behind the {@code ProgressionGate}. Drives the GENERATED contract over HTTP.
 */
class RunSessionLevelUpApiIT extends ApiIntegrationTest {

    @Autowired private RunningPopulator runningPopulator;
    @Autowired private OwnerProperties ownerProperties;

    @Test
    void testLogRunSession_shouldReturnLevelUp_whenSprintSessionLogged() {
        // Find-or-create yields the demodata-seeded owner's id — the principal behind ownerAuthHeaders().
        UUID owner = databasePopulator.populateUser(ownerProperties.ownerEmail());
        RunningBlockEntity block = runningPopulator.createSprintBlock(owner);

        RunSessionLogResponse body = postForBody("/api/train/run-sessions",
            Map.of("blockId", block.getId().toString(), "weekNumber", 1,
                "sessionKey", "w1-sprint", "date", "2026-06-22",
                "completedRounds", 6, "rpeActual", 8, "durationMin", 32),
            ownerAuthHeaders(), HttpStatus.CREATED, RunSessionLogResponse.class);

        assertThat(body.getLevelUp()).isNotNull();
        assertThat(body.getLevelUp().getSource())
            .isEqualTo(io.mrkuhne.mezo.api.dto.LevelUpResult.SourceEnum.RUN);
        assertThat(body.getLevelUp().getGains())
            .anySatisfy(g -> assertThat(g.getSkillKey()).isEqualTo("sprint_speed"));
    }
}
