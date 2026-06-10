package io.mrkuhne.mezo.feature.biometrics.weight.dto;

import jakarta.validation.constraints.Digits;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.math.BigDecimal;
import java.time.LocalDate;

public record LogWeightRequest(@NotNull LocalDate date,
    @NotNull @Positive @Digits(integer = 3, fraction = 2) BigDecimal weightKg, String note) {}
