package io.mrkuhne.mezo.feature.biometrics.checkin.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import java.time.LocalDate;

public record SaveCheckInRequest(@NotNull LocalDate date, @NotBlank String slotTime,
    @NotBlank @Pattern(regexp = "done|now|skipped|pending") String state,
    @Min(1) @Max(10) Integer energy, @Min(1) @Max(10) Integer stress,
    @Min(1) @Max(10) Integer body, @Min(1) @Max(10) Integer mental, String note) {}
