package io.mrkuhne.mezo.feature.biometrics.sleep.dto;

import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDate;

public record LogSleepRequest(@NotNull LocalDate date, String bedtime, String wakeup,
    BigDecimal durationH, Integer quality, Integer awakenings, String note) {}
