package io.mrkuhne.mezo.feature.companion.config;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * Weekly review (mezo-p2tr) — the deterministic {@code DayScoreService} formula's tuning knobs.
 *
 * <p>Feature-scoped record rather than another {@code CompanionProperties} nested component (the
 * {@code ProfileProperties}/{@code QuarterlyProperties} precedent — {@code CompanionProperties} is
 * already many components deep). Picked up by {@code @ConfigurationPropertiesScan}.
 *
 * @param sleepTargetH how many hours of sleep counts as "full" for the sleep subscore's duration
 *                     ratio ({@code min(1, durationH / sleepTargetH)}).
 * @param kcalBand     the fractional band around the day's kcal target inside which fuel-closeness
 *                     stays positive ({@code 1 - |kcal/target - 1| / kcalBand}, floored at 0).
 * @param xpBaseline   the daily XP total that alone (without a logged workout) counts as a "full"
 *                     activity day.
 */
@Validated
@ConfigurationProperties(prefix = "mezo.companion.me-week")
public record MeWeekProperties(
    @DecimalMin("0.1") @DecimalMax("24.0") double sleepTargetH,
    @DecimalMin("0.01") @DecimalMax("1.0") double kcalBand,
    @Min(1) @Max(10000) int xpBaseline
) {
}
