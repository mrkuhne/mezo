package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.MesoDayInput;
import io.mrkuhne.mezo.api.dto.MesoRerunResponse;
import io.mrkuhne.mezo.api.dto.MesoTemplateResponse;
import io.mrkuhne.mezo.api.dto.MesoTemplateStartRequest;
import io.mrkuhne.mezo.api.dto.MesoTemplateUpsertRequest;
import io.mrkuhne.mezo.api.dto.MesocycleResponse;
import io.mrkuhne.mezo.api.dto.MusclePrioritiesUpdateRequest;
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
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;

/** {@code sportGroups} (mezo-r36n9.77): stored on template and run, validated, normalised, copied both ways. */
class MesoTemplateSportGroupsIT extends ApiIntegrationTest {

    private static final String TEMPLATES = "/api/train/meso-templates";
    private static final String MESOCYCLES = "/api/train/mesocycles";

    @Autowired private OwnerProperties ownerProperties;
    @Autowired private TrainPopulator trainPopulator;
    @Autowired private JdbcTemplate jdbcTemplate;

    private UUID ownerId() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    @Test
    void templateRoundTripsSportGroups() {
        ownerId();
        HttpHeaders auth = ownerAuthHeaders();
        MesoTemplateUpsertRequest req = upsertRequest();
        req.setSportGroups(List.of("quad", "calf"));

        MesoTemplateResponse created =
            postForBody(TEMPLATES, req, auth, HttpStatus.OK, MesoTemplateResponse.class);
        assertThat(created.getSportGroups()).containsExactly("quad", "calf");

        MesoTemplateResponse listed = getForList(TEMPLATES, auth, HttpStatus.OK, MesoTemplateResponse.class)
            .stream().filter(t -> t.getId().equals(created.getId())).findFirst().orElseThrow();
        assertThat(listed.getSportGroups()).containsExactly("quad", "calf");
    }

    @Test
    void startCopiesSportGroupsToTheRun() {
        ownerId();
        HttpHeaders auth = ownerAuthHeaders();
        MesoTemplateUpsertRequest req = upsertRequest();
        req.setSportGroups(List.of("ham", "glute"));
        MesoTemplateResponse created =
            postForBody(TEMPLATES, req, auth, HttpStatus.OK, MesoTemplateResponse.class);

        MesocycleResponse run = start(created.getId(), auth);

        assertThat(run.getSportGroups()).containsExactly("ham", "glute");
        assertThat(jdbcTemplate.queryForObject(
            "select sport_groups::text from mesocycle where id = ?", String.class, run.getId()))
            .contains("ham");
    }

    @Test
    void rerunCopiesThemBack() {
        UUID owner = ownerId();
        MesocycleEntity legacy = trainPopulator.createMesocycle(owner, "Legacy blokk", "archived");
        jdbcTemplate.update("update mesocycle set sport_groups = ?::jsonb where id = ?",
            "[\"quad\",\"calf\"]", legacy.getId());
        HttpHeaders auth = ownerAuthHeaders();

        MesoRerunResponse rerun = postForBody(MESOCYCLES + "/" + legacy.getId() + "/rerun", null, auth,
            HttpStatus.OK, MesoRerunResponse.class);

        MesoTemplateResponse template = getForList(TEMPLATES, auth, HttpStatus.OK, MesoTemplateResponse.class)
            .stream().filter(t -> t.getId().equals(rerun.getTemplateId())).findFirst().orElseThrow();
        assertThat(template.getSportGroups()).containsExactly("quad", "calf");
    }

    @Test
    void prioritiesRequestSetsAndClearsSportGroups() {
        ownerId();
        HttpHeaders auth = ownerAuthHeaders();
        MesoTemplateUpsertRequest req = upsertRequest();
        req.setSportGroups(List.of("quad"));
        MesoTemplateResponse created =
            postForBody(TEMPLATES, req, auth, HttpStatus.OK, MesoTemplateResponse.class);
        MesocycleResponse run = start(created.getId(), auth);
        String uri = MESOCYCLES + "/" + run.getId() + "/muscle-priorities";

        // absent keeps
        MesocycleResponse kept = putForBody(uri, MusclePrioritiesUpdateRequest.builder().build(),
            auth, HttpStatus.OK, MesocycleResponse.class);
        assertThat(kept.getSportGroups()).containsExactly("quad");

        // set replaces
        MesocycleResponse set = putForBody(uri,
            MusclePrioritiesUpdateRequest.builder().sportGroups(List.of("calf", "ham")).build(),
            auth, HttpStatus.OK, MesocycleResponse.class);
        assertThat(set.getSportGroups()).containsExactly("ham", "calf");

        // [] clears
        MesocycleResponse cleared = putForBody(uri,
            MusclePrioritiesUpdateRequest.builder().sportGroups(List.of()).build(),
            auth, HttpStatus.OK, MesocycleResponse.class);
        assertThat(cleared.getSportGroups()).isNull();
        assertThat(jdbcTemplate.queryForObject(
            "select sport_groups::text from mesocycle where id = ?", String.class, run.getId())).isNull();
    }

    @Test
    void unknownGroupIs400() {
        ownerId();
        HttpHeaders auth = ownerAuthHeaders();
        MesoTemplateUpsertRequest req = upsertRequest();
        req.setSportGroups(List.of("quad", "wing"));

        String body = exchangeForBody(HttpMethod.POST, TEMPLATES, req, auth, HttpStatus.BAD_REQUEST, String.class);

        assertHasRequestError(body, "TRAIN_SPORT_GROUP_INVALID");
    }

    @Test
    void duplicatesAndOrderAreNormalised() {
        ownerId();
        HttpHeaders auth = ownerAuthHeaders();
        MesoTemplateUpsertRequest req = upsertRequest();
        req.setSportGroups(List.of("calf", "quad", "calf", "glute"));

        MesoTemplateResponse created =
            postForBody(TEMPLATES, req, auth, HttpStatus.OK, MesoTemplateResponse.class);
        assertThat(created.getSportGroups()).containsExactly("quad", "glute", "calf");

        req.setSportGroups(List.of());
        MesoTemplateResponse emptied = putForBody(TEMPLATES + "/" + created.getId(), req, auth,
            HttpStatus.OK, MesoTemplateResponse.class);
        assertThat(emptied.getSportGroups()).isNull();
        assertThat(jdbcTemplate.queryForObject(
            "select sport_groups::text from meso_template where id = ?", String.class, created.getId()))
            .isNull();
    }

    private MesocycleResponse start(UUID templateId, HttpHeaders auth) {
        return postForBody(TEMPLATES + "/" + templateId + "/start",
            MesoTemplateStartRequest.builder().startDate(LocalDate.now())
                .status(MesoTemplateStartRequest.StatusEnum.ACTIVE).build(),
            auth, HttpStatus.OK, MesocycleResponse.class);
    }

    private static MesoTemplateUpsertRequest upsertRequest() {
        return MesoTemplateUpsertRequest.builder()
            .title("Sport teszt").shortTitle("Sport").goal("Erő").weeks(4)
            .split("Full body · 3×/hét").style("RP · 4 hét")
            .phaseCurve(List.of(
                MesoTemplateUpsertRequest.PhaseCurveEnum.MEV,
                MesoTemplateUpsertRequest.PhaseCurveEnum.MAV,
                MesoTemplateUpsertRequest.PhaseCurveEnum.MRV,
                MesoTemplateUpsertRequest.PhaseCurveEnum.DELOAD))
            .days(List.of(MesoDayInput.builder().day("Hét").type("Rest").build()))
            .build();
    }
}
