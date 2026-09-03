package io.mrkuhne.mezo.feature.train.service;

import java.util.UUID;

/**
 * Published by {@link WorkoutService#finishWorkout} right after the session's completion write
 * ({@code finishedAt} set, status {@code completed}) — a plain {@code publishEvent} INSIDE the
 * writing transaction, unconditionally (mirrors {@code ChatService} publishing
 * {@code ChatTurnCompleted}: the feature gate lives on the CONSUMER, {@code
 * TimingProfileListener}'s {@code @ConditionalOnProperty}, not on this publish call).
 *
 * <p>The commit boundary is therefore the consumer's responsibility, same as {@link
 * io.mrkuhne.mezo.feature.ritual.service.RitualClosedEvent}: {@code TimingProfileListener}
 * consumes this AFTER_COMMIT, never as a plain {@code @EventListener} — REQUIRED-joining
 * {@code TimingProfileService.learnFrom} directly from inside {@code finishWorkout}'s own
 * transaction was tried and rejected (mezo-dzbm): Spring marks a PARTICIPATING transaction
 * rollback-only the instant any exception escapes a joined {@code @Transactional} callee,
 * regardless of whether that callee ever touched the database, so a {@code try/catch} around a
 * synchronous call cannot stop a profile-learning bug from taking the user's completed workout
 * down with it. Publishing this event and consuming it AFTER_COMMIT instead means: by the time
 * the listener runs, {@code finishedAt} is committed and visible (a fresh transaction reads it
 * fine), and because the finish transaction has ALREADY committed, nothing the listener does or
 * throws can roll the completion back. In a rolled-back test transaction the event never fires,
 * by design (mirrors {@code ChatTurnCompleted}).
 */
public record WorkoutFinishedEvent(UUID createdBy, UUID workoutSessionId) {
}
