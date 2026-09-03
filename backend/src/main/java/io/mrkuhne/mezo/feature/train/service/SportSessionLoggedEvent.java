package io.mrkuhne.mezo.feature.train.service;

import java.time.LocalDate;
import java.util.UUID;

/**
 * Published by {@link SportService#logSportSession} inside its {@code @Transactional} method, so an
 * {@code AFTER_COMMIT} listener sees it only once the session row is durable — the
 * {@code CheckInSavedEvent} precedent (mezo-iizd.7, spec D-4). Consumed by the life-goal
 * {@code LifeGoalTriggerListener}: a logged sport session is the {@code sport_session_logged}
 * ha–akkor trigger. The train feature knows nothing about life goals.
 */
public record SportSessionLoggedEvent(UUID userId, LocalDate date) {
}
