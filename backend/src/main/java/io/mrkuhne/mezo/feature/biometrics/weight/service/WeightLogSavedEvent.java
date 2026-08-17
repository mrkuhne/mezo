package io.mrkuhne.mezo.feature.biometrics.weight.service;

import java.time.LocalDate;
import java.util.UUID;

/**
 * Published by {@link WeightLogService#log} right before returning (inside the {@code
 * @Transactional} method, so an {@code AFTER_COMMIT} listener sees it only once the weight row is
 * durable). Consumed by {@code CompanionMessageEventListener} to trigger the weight-reaction
 * companion message.
 */
public record WeightLogSavedEvent(UUID userId, LocalDate date) {
}
