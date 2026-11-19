package io.mrkuhne.mezo.feature.companion.flags.service;

import java.time.LocalDate;
import java.util.Set;
import java.util.UUID;

/**
 * Companion-owned read seam (ADR 0012 consumer-owned-port idiom, mirroring
 * {@code journal.service.DecisionContextPort}) for sent pushes: {@code IgnoredNudgeRule} depends
 * on this, never directly on a push sender's log, so companion never imports a push slice.
 *
 * <p>No adapter exists today: its only supplier read the browser web push log, which left with
 * the web app (mezo-r36n9.97.7). A future push sender (APNs) supplies one again. Until then the
 * rule consumes this through an {@code ObjectProvider} and degrades to {@code NOTIFICATIONS_OFF} —
 * it can never know whether a push was actually sent, and per spec §7 (never estimate) that
 * unknown must stay a gate, not an assumption.
 */
public interface NudgeSendPort {

    /** Distinct {@code push_log.log_date} values on which {@code category} was sent to {@code
     *  userId} within the inclusive range {@code [from, to]}. */
    Set<LocalDate> sentDates(UUID userId, String category, LocalDate from, LocalDate to);
}
