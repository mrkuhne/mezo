package io.mrkuhne.mezo.feature.biometrics.sleep.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public record SleepLogResponse(UUID id, LocalDate date, String bedtime, String wakeup,
    BigDecimal duration, Integer quality, Integer awakenings, int mealToSleep, String notes) {}
