package io.mrkuhne.mezo.feature.companion.flags.service;

import java.time.LocalDate;
import java.util.Set;
import java.util.UUID;

/**
 * Companion-owned read seam (ADR 0012 consumer-owned-port idiom, mirroring
 * {@code journal.service.DecisionContextPort}) for {@code push_log} sends: {@code
 * IgnoredNudgeRule} depends on this, never directly on notification's {@code PushLogRepository}
 * — a direct import would close a {@code companion ↔ notification} feature-slice cycle
 * (notification's {@code AnchorResolver} already imports {@code CompanionProperties}, so
 * companion already sits downstream of notification in that direction), which {@code
 * ArchitectureTest.feature_slices_are_cycle_free} rejects as a NEW cycle rather than freezing it.
 *
 * <p>The notification feature supplies the adapter, gated on {@code NOTIFICATION_SWITCH}; with
 * notification off there is no bean, so the rule consumes this through an {@code ObjectProvider}
 * and degrades to silence — it can never know whether a push was actually sent, and per spec §7
 * (never estimate) that unknown must stay a gate, not an assumption.
 */
public interface NudgeSendPort {

    /** Distinct {@code push_log.log_date} values on which {@code category} was sent to {@code
     *  userId} within the inclusive range {@code [from, to]}. */
    Set<LocalDate> sentDates(UUID userId, String category, LocalDate from, LocalDate to);
}
