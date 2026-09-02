package io.mrkuhne.mezo.feature.auth;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.LogWeightRequest;
import io.mrkuhne.mezo.api.dto.WeightLogResponse;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

/** Smoke proof that two real accounts never see each other's owned rows. */
class AuthIsolationIT extends ApiIntegrationTest {

    @Test
    void testWeightLogs_shouldBeInvisibleAcrossUsers_whenBothLog() {
        RegisteredUser anna = registerUser("Anna");
        RegisteredUser bela = registerUser("Béla");

        postForBody("/api/biometrics/weight", new LogWeightRequest(LocalDate.now(), new BigDecimal("61.0"), null),
            anna.headers(), HttpStatus.CREATED, WeightLogResponse.class);

        List<WeightLogResponse> belaSees = getForList("/api/biometrics/weight", bela.headers(), HttpStatus.OK, WeightLogResponse.class);
        assertThat(belaSees).isEmpty();
        List<WeightLogResponse> annaSees = getForList("/api/biometrics/weight", anna.headers(), HttpStatus.OK, WeightLogResponse.class);
        assertThat(annaSees).hasSize(1);
    }
}
