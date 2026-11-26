package io.mrkuhne.mezo.feature.season;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.MesocycleResponse;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.TestPropertySource;

/**
 * The restart is ONE transaction (mezo-r36n9.177, spec §5.5): when the season gate refuses the new run, the close of
 * the old run and the legacy template materialization roll back with it. HTTP-level and NOT {@code @Transactional},
 * so the rollback is observable from a fresh read.
 */
@TestPropertySource(properties = "mezo.season.mesocycle-gate.enabled=true")
class MesocycleRestartGateIT extends ApiIntegrationTest {

    @Autowired private OwnerProperties ownerProperties;
    @Autowired private TrainPopulator trainPopulator;
    @Autowired private JdbcTemplate jdbcTemplate;

    @Test
    void restartWithoutSeasonRollsBackEverything() {
        UUID owner = databasePopulator.populateUser(ownerProperties.ownerEmail());
        MesocycleEntity running = trainPopulator.createMesocycle(owner, "Futó mezociklus", "active");
        WorkoutSessionEntity day = trainPopulator.createWorkoutSession(owner, running.getId(), "Hét", "Pull", 0, "planned");
        trainPopulator.createExercise(owner, day.getId(), "Húzás", 0);
        Long templatesBefore = jdbcTemplate.queryForObject(
            "select count(*) from meso_template where created_by = ?", Long.class, owner);
        HttpHeaders auth = ownerAuthHeaders();

        String body = postForBody("/api/train/mesocycles/" + running.getId() + "/restart", null, auth,
            HttpStatus.CONFLICT, String.class);

        assertHasRequestError(body, "SEASON_REQUIRED");
        List<MesocycleResponse> runs = getForList("/api/train/mesocycles", auth, HttpStatus.OK, MesocycleResponse.class);
        assertThat(runs).singleElement().satisfies(m -> {
            assertThat(m.getStatus()).isEqualTo(MesocycleResponse.StatusEnum.ACTIVE);
            assertThat(m.getClosedAt()).isNull();
            assertThat(m.getHasReport()).isFalse();
            assertThat(m.getTemplateId()).isNull();
        });
        assertThat(jdbcTemplate.queryForObject(
            "select count(*) from meso_template where created_by = ?", Long.class, owner)).isEqualTo(templatesBefore);
    }
}
