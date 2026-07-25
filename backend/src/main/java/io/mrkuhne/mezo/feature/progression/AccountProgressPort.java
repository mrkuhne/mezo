package io.mrkuhne.mezo.feature.progression;

import java.time.LocalDate;
import java.util.UUID;

/**
 * Port for the gamification ledger's XP-awarded hook: progression only needs to notify that a new
 * event was recorded, on which business date; HOW that fans out into coins/streaks belongs to the
 * feature that owns the ledger — feature/gamification implements this in a later task (mezo-huzd),
 * which keeps the package dependency one-directional: gamification → progression, never back.
 * Bean exists only once that feature is wired in; consume via ObjectProvider (absent bean → no-op).
 */
public interface AccountProgressPort {

    /** Fired once per newly-created level_up_event — never on the idempotent replay path. */
    void onXpAwarded(UUID createdBy, String sourceType, UUID sourceRefId, LocalDate occurredOn);
}
