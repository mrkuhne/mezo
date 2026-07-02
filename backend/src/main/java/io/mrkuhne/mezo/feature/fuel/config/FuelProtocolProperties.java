package io.mrkuhne.mezo.feature.fuel.config;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * Binds {@code mezo.fuel.protocol.*} — see docs/references/configuration_conventions.md.
 *
 * <p>{@code defaultConfidence} is the deterministic-era protocol confidence surfaced as the Stack
 * page 'conf' badge. Phase 3 (P8) replaces it with a computed value; until then it is config,
 * never hardcoded in code.
 */
@Validated
@ConfigurationProperties(prefix = "mezo.fuel.protocol")
public record FuelProtocolProperties(

    @NotNull @DecimalMin("0") @DecimalMax("1") BigDecimal defaultConfidence
) {
}
