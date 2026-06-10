package io.mrkuhne.mezo.feature.biometrics.weight.dto;

import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDate;

public record LogWeightRequest(@NotNull LocalDate date, @NotNull BigDecimal weightKg, String note) {}
