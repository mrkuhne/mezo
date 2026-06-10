package io.mrkuhne.mezo.feature.biometrics.checkin.dto;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record CheckInResponse(UUID id, LocalDate date, String slotTime, String state,
    Integer energy, Integer stress, Integer body, Integer mental, String note, Instant savedAt) {}
