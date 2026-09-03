package io.mrkuhne.mezo.feature.auth;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Binds {@code mezo.auth.strict}. Kept as a separate record from {@link OwnerProperties} —
 * both bind independently against the {@code mezo.auth} prefix; Spring Boot's relaxed binder
 * has no trouble with two {@code @ConfigurationProperties} beans sharing a prefix as long as
 * each only reads the keys it declares (verified against {@code AuthControllerIT} /
 * {@code OwnerSeedDataIT} context boot — see task-7-report.md).
 */
@ConfigurationProperties(prefix = "mezo.auth")
public record AuthProperties(boolean strict) {
}
