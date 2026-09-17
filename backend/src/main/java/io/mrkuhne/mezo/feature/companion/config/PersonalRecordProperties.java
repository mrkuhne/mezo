package io.mrkuhne.mezo.feature.companion.config;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/** Limits for paginated complete personal source reads. */
@Validated
@ConfigurationProperties(prefix = "mezo.companion.personal-records")
public record PersonalRecordProperties(
        /** Maximum records per page; output budgets can reduce the actual page size. */
        @Min(1) @Max(20) int pageSize,
        /** Maximum literal search-string length. */
        @Min(1) @Max(2000) int queryMaxChars
) {}
