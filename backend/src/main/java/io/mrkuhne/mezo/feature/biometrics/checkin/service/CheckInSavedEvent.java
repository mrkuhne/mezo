package io.mrkuhne.mezo.feature.biometrics.checkin.service;

import java.time.LocalDate;
import java.util.UUID;

/**
 * Published by {@link CheckInService#save} inside its {@code @Transactional} method, so an
 * {@code AFTER_COMMIT} listener sees it only once the check-in row is durable — the
 * {@code SleepLogSavedEvent} precedent. Consumed by the companion's W5.1
 * {@code FlagEvaluationListener} (bd mezo-b3pp.18): a fresh check-in is the strongest single
 * trigger for the stress/recovery rules. The check-in feature knows nothing about flags.
 */
public record CheckInSavedEvent(UUID userId, LocalDate date) {
}
