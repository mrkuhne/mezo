package io.mrkuhne.mezo.feature.admin.config;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.math.BigDecimal;
import java.time.Duration;
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
 *
 * <p>{@code artifactFeatureMap} (mezo-l096.1) says, for every companion-feedback
 * {@code artifact_kind}, which feature slug it counts under on the Funkciók scorecard —
 * e.g. {@code message_feedback} rows with {@code artifact_kind=chat_message} roll up under
 * the {@code companion_chat} feature. The seven default pairs were verified against the real
 * generation call sites (recon 2026-09-08); keys are {@code artifact_kind} values, values are
 * feature slugs as they appear in {@code llm_log_history.feature} / the domain featureMap.
 */
@Validated
@ConfigurationProperties(prefix = "mezo.admin")
public record AdminProperties(
        @NotNull @Valid Browser browser,
        @NotEmpty Map<String, @Valid FeatureSource> featureMap,
        @NotEmpty Map<String, @NotBlank String> artifactFeatureMap,
        @NotNull ZoneId reportZone,
        @NotNull Duration statementTimeout,
        @NotNull @Valid Alerts alerts) {

    /** Data-browser limits. */
    public record Browser(@Positive int maxPageSize) {}

    /** Where a feature's usage is recorded. */
    public record FeatureSource(@NotBlank String table, @NotBlank String timestampColumn) {}

    /** {@code statementTimeout} in the form Postgres accepts after {@code SET LOCAL} — same
     *  derived-accessor idiom as {@code AdminMemoryProperties#statementTimeoutSql}. */
    public String statementTimeoutSql() {
        return statementTimeout.toMillis() + "ms";
    }

    /** Owner status-band alert rule thresholds (mezo-kjwa). */
    public record Alerts(
            @Positive double costSpikeFactor,
            @Positive BigDecimal costSpikeMinUsd,
            @Positive int llmErrorRatePct,
            @Positive int llmErrorMinCalls,
            @Positive int jobMissedAfterHours,
            @Positive int testerQuietDays) {}
}
