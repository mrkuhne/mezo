package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

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
