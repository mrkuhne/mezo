package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.GymExerciseInput;
import io.mrkuhne.mezo.api.dto.MesoDayInput;
import io.mrkuhne.mezo.api.dto.MesoTemplateResponse;
import io.mrkuhne.mezo.api.dto.MesoTemplateStartRequest;
import io.mrkuhne.mezo.api.dto.MesoTemplateUpsertRequest;
import io.mrkuhne.mezo.api.dto.MesocycleResponse;
import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.train.service.MesocycleDiscardService;
import io.mrkuhne.mezo.feature.train.service.TrainService;
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
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.event.ApplicationEvents;
import org.springframework.test.context.event.RecordApplicationEvents;

/**
 * POST /api/train/mesocycles/{id}/discard (mezo-r36n9.113): „Mégsem, eldobom" throws away a block that was never
 * trained — soft-deletes the run, its days, exercises and volume rows, and the template it came from when that
 * template has no other runs; no report, no {@link MesocycleClosed}. The event assertions call the service in the
 * test thread ({@code ApplicationEvents} records only that thread); a close in the same setup proves the recorder.
 */
@RecordApplicationEvents
@TestPropertySource(properties = "mezo.feature.companion.enabled=false")
class MesocycleDiscardIT extends ApiIntegrationTest {

    private static final String TEMPLATES = "/api/train/meso-templates";
    private static final String MESOCYCLES = "/api/train/mesocycles";

    @Autowired private OwnerProperties ownerProperties;
    @Autowired private TrainPopulator trainPopulator;
    @Autowired private JdbcTemplate jdbc;
    @Autowired private ApplicationEvents events;
    @Autowired private MesocycleDiscardService discardService;
    @Autowired private TrainService trainService;

    private UUID owner() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    @Test
    void discardLeavesNoBlockAndDeletesTheTemplateWithNoOtherRuns() {
        UUID owner = owner();
        HttpHeaders auth = ownerAuthHeaders();
        MesoTemplateResponse template = postForBody(TEMPLATES, upsert(), auth, HttpStatus.OK, MesoTemplateResponse.class);
        MesocycleResponse run = start(template.getId(), auth, MesoTemplateStartRequest.StatusEnum.ACTIVE);
        assertThat(count("select count(*) from muscle_group_volume_log where mesocycle_id = ? and is_deleted = false",
            run.getId())).isPositive();

        postForBody(MESOCYCLES + "/" + run.getId() + "/discard", null, auth, HttpStatus.NO_CONTENT, String.class);

        assertThat(count("select count(*) from mesocycle where created_by = ? and status in ('planned','active') "
            + "and is_deleted = false", owner)).isZero();
        assertThat(count("select count(*) from mesocycle where id = ? and is_deleted = true", run.getId())).isOne();
        assertThat(count("select count(*) from workout_session where mesocycle_id = ? and is_deleted = false",
            run.getId())).isZero();
        assertThat(count("select count(*) from exercise e join workout_session s on s.id = e.workout_session_id "
            + "where s.mesocycle_id = ? and e.is_deleted = false", run.getId())).isZero();
        assertThat(count("select count(*) from muscle_group_volume_log where mesocycle_id = ? and is_deleted = false",
            run.getId())).isZero();
        assertThat(count("select count(*) from meso_template where id = ? and is_deleted = true", template.getId()))
            .isOne();
        assertThat(count("select count(*) from mesocycle_report where mesocycle_id = ?", run.getId())).isZero();
    }

    @Test
    void discardKeepsATemplateThatHasAnotherRun() {
        owner();
        HttpHeaders auth = ownerAuthHeaders();
        MesoTemplateResponse template = postForBody(TEMPLATES, upsert(), auth, HttpStatus.OK, MesoTemplateResponse.class);
        MesocycleResponse first = start(template.getId(), auth, MesoTemplateStartRequest.StatusEnum.ACTIVE);
        postForBody(MESOCYCLES + "/" + first.getId() + "/close", null, auth, HttpStatus.OK, MesocycleResponse.class);
        MesocycleResponse second = start(template.getId(), auth, MesoTemplateStartRequest.StatusEnum.PLANNED);

        postForBody(MESOCYCLES + "/" + second.getId() + "/discard", null, auth, HttpStatus.NO_CONTENT, String.class);

        assertThat(count("select count(*) from meso_template where id = ? and is_deleted = false", template.getId()))
            .isOne();
        assertThat(count("select count(*) from mesocycle where id = ? and is_deleted = false", first.getId())).isOne();
    }

    @Test
    void discardPublishesNoCloseEvent() {
        UUID owner = owner();
        HttpHeaders auth = ownerAuthHeaders();
        MesoTemplateResponse template = postForBody(TEMPLATES, upsert(), auth, HttpStatus.OK, MesoTemplateResponse.class);
        MesocycleResponse discarded = start(template.getId(), auth, MesoTemplateStartRequest.StatusEnum.ACTIVE);

        discardService.discard(owner, discarded.getId());
        assertThat(events.stream(MesocycleClosed.class)).isEmpty();

        // the recorder is live: a real close of another block does publish
        MesoTemplateResponse other = postForBody(TEMPLATES, upsert(), auth, HttpStatus.OK, MesoTemplateResponse.class);
        MesocycleResponse closed = start(other.getId(), auth, MesoTemplateStartRequest.StatusEnum.ACTIVE);
        trainService.closeMesocycle(owner, closed.getId(), null);
        assertThat(events.stream(MesocycleClosed.class)).hasSize(1);
    }

    @Test
    void loggedSessionIs409() {
        UUID owner = owner();
        HttpHeaders auth = ownerAuthHeaders();
        MesoTemplateResponse template = postForBody(TEMPLATES, upsert(), auth, HttpStatus.OK, MesoTemplateResponse.class);
        MesocycleResponse run = start(template.getId(), auth, MesoTemplateStartRequest.StatusEnum.ACTIVE);
        UUID day = jdbc.queryForObject("select id from workout_session where mesocycle_id = ? "
            + "and template_session_id is null and day_label = 'Hét'", UUID.class, run.getId());
        trainPopulator.startInstance(owner, day);

        String body = postForBody(MESOCYCLES + "/" + run.getId() + "/discard", null, auth, HttpStatus.CONFLICT,
            String.class);

        assertHasRequestError(body, "TRAIN_MESO_DISCARD_HAS_LOGS");
        assertThat(count("select count(*) from mesocycle where id = ? and is_deleted = false", run.getId())).isOne();
    }

    @Test
    void anotherUsersBlockIs404() {
        owner();
        HttpHeaders auth = ownerAuthHeaders();
        MesoTemplateResponse template = postForBody(TEMPLATES, upsert(), auth, HttpStatus.OK, MesoTemplateResponse.class);
        MesocycleResponse run = start(template.getId(), auth, MesoTemplateStartRequest.StatusEnum.ACTIVE);
        RegisteredUser stranger = registerUser("Idegen");

        postForBody(MESOCYCLES + "/" + run.getId() + "/discard", null, stranger.headers(), HttpStatus.NOT_FOUND,
            String.class);

        assertThat(count("select count(*) from mesocycle where id = ? and is_deleted = false", run.getId())).isOne();
    }

    private long count(String sql, Object arg) {
        Long n = jdbc.queryForObject(sql, Long.class, arg);
        return n == null ? 0 : n;
    }

    private MesocycleResponse start(UUID templateId, HttpHeaders auth, MesoTemplateStartRequest.StatusEnum status) {
        LocalDate date = status == MesoTemplateStartRequest.StatusEnum.ACTIVE ? LocalDate.now()
            : LocalDate.now().plusWeeks(1);
        return postForBody(TEMPLATES + "/" + templateId + "/start",
            MesoTemplateStartRequest.builder().startDate(date).status(status).build(),
            auth, HttpStatus.OK, MesocycleResponse.class);
    }

    private static MesoTemplateUpsertRequest upsert() {
        return MesoTemplateUpsertRequest.builder()
            .title("Eldobható").shortTitle("Eldobható").goal("Izom").weeks(4)
            .split("Full body · 2×/hét").style("RP · 4 hét")
            .phaseCurve(List.of(
                MesoTemplateUpsertRequest.PhaseCurveEnum.MEV,
                MesoTemplateUpsertRequest.PhaseCurveEnum.MAV,
                MesoTemplateUpsertRequest.PhaseCurveEnum.MRV,
                MesoTemplateUpsertRequest.PhaseCurveEnum.DELOAD))
            .days(List.of(
                MesoDayInput.builder().day("Hét").type("Full").muscle("chest").exercises(List.of(
                    GymExerciseInput.builder().name("Fekvenyomás").muscle("chest").warmupSets(1).workingSets(3)
                        .repMin(6).repMax(10).targetRIR(2).type(GymExerciseInput.TypeEnum.COMPOUND)
                        .countsTowardVolume(true).build())).build(),
                MesoDayInput.builder().day("Csü").type("Full").muscle("chest").exercises(List.of(
                    GymExerciseInput.builder().name("Tárogatás").muscle("chest").warmupSets(0).workingSets(3)
                        .repMin(10).repMax(15).targetRIR(1).type(GymExerciseInput.TypeEnum.ISOLATION)
                        .countsTowardVolume(true).build())).build()))
            .build();
    }
}
