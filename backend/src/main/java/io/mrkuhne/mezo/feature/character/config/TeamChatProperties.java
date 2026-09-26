package io.mrkuhne.mezo.feature.character.config;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.ZoneId;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/** Csapatfal Act III team chat tuning (mezo-a9bo7.21, spec 2026-09-26 §5). */
@Validated
@ConfigurationProperties(prefix = "mezo.character.team-chat")
public record TeamChatProperties(
        /** The user's local day (daily line cap, push budget). */ @NotNull ZoneId zone,
        /** An ügy still OPEN after this many days is closed as EXPIRED. */ @Min(1) @Max(60) int expireAfterDays,
        /** Character lines per user per local day, all kinds. */ @Min(1) @Max(100) int dailyLineCap,
        /** Pushes per user per local day. */ @Min(0) @Max(10) int maxPushesPerDay,
        /** team_chat LLM spend cap per user over the last 30 days. */
        @NotNull @DecimalMin("0.00") BigDecimal monthlyUsdCap,
        /** The expiry sweep's schedule. */ @NotBlank String expiryCron,
        /** Task 11 (mezo-a9bo7.23): the hourly catch-up sweep's schedule. */
        @NotBlank String catchupCron) {}
