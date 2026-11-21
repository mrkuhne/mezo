package io.mrkuhne.mezo.feature.capacity.service;

import io.mrkuhne.mezo.api.dto.PlannedSkipKind;
import io.mrkuhne.mezo.api.dto.PlannedSkipReason;
import io.mrkuhne.mezo.api.dto.PlannedSkipRequest;
import io.mrkuhne.mezo.feature.capacity.port.CapacitySkipPort;
import io.mrkuhne.mezo.feature.train.repository.PlannedSkipRepository;
import io.mrkuhne.mezo.feature.train.service.PlannedSkipService;
import java.time.LocalDate;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * {@link CapacitySkipPort} over train's own planned-skip service (Kihagyás path): the skip is an ordinary GYM row with
 * reason {@code KAPACITAS}, written and removed by {@link PlannedSkipService} inside the ledger's transaction.
 */
@Component
@RequiredArgsConstructor
public class CapacitySkipAdapter implements CapacitySkipPort {

    private final PlannedSkipService skips;
    private final PlannedSkipRepository skipRows;

    @Override
    public boolean gymSkipped(UUID owner, LocalDate date) {
        return skips.isGymSkipped(owner, date);
    }

    @Override
    public UUID skipGym(UUID owner, LocalDate date) {
        return skips.upsert(owner, new PlannedSkipRequest()
            .date(date)
            .kind(PlannedSkipKind.GYM)
            .reasonCategory(PlannedSkipReason.KAPACITAS)).getId();
    }

    @Override
    public void undoSkip(UUID owner, UUID skipId) {
        // Look first: train's undo throws 404 on a missing row, which would mark the ledger's transaction rollback-only.
        if (skipRows.findByIdAndCreatedByAndDeletedFalse(skipId, owner).isPresent()) {
            skips.undo(owner, skipId);
        }
    }
}
