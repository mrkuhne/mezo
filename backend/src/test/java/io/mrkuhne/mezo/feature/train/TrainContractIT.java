package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.GymExerciseInput;
import io.mrkuhne.mezo.api.dto.MesoDayInput;
import io.mrkuhne.mezo.api.dto.MesocycleCreateRequest;
import io.mrkuhne.mezo.api.dto.MesocycleResponse;
import io.mrkuhne.mezo.api.dto.SportSessionResponse;
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

/** HTTP round-trips through the GENERATED Train contract interface (api/openapi.yml). */
class TrainContractIT extends ApiIntegrationTest {

    @Autowired private TrainPopulator trainPopulator;
    @Autowired private OwnerProperties ownerProperties;

    /** Find-or-create yields the demodata-seeded owner's id — the principal behind ownerAuthHeaders(). */
    private UUID ownerId() {
        return databasePopulator.populateUser(ownerProperties.ownerEmail());
    }

    @Test
    void testListMesocycles_shouldReturn401_whenUnauthenticated() {
        // Security-layer 401s are produced by Spring Security's BearerTokenAuthenticationEntryPoint
        // BEFORE the dispatcher, so they carry no SystemMessage body by design — status-only is correct.
        getForBody("/api/train/mesocycles", null, HttpStatus.UNAUTHORIZED, Void.class);
    }

    @Test
    void testListSportSessions_shouldReturn401_whenUnauthenticated() {
        // Security-layer 401s are produced by Spring Security's BearerTokenAuthenticationEntryPoint
        // BEFORE the dispatcher, so they carry no SystemMessage body by design — status-only is correct.
        getForBody("/api/train/sport-sessions", null, HttpStatus.UNAUTHORIZED, Void.class);
    }

    @Test
    void testListMesocycles_shouldReturnOwnerMesoWithVolume_whenAuthenticated() {
        UUID owner = ownerId();
        MesocycleEntity meso = trainPopulator.createMesocycle(owner, "Hypertrophy 04", "active");
        trainPopulator.createVolumeLog(owner, meso.getId(), "chest");

        HttpHeaders headers = ownerAuthHeaders();
        List<MesocycleResponse> mesos =
            getForList("/api/train/mesocycles", headers, HttpStatus.OK, MesocycleResponse.class);

        assertThat(mesos).hasSize(1);
        assertThat(mesos.get(0).getTitle()).isEqualTo("Hypertrophy 04");
        assertThat(mesos.get(0).getVolumePerMuscle()).isNotNull();
        assertThat(mesos.get(0).getVolumePerMuscle()).containsKey("chest");
    }

    @Test
    void testCreateMesocycle_shouldReturn401_whenUnauthenticated() {
        postForBody("/api/train/mesocycles", minimalCreateRequest(), null, HttpStatus.UNAUTHORIZED, Void.class);
    }

    @Test
    void testCreateMesocycle_shouldReturn201WithAssembledBody_whenValid() {
        ownerId();
        MesocycleCreateRequest req = minimalCreateRequest();

        MesocycleResponse created = postForBody(
            "/api/train/mesocycles", req, ownerAuthHeaders(), HttpStatus.CREATED, MesocycleResponse.class);

        assertThat(created.getId()).isNotNull();
        assertThat(created.getTitle()).isEqualTo("Contract teszt meso");
        assertThat(created.getEndDate()).isEqualTo(req.getStartDate().plusWeeks(4));
        assertThat(created.getDays()).hasSize(1);
        assertThat(created.getDays().get(0).getExercises()).hasSize(1);
    }

    @Test
    void testCreateMesocycle_shouldReturn400SystemMessage_whenTitleMissing() {
        ownerId();
        MesocycleCreateRequest req = minimalCreateRequest();
        req.setTitle(null);

        String body = exchangeForBody(HttpMethod.POST, "/api/train/mesocycles", req,
            ownerAuthHeaders(), HttpStatus.BAD_REQUEST, String.class);

        assertHasFieldError(body, "title", "VALIDATION_REQUIRED_FIELD");
    }

    @Test
    void testActivateMesocycle_shouldArchivePreviousAndReturn200_whenAuthenticated() {
        UUID owner = ownerId();
        MesocycleEntity previous = trainPopulator.createMesocycle(owner, "Régi aktív", "active");
        MesocycleEntity target = trainPopulator.createMesocycle(owner, "Új aktív", "planned");

        MesocycleResponse activated = postForBody("/api/train/mesocycles/" + target.getId() + "/activate",
            null, ownerAuthHeaders(), HttpStatus.OK, MesocycleResponse.class);

        assertThat(activated.getStatus()).isEqualTo(MesocycleResponse.StatusEnum.ACTIVE);
        List<MesocycleResponse> all =
            getForList("/api/train/mesocycles", ownerAuthHeaders(), HttpStatus.OK, MesocycleResponse.class);
        assertThat(all).filteredOn(m -> m.getId().equals(previous.getId()))
            .singleElement()
            .satisfies(m -> assertThat(m.getStatus()).isEqualTo(MesocycleResponse.StatusEnum.ARCHIVED));
    }

    @Test
    void testCloseMesocycle_shouldReturn404_whenUnknownId() {
        ownerId();
        String body = exchangeForBody(HttpMethod.POST,
            "/api/train/mesocycles/" + UUID.randomUUID() + "/close", null,
            ownerAuthHeaders(), HttpStatus.NOT_FOUND, String.class);
        assertHasRequestError(body, "RESOURCE_NOT_FOUND");
    }

    @Test
    void testActivateMesocycle_shouldReturn401_whenUnauthenticated() {
        postForBody("/api/train/mesocycles/" + UUID.randomUUID() + "/activate",
            null, null, HttpStatus.UNAUTHORIZED, Void.class);
    }

    private MesocycleCreateRequest minimalCreateRequest() {
        return MesocycleCreateRequest.builder()
            .title("Contract teszt meso")
            .status(MesocycleCreateRequest.StatusEnum.PLANNED)
            .startDate(LocalDate.parse("2026-06-16"))
            .weeks(4)
            .split("Upper / Lower · 4×/hét")
            .style("Linear · 4 hét")
            .phaseCurve(List.of(
                MesocycleCreateRequest.PhaseCurveEnum.MEV,
                MesocycleCreateRequest.PhaseCurveEnum.MAV))
            .days(List.of(MesoDayInput.builder().day("Hét").type("Upper")
                .exercises(List.of(GymExerciseInput.builder().name("Bench Press").sets(4)
                    .targetReps("6-8").targetRIR(2)
                    .type(GymExerciseInput.TypeEnum.COMPOUND).build()))
                .build()))
            .build();
    }

    @Test
    void testListSportSessions_shouldRoundTripAllRequiredFields_whenAuthenticated() {
        UUID owner = ownerId();
        trainPopulator.createSportSession(owner, LocalDate.parse("2026-05-20"));

        HttpHeaders headers = ownerAuthHeaders();
        List<SportSessionResponse> sessions =
            getForList("/api/train/sport-sessions", headers, HttpStatus.OK, SportSessionResponse.class);

        assertThat(sessions).hasSize(1);
        SportSessionResponse s = sessions.get(0);
        // The DB allows NULL on the metric columns, but the contract marks them required — the
        // populated row must serialize complete or the round-trip would surface a missing field.
        assertThat(s.getId()).isNotNull();
        assertThat(s.getSport()).isEqualTo("volleyball");
        assertThat(s.getDate()).isEqualTo(LocalDate.parse("2026-05-20"));
        assertThat(s.getTime()).isEqualTo("18:15");
        assertThat(s.getDuration()).isEqualTo(90);
        assertThat(s.getSetsPlayed()).isEqualTo(5);
        assertThat(s.getIntensity()).isEqualTo(7);
        // Numeric equality (not string) so a future scale change can't slip through unnoticed.
        assertThat(s.getRpe()).isEqualByComparingTo("6.8");
        assertThat(s.getShoulderStrain()).isEqualTo(6);
        assertThat(s.getJumpCount()).isEqualTo(38);
    }
}
