package io.mrkuhne.mezo.feature.biometrics.checkin.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.time.LocalDate;

public record SaveCheckInRequest(@NotNull LocalDate date, @NotBlank String slotTime, @NotBlank String state,
    Integer energy, Integer stress, Integer body, Integer mental, String note) {}
