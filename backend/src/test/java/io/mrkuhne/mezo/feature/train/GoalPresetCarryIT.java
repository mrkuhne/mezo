package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.MesoDayInput;
import io.mrkuhne.mezo.api.dto.MesoRerunResponse;
import io.mrkuhne.mezo.api.dto.MesoTemplateResponse;
import io.mrkuhne.mezo.api.dto.MesoTemplateStartRequest;
import io.mrkuhne.mezo.api.dto.MesoTemplateUpsertRequest;
import io.mrkuhne.mezo.api.dto.MesocycleResponse;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;

/**
 * Carries {@code goalPreset} (mezo-dq60, Task 2) through every backend path: template upsert,
 * template→run stamping ({@code start}), and the legacy rerun materialization. Modeled on
 * {@link MesoTemplateIT}'s API-driving style.
 */
class GoalPresetCarryIT extends ApiIntegrationTest {

    private static final String TEMPLATES = "/api/train/meso-templates";
    private static final String MESOCYCLES = "/api/train/mesocycles";

    @Autowired private OwnerProperties ownerProperties;
    @Autowired private TrainPopulator trainPopulator;
    @Autowired private JdbcTemplate jdbcTemplate;

    private UUID ownerId() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    @Test
    void testStartTemplate_shouldCarryGoalPresetOntoTheRun() {
        ownerId();
        HttpHeaders auth = ownerAuthHeaders();

        MesoTemplateUpsertRequest req = upsertRequest();
        req.setGoalPreset("strength");
        MesoTemplateResponse created =
            postForBody(TEMPLATES, req, auth, HttpStatus.OK, MesoTemplateResponse.class);
        assertThat(created.getGoalPreset()).isEqualTo("strength");

        MesocycleResponse run = postForBody(TEMPLATES + "/" + created.getId() + "/start",
            startRequest(LocalDate.now(), MesoTemplateStartRequest.StatusEnum.ACTIVE), auth,
            HttpStatus.OK, MesocycleResponse.class);

        assertThat(run.getGoalPreset()).isEqualTo("strength");

        List<MesocycleResponse> mesos =
            getForList(MESOCYCLES, auth, HttpStatus.OK, MesocycleResponse.class);
        assertThat(mesos).singleElement()
            .satisfies(m -> assertThat(m.getGoalPreset()).isEqualTo("strength"));

        String goalPresetColumn = jdbcTemplate.queryForObject(
            "select goal_preset from mesocycle where id = ?", String.class, run.getId());
        assertThat(goalPresetColumn).isEqualTo("strength");
    }

    @Test
    void testRerun_shouldMaterializeGoalPresetFromLegacyRun() {
        UUID owner = ownerId();
        MesocycleEntity legacy = trainPopulator.createMesocycle(owner, "Legacy sport blokk", "archived");
        jdbcTemplate.update("update mesocycle set goal_preset = ? where id = ?", "sport", legacy.getId());
        HttpHeaders auth = ownerAuthHeaders();

        MesoRerunResponse rerun = postForBody(MESOCYCLES + "/" + legacy.getId() + "/rerun", null, auth,
            HttpStatus.OK, MesoRerunResponse.class);

        MesoTemplateResponse template =
            getForList(TEMPLATES, auth, HttpStatus.OK, MesoTemplateResponse.class).stream()
                .filter(t -> t.getId().equals(rerun.getTemplateId())).findFirst().orElseThrow();
        assertThat(template.getGoalPreset()).isEqualTo("sport");
    }

    // ── fixtures ────────────────────────────────────────────────────────────────

    private static MesoTemplateStartRequest startRequest(
            LocalDate startDate, MesoTemplateStartRequest.StatusEnum status) {
        return MesoTemplateStartRequest.builder().startDate(startDate).status(status).build();
    }

    /** A minimal single-day wizard template — this suite exercises goalPreset, not plan shape. */
    private static MesoTemplateUpsertRequest upsertRequest() {
        return MesoTemplateUpsertRequest.builder()
            .title("Preset teszt")
            .shortTitle("Preset")
            .goal("Erő")
            .weeks(4)
            .split("Full body · 3×/hét")
            .style("RP · 4 hét")
            .phaseCurve(List.of(
                MesoTemplateUpsertRequest.PhaseCurveEnum.MEV,
                MesoTemplateUpsertRequest.PhaseCurveEnum.MAV,
                MesoTemplateUpsertRequest.PhaseCurveEnum.MRV,
                MesoTemplateUpsertRequest.PhaseCurveEnum.DELOAD))
            .days(List.of(MesoDayInput.builder().day("Hét").type("Rest").build()))
            .build();
    }
}
