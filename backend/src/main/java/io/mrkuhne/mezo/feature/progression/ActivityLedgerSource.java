package io.mrkuhne.mezo.feature.progression;

import java.time.LocalDate;
import java.util.UUID;

/**
 * Port for the activity-log inputs of growth aggregates (savings + entry counts): progression
 * only needs the numbers; HOW they are stored belongs to feature/activity, which implements this
 * ({@code feature/activity/service/ActivityLedgerAdapter}) — dependency stays activity →
 * progression, never back (feature_slices_are_cycle_free). Bean exists only when the activity
 * switch is on; consume via ObjectProvider.
 */
public interface ActivityLedgerSource {

    record Stats(int entries, long savingsHuf) {}

    /** Entries dated in [from, to] + the sum of financial entries' extracted amountHuf. */
    Stats stats(UUID createdBy, LocalDate from, LocalDate to);
}
