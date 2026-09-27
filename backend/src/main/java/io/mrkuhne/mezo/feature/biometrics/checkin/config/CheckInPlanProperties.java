package io.mrkuhne.mezo.feature.biometrics.checkin.config;

import io.mrkuhne.mezo.feature.biometrics.checkin.service.CheckInItem;
import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.Map;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * Check-in 2.0 question plan (mezo-ck2, spec §2.2–2.3) — {@code mezo.checkin.plan}. Trimming or
 * reordering a slot's questions is a config change + deploy, no frontend release.
 */
@Validated
@ConfigurationProperties(prefix = "mezo.checkin.plan")
public record CheckInPlanProperties(
    /** Slot time ("06:30") → the items asked in that slot, in ask order (core five first). */
    @NotNull @Size(min = 1) Map<String, @Valid Slot> slots,
    /** The question of the day (one adaptive item per check-in). */
    @NotNull @Valid Adaptive adaptive
) {
    /** One slot's plan. */
    public record Slot(@NotNull @Size(min = 1) List<@NotNull CheckInItem> items) {}

    /** Question-of-the-day tuning. */
    public record Adaptive(
        /** Share of check-ins whose adaptive item is drawn uniformly at random (planned-missingness guard). */
        @NotNull @DecimalMin("0.0") @DecimalMax("1.0") Double randomShare,
        /** Days of history (before the check-in's date) counted when looking for the thinnest series. */
        @NotNull @Min(1) @Max(365) Integer needWindowDays,
        /** Items only meaningful in one slot (rested → morning, day → evening): item → slot time. */
        @NotNull Map<CheckInItem, String> onlyInSlot,
        /** "Why" sentence of a need-driven pick; {@code {item}} = the item's phrase ("az éhséged"). */
        @NotBlank String whyNeed,
        /** "Why" sentence of a random pick. */
        @NotBlank String whyRandom
    ) {}
}
