package io.mrkuhne.mezo.feature.auth;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/** Binds {@code mezo.auth.*} — see docs/references/configuration_conventions.md. */
@Validated
@ConfigurationProperties(prefix = "mezo.auth")
public record OwnerProperties(

    /** Seeded owner's login email (demodata profile creates this user). */
    @NotBlank @Email
    String ownerEmail,

    /** Seeded owner's password (dev default; override via MEZO_OWNER_PASSWORD). */
    @NotBlank
    String ownerPassword,

    /** Seeded owner's display name. */
    @NotBlank
    String ownerName,

    /** HS256 signing secret — must be at least 32 bytes (256 bits). */
    @NotBlank @Size(min = 32)
    String jwtSecret
) {
}
