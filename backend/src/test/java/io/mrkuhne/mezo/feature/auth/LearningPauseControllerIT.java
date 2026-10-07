package io.mrkuhne.mezo.feature.auth;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.LearningPauseResponse;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;

/** "Most ne tanulj" endpoints (mezo-rrjxe): the round trip, validation, auth, and isolation. */
class LearningPauseControllerIT extends ApiIntegrationTest {

    private static final String URI = "/api/learning-pause";

    @Test
    void testLearningPause_shouldRoundTrip_whenStartedAndEnded() {
        HttpHeaders owner = ownerAuthHeaders();
        assertThat(getForBody(URI, owner, HttpStatus.OK, LearningPauseResponse.class).getPaused()).isFalse();

        LearningPauseResponse on = putForBody(URI, Map.of("choice", "tomorrow_morning"), owner,
            HttpStatus.OK, LearningPauseResponse.class);
        assertThat(on.getPaused()).isTrue();
        assertThat(on.getChoice()).isEqualTo(LearningPauseResponse.ChoiceEnum.TOMORROW_MORNING);
        assertThat(on.getUntil()).isAfter(on.getStartedAt());

        LearningPauseResponse open = putForBody(URI, Map.of("choice", "open"), owner,
            HttpStatus.OK, LearningPauseResponse.class);
        assertThat(open.getChoice()).isEqualTo(LearningPauseResponse.ChoiceEnum.TOMORROW_MORNING); // unchanged

        LearningPauseResponse off = exchangeForBody(HttpMethod.DELETE, URI, null, owner,
            HttpStatus.OK, LearningPauseResponse.class);
        assertThat(off.getPaused()).isFalse();
        assertThat(off.getUntil()).isNull();
        assertThat(getForBody(URI, owner, HttpStatus.OK, LearningPauseResponse.class).getPaused()).isFalse();
    }

    @Test
    void testLearningPause_shouldBeOpenEnded_whenChoiceOpen() {
        LearningPauseResponse on = putForBody(URI, Map.of("choice", "open"), ownerAuthHeaders(),
            HttpStatus.OK, LearningPauseResponse.class);
        assertThat(on.getPaused()).isTrue();
        assertThat(on.getUntil()).isNull();
    }

    @Test
    void testLearningPause_shouldReject_whenChoiceUnknownOrTokenMissing() {
        putForBody(URI, Map.of("choice", "forever"), ownerAuthHeaders(), HttpStatus.BAD_REQUEST, String.class);
        putForBody(URI, Map.of(), ownerAuthHeaders(), HttpStatus.BAD_REQUEST, String.class);
        getForBody(URI, null, HttpStatus.UNAUTHORIZED, String.class);
    }

    @Test
    void testLearningPause_shouldStayPerUser_whenAnotherUserPauses() {
        RegisteredUser anna = registerUser("Anna");
        putForBody(URI, Map.of("choice", "open"), anna.headers(), HttpStatus.OK, LearningPauseResponse.class);

        assertThat(getForBody(URI, ownerAuthHeaders(), HttpStatus.OK, LearningPauseResponse.class).getPaused()).isFalse();
        assertThat(getForBody(URI, anna.headers(), HttpStatus.OK, LearningPauseResponse.class).getPaused()).isTrue();
    }
}
