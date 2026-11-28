package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.SportLoadResponse;
import io.mrkuhne.mezo.api.dto.SportLoadWeek;
import io.mrkuhne.mezo.api.dto.SportSessionCreateRequest;
import io.mrkuhne.mezo.api.dto.SportSessionResponse;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;

/**
 * Boop Sport Napló correct / delete (mezo-r36n9.205): HTTP round-trips through the GENERATED
 * {@code updateSportSession} / {@code deleteSportSession} contract, and the week's session count follows.
 */
class SportSessionEditContractIT extends ApiIntegrationTest {

    private static SportSessionCreateRequest.SportSessionCreateRequestBuilder req() {
        return SportSessionCreateRequest.builder()
            .sport("volleyball").date(LocalDate.now()).time("18:00")
            .duration(90).setsPlayed(5).rpe(new BigDecimal("7")).shoulderStrain(6);
    }

    private SportSessionResponse log(HttpHeaders auth) {
        return postForBody("/api/train/sport-sessions", req().build(), auth, HttpStatus.CREATED, SportSessionResponse.class);
    }

    private int thisWeekSessions(HttpHeaders auth) {
        SportLoadResponse load = getForBody("/api/train/sport/load?weeks=1", auth, HttpStatus.OK, SportLoadResponse.class);
        List<SportLoadWeek> weeks = load.getWeeks();
        return weeks.get(weeks.size() - 1).getSportSessions();
    }

    @Test
    void testUpdateSportSession_shouldReturn401_whenUnauthenticated() {
        putForBody("/api/train/sport-sessions/" + UUID.randomUUID(), req().build(), null, HttpStatus.UNAUTHORIZED, Void.class);
    }

    @Test
    void testDeleteSportSession_shouldReturn401_whenUnauthenticated() {
        deleteAndExpect("/api/train/sport-sessions/" + UUID.randomUUID(), null, HttpStatus.UNAUTHORIZED);
    }

    @Test
    void testUpdateSportSession_shouldReplaceFieldsAndKeepDate_whenDateOmitted() {
        HttpHeaders auth = ownerAuthHeaders();
        SportSessionResponse created = log(auth);

        SportSessionResponse edited = putForBody("/api/train/sport-sessions/" + created.getId(),
            req().date(null).time(null).duration(60).rpe(new BigDecimal("8")).shoulderStrain(3).setsPlayed(null)
                .notes("rövidebb volt").kcalOverride(420).build(),
            auth, HttpStatus.OK, SportSessionResponse.class);

        assertThat(edited.getId()).isEqualTo(created.getId());
        assertThat(edited.getDate()).isEqualTo(created.getDate());
        assertThat(edited.getTime()).isEqualTo("18:00");
        assertThat(edited.getDuration()).isEqualTo(60);
        assertThat(edited.getRpe()).isEqualByComparingTo("8");
        assertThat(edited.getShoulderStrain()).isEqualTo(3);
        assertThat(edited.getSetsPlayed()).isNull();
        assertThat(edited.getNotes()).isEqualTo("rövidebb volt");
        assertThat(edited.getKcal()).isEqualTo(420);
        assertThat(edited.getKcalIsEstimate()).isFalse();

        List<SportSessionResponse> list =
            getForList("/api/train/sport-sessions", auth, HttpStatus.OK, SportSessionResponse.class);
        assertThat(list).filteredOn(s -> s.getId().equals(created.getId()))
            .singleElement().extracting(SportSessionResponse::getDuration).isEqualTo(60);
    }

    @Test
    void testUpdateSportSession_shouldReturn404_whenUnknown() {
        putForBody("/api/train/sport-sessions/" + UUID.randomUUID(), req().build(),
            ownerAuthHeaders(), HttpStatus.NOT_FOUND, Void.class);
    }

    @Test
    void testDeleteSportSession_shouldRemoveFromListAndWeekCount_whenOwned() {
        HttpHeaders auth = ownerAuthHeaders();
        int before = thisWeekSessions(auth);
        SportSessionResponse created = log(auth);
        assertThat(thisWeekSessions(auth)).isEqualTo(before + 1);

        deleteAndExpect("/api/train/sport-sessions/" + created.getId(), auth, HttpStatus.NO_CONTENT);

        assertThat(thisWeekSessions(auth)).isEqualTo(before);
        List<SportSessionResponse> list =
            getForList("/api/train/sport-sessions", auth, HttpStatus.OK, SportSessionResponse.class);
        assertThat(list).extracting(SportSessionResponse::getId).doesNotContain(created.getId());
        // gone already = 404
        deleteAndExpect("/api/train/sport-sessions/" + created.getId(), auth, HttpStatus.NOT_FOUND);
    }
}
