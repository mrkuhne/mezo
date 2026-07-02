package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.fuel.entity.SupplementIntakeEntity;
import io.mrkuhne.mezo.feature.fuel.repository.SupplementIntakeRepository;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;

/** Test data factory for the SupplementIntake ledger — persists via {@code saveAndFlush} so DB CHECKs fire. */
@TestComponent
@RequiredArgsConstructor
public class SupplementIntakePopulator {

    private final SupplementIntakeRepository repository;

    /**
     * One logged supplement intake of {@code pantryItemId} at {@code takenAt}: {@code takenDate} is
     * the denormalized UTC day key derived from {@code takenAt}.
     */
    public SupplementIntakeEntity createIntake(UUID owner, UUID pantryItemId, Instant takenAt) {
        SupplementIntakeEntity e = new SupplementIntakeEntity();
        e.setCreatedBy(owner);
        e.setPantryItemId(pantryItemId);
        e.setTakenAt(takenAt);
        e.setTakenDate(LocalDate.ofInstant(takenAt, ZoneOffset.UTC));
        return repository.saveAndFlush(e);
    }
}
