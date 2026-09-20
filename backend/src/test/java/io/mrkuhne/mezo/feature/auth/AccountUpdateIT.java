package io.mrkuhne.mezo.feature.auth;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.MeResponse;
import io.mrkuhne.mezo.support.ApiIntegrationTest;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;

class AccountUpdateIT extends ApiIntegrationTest {
    @Test
    void testUpdate_shouldCorrectCanonicalSourceAndKeepIdentity_whenValid() {
        var a = registerUser("account-a").headers();
        var b = registerUser("account-b").headers();
        var before = getForBody("/api/auth/me", a, HttpStatus.OK, MeResponse.class);
        var other = getForBody("/api/auth/me", b, HttpStatus.OK, MeResponse.class);
        var updated = putForBody("/api/auth/me", Map.of("name", "Új Név", "email", "NEW@TEST.LOCAL"),
                a, HttpStatus.OK, MeResponse.class);

        assertThat(updated.getId()).isEqualTo(before.getId());
        assertThat(updated.getRole()).isEqualTo(before.getRole());
        assertThat(updated.getName()).isEqualTo("Új Név");
        assertThat(updated.getEmail()).isEqualTo("new@test.local");
        assertThat(getForBody("/api/auth/me", a, HttpStatus.OK, MeResponse.class).getName()).isEqualTo("Új Név");
        assertThat(getForBody("/api/auth/me", b, HttpStatus.OK, MeResponse.class)).isEqualTo(other);
        String duplicate = putForBody("/api/auth/me", Map.of("name", "X", "email", other.getEmail()),
                a, HttpStatus.CONFLICT, String.class);
        assertHasRequestError(duplicate, "AUTH_EMAIL_TAKEN");
    }

    @Test
    void testUpdate_shouldRejectInvalidAndAnonymous_whenNotValid() {
        putForBody("/api/auth/me", Map.of("name", "X", "email", "x@test.local"),
                null, HttpStatus.UNAUTHORIZED, String.class);
        var headers = registerUser("account-validation").headers();
        putForBody("/api/auth/me", Map.of("name", " ", "email", "x@test.local"),
                headers, HttpStatus.BAD_REQUEST, String.class);
        putForBody("/api/auth/me", Map.of("name", "X", "email", "bad"),
                headers, HttpStatus.BAD_REQUEST, String.class);
    }
}
