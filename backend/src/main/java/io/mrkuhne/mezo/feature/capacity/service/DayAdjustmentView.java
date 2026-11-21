package io.mrkuhne.mezo.feature.capacity.service;

import io.mrkuhne.mezo.feature.capacity.entity.AdjustmentState;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

/**
 * One ledger row as its readers see it (Boop B7 K3, mezo-r36n9.17): typed payload, state enum. {@code date} is the day
 * the row is filed under ({@link AdjustmentPayload#day()}); a move also touches its {@code toDate}.
 */
public record DayAdjustmentView(UUID id, LocalDate date, AdjustmentPayload payload, UUID bundleId, UUID proposalId,
                                AdjustmentState state, String reason, Instant createdAt) {

    /** True when this row changes {@code day} (a move changes both of its days). */
    public boolean touches(LocalDate day) {
        return payload.touchedDays().contains(day);
    }
}
