package io.mrkuhne.mezo.techcore.security;

import jakarta.validation.constraints.NotEmpty;
import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * Binds {@code mezo.cors.*} — see docs/references/configuration_conventions.md.
 *
 * <p>Drives the browser CORS policy: server-to-server callers send no {@code Origin} and are
 * unaffected, but every browser fetch from the frontend dev/prod origin needs the origin to be
 * listed here or the preflight is rejected.
 */
@Validated
@ConfigurationProperties(prefix = "mezo.cors")
public record CorsProperties(

    /** Browser origins allowed to call the API (e.g. the Vite dev server). Must be non-empty. */
    @NotEmpty
    List<String> allowedOrigins
) {
}
