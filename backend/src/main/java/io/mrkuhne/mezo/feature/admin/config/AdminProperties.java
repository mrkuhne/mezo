package io.mrkuhne.mezo.feature.admin.config;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.time.ZoneId;
import java.util.Map;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * {@code mezo.admin} — the admin hub's tuning knobs (mezo-d5iy).
 *
 * <p>{@code featureMap} says, for every non-LLM feature, which owned table proves that the
 * feature was used and which column carries the moment of use. The column may be a SQL
 * {@code date} or a {@code timestamp}; the SQL-dialect helper that reads this map picks the
 * day expression from the catalog's type, so both shapes are legal.
 */
@Validated
@ConfigurationProperties(prefix = "mezo.admin")
public record AdminProperties(
        @NotNull @Valid Browser browser,
        @NotEmpty Map<String, @Valid FeatureSource> featureMap,
        @NotNull ZoneId reportZone) {

    /** Data-browser limits. */
    public record Browser(@Positive int maxPageSize) {}

    /** Where a feature's usage is recorded. */
    public record FeatureSource(@NotBlank String table, @NotBlank String timestampColumn) {}
}
