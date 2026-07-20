package io.mrkuhne.mezo.feature.intention;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.AddFocusRequest;
import io.mrkuhne.mezo.api.dto.IntentionCreedResponse;
import io.mrkuhne.mezo.api.dto.IntentionDayResponse;
import io.mrkuhne.mezo.api.dto.IntentionFocusResponse;
import io.mrkuhne.mezo.api.dto.ReflectRequest;
import io.mrkuhne.mezo.api.dto.SetCreedRequest;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

class IntentionApiIT extends ApiIntegrationTest {

    @Test
    void testGetDay_shouldReturnEmptyWithCap_whenNothingSet() {
        IntentionDayResponse day = getForBody("/api/intention/day/" + LocalDate.now(),
            ownerAuthHeaders(), HttpStatus.OK, IntentionDayResponse.class);
        assertThat(day.getFoci()).isEmpty();
        assertThat(day.getCreed()).isNull();
        assertThat(day.getFocusCap()).isEqualTo(3);
    }

    @Test
    void testSetCreedThenAddFocus_shouldCompose_whenRead() {
        putForBody("/api/intention/creed", SetCreedRequest.builder().text("Szándékkal élek.").build(),
            ownerAuthHeaders(), HttpStatus.OK, IntentionCreedResponse.class);
        LocalDate d = LocalDate.now();
        postForBody("/api/intention/focus", AddFocusRequest.builder().date(d).text("Jelen lenni.").build(),
            ownerAuthHeaders(), HttpStatus.OK, IntentionFocusResponse.class);

        IntentionDayResponse day = getForBody("/api/intention/day/" + d,
            ownerAuthHeaders(), HttpStatus.OK, IntentionDayResponse.class);
        assertThat(day.getCreed()).isEqualTo("Szándékkal élek.");
        assertThat(day.getFoci()).hasSize(1);
    }

    @Test
    void testAddFocus_shouldRejectFourth_whenCapReached() {
        LocalDate d = LocalDate.now();
        for (String t : new String[] {"Egy.", "Kettő.", "Három."}) {
            postForBody("/api/intention/focus", AddFocusRequest.builder().date(d).text(t).build(),
                ownerAuthHeaders(), HttpStatus.OK, IntentionFocusResponse.class);
        }
        String err = postForBody("/api/intention/focus",
            AddFocusRequest.builder().date(d).text("Négy.").build(),
            ownerAuthHeaders(), HttpStatus.CONFLICT, String.class);
        assertHasRequestError(err, "INTENTION_FOCUS_CAP");
    }

    @Test
    void testReflect_shouldSetThenRejectInvalid() {
        LocalDate d = LocalDate.now();
        IntentionDayResponse day = postForBody("/api/intention/reflect",
            ReflectRequest.builder().date(d).value(ReflectRequest.ValueEnum.YES).build(),
            ownerAuthHeaders(), HttpStatus.OK, IntentionDayResponse.class);
        assertThat(day.getReflection().getValue()).isEqualTo("yes");
    }
}
