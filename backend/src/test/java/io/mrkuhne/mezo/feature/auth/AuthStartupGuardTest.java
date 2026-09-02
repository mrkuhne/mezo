package io.mrkuhne.mezo.feature.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.catchThrowableOfType;

import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import org.junit.jupiter.api.Test;

class AuthStartupGuardTest {

    private static OwnerProperties props(String password, String secret) {
        return new OwnerProperties("owner@mezo.local", password, "Owner", secret);
    }

    @Test
    void testCheck_shouldThrow_whenStrictAndDefaultsActive() {
        SystemRuntimeErrorException ex = catchThrowableOfType(
            SystemRuntimeErrorException.class,
            () -> AuthStartupGuard.check(props("owner", AuthStartupGuard.DEFAULT_JWT_SECRET), true));

        assertThat(ex.getMessages()).hasSize(1);
        assertThat(ex.getMessages().get(0).getCode()).isEqualTo("INTERNAL_ERROR");
        assertThat(ex.getMessages().get(0).getMessage())
            .contains("owner-password")
            .contains("jwt-secret");
    }

    @Test
    void testCheck_shouldPass_whenStrictAndOverridden() {
        assertThatCode(() -> AuthStartupGuard.check(props("s3cret-pw", "a-real-32-byte-minimum-secret-value-xyz"), true))
            .doesNotThrowAnyException();
    }

    @Test
    void testCheck_shouldPass_whenNotStrict() {
        assertThatCode(() -> AuthStartupGuard.check(props("owner", AuthStartupGuard.DEFAULT_JWT_SECRET), false))
            .doesNotThrowAnyException();
    }
}
