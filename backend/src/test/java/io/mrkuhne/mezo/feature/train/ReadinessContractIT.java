package io.mrkuhne.mezo.feature.train;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.ReadinessChoiceRequest;
import io.mrkuhne.mezo.api.dto.ReadinessTodayResponse;
import io.mrkuhne.mezo.api.dto.ReadinessTodayResponse.StateEnum;
import io.mrkuhne.mezo.feature.train.service.WorkoutService;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import io.mrkuhne.mezo.support.populator.CheckInPopulator;
import io.mrkuhne.mezo.support.populator.TrainPopulator;
import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;

/** HTTP round-trip through the GENERATED TrainReadiness contract (Check-in 2.0, mezo-ck2). */
class ReadinessContractIT extends ApiIntegrationTest {

    private static final String URI = "/api/train/readiness/today";

    @Autowired private CheckInPopulator checkIns;
    @Autowired private TrainPopulator train;

    private void soreGymMorning(UUID user) {
        var meso = train.createActiveMeso(user);
        String todayLabel = WorkoutService.HU_DAY_LABELS.get(LocalDate.now().getDayOfWeek().getValue() - 1);
        var day = train.createTemplateDay(user, meso.getId(), todayLabel);
        train.createExercise(user, day.getId(), "Guggolás", "quad", "compound");
        checkIns.createCheckIn(user, LocalDate.now(), "06:30", c -> c.setSoreness(8));
    }

    @Test
    void testReadiness_shouldReturn401_whenUnauthenticated() {
        getForBody(URI, null, HttpStatus.UNAUTHORIZED, Void.class);
        postForBody(URI, Map.of("choice", "LIGHTEN"), null, HttpStatus.UNAUTHORIZED, Void.class);
        exchangeForBody(HttpMethod.DELETE, URI, null, null, HttpStatus.UNAUTHORIZED, Void.class);
    }

    @Test
    void testGetTodayReadiness_shouldReturnNone_whenNothingToShow() {
        ReadinessTodayResponse res = getForBody(URI, ownerAuthHeaders(), HttpStatus.OK, ReadinessTodayResponse.class);

        assertThat(res.getState()).isEqualTo(StateEnum.NONE);
        assertThat(res.getReasons()).isEmpty();
        assertThat(res.getCare()).isEmpty();
    }

    @Test
    void testReadiness_shouldOfferLightenAndUndo_whenMorningIsSore() {
        RegisteredUser user = registerUser("Readiness Round Trip");
        soreGymMorning(user.id());

        ReadinessTodayResponse offer = getForBody(URI, user.headers(), HttpStatus.OK, ReadinessTodayResponse.class);
        ReadinessTodayResponse lightened = postForBody(URI,
            ReadinessChoiceRequest.builder().choice(ReadinessChoiceRequest.ChoiceEnum.LIGHTEN).build(),
            user.headers(), HttpStatus.OK, ReadinessTodayResponse.class);
        ReadinessTodayResponse undone = exchangeForBody(HttpMethod.DELETE, URI, null, user.headers(),
            HttpStatus.OK, ReadinessTodayResponse.class);

        assertThat(offer.getState()).isEqualTo(StateEnum.OFFER);
        assertThat(offer.getSuggest()).isTrue();
        assertThat(lightened.getState()).isEqualTo(StateEnum.LIGHTENED);
        assertThat(undone.getState()).isEqualTo(StateEnum.OFFER);
    }

    @Test
    void testChooseTodayReadiness_shouldReturn400_whenChoiceMissing() {
        String body = postForBody(URI, Map.of(), ownerAuthHeaders(), HttpStatus.BAD_REQUEST, String.class);

        assertHasFieldError(body, "choice", "VALIDATION_REQUIRED_FIELD");
    }

    @Test
    void testReadiness_shouldNotLeakAnotherUsersChoice_whenReadByB() {
        RegisteredUser a = registerUser("Readiness A");
        RegisteredUser b = registerUser("Readiness B");
        soreGymMorning(a.id());
        postForBody(URI, ReadinessChoiceRequest.builder().choice(ReadinessChoiceRequest.ChoiceEnum.KEEP).build(),
            a.headers(), HttpStatus.OK, ReadinessTodayResponse.class);

        ReadinessTodayResponse forB = getForBody(URI, b.headers(), HttpStatus.OK, ReadinessTodayResponse.class);
        // B's undo is a no-op against A's row.
        exchangeForBody(HttpMethod.DELETE, URI, null, b.headers(), HttpStatus.OK, ReadinessTodayResponse.class);
        ReadinessTodayResponse forA = getForBody(URI, a.headers(), HttpStatus.OK, ReadinessTodayResponse.class);

        assertThat(forB.getState()).isEqualTo(StateEnum.NONE);
        assertThat(forB.getReasons()).isEmpty();
        assertThat(forA.getState()).isEqualTo(StateEnum.KEPT);
    }
}
