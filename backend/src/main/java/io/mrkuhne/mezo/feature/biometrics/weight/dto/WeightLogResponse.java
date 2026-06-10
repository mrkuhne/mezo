package io.mrkuhne.mezo.feature.biometrics.weight.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;

public record WeightLogResponse(UUID id, LocalDate date, BigDecimal value, String note) {}
