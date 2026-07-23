package io.mrkuhne.mezo.feature.biometrics.sleep.config;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotEmpty;
import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/** Sleep screenshot extraction tuning (mezo.sleep-shot): caps + review threshold are config, never code. */
@Validated
@ConfigurationProperties(prefix = "mezo.sleep-shot")
public record SleepShotProperties(

    /** Service-level upload cap in bytes (container multipart caps sit above this). */
    @Min(1)
    int maxPhotoBytes,

    /** Accepted photo mime types. */
    @NotEmpty
    List<String> allowedMimeTypes,

    /** needsReview when confidence <= this (boundary-inclusive, house pattern). */
    @DecimalMin("0.0") @DecimalMax("1.0")
    double confidenceThreshold
) {}
