package io.mrkuhne.mezo.feature.biometrics.sleep.dto;

import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import java.math.BigDecimal;
import java.time.LocalDate;

public record LogSleepRequest(@NotNull LocalDate date, String bedtime, String wakeup,
    @Positive @Digits(integer = 2, fraction = 2) BigDecimal durationH,
    @Min(1) @Max(10) Integer quality, @PositiveOrZero Integer awakenings, String note) {}
