package io.mrkuhne.mezo.feature.biometrics.sleep.service;

import java.time.LocalDate;
import java.util.UUID;

/**
 * Published by {@link SleepLogService#log} right before returning (inside the {@code
 * @Transactional} method, so an {@code AFTER_COMMIT} listener sees it only once the sleep row is
 * durable). Consumed by {@code CompanionMessageEventListener} to trigger the sleep-reaction
 * companion message.
 */
public record SleepLogSavedEvent(UUID userId, LocalDate date) {
}
