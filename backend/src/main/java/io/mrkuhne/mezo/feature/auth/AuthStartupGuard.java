package io.mrkuhne.mezo.feature.auth;

import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.util.ArrayList;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

/**
 * mezo-5h9: with {@code mezo.auth.strict=true} (set in the k8s deployment) the app refuses to
 * start while the dev defaults for the owner password or the JWT secret are still active.
 * Runs before every seed runner ({@link OwnerSeedData} is {@code @Order(0)}).
 */
@Component
@Order(-1)
@RequiredArgsConstructor
public class AuthStartupGuard implements CommandLineRunner {

    static final String DEFAULT_OWNER_PASSWORD = "owner";
    static final String DEFAULT_JWT_SECRET = "dev-only-change-me-32-bytes-minimum-secret";

    private final OwnerProperties ownerProperties;
    private final AuthProperties authProperties;

    @Override
    public void run(String... args) {
        check(ownerProperties, authProperties.strict());
    }

    static void check(OwnerProperties props, boolean strict) {
        if (!strict) return;
        List<String> offending = new ArrayList<>();
        if (DEFAULT_OWNER_PASSWORD.equals(props.ownerPassword())) offending.add("mezo.auth.owner-password");
        if (DEFAULT_JWT_SECRET.equals(props.jwtSecret())) offending.add("mezo.auth.jwt-secret");
        if (!offending.isEmpty()) {
            // code stays the short, stable, enum-like lookup token every other SystemMessage.error()
            // call site uses (GlobalExceptionHandler.resolve() looks it up in messages.properties,
            // the frontend switches on it) — the offending-keys detail lives only in .message().
            String detail = "mezo.auth.strict=true but dev defaults are active for: " + String.join(", ", offending);
            throw new SystemRuntimeErrorException(SystemMessage.error("INTERNAL_ERROR")
                .message(detail)
                .build());
        }
    }
}
