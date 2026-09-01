package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.fuel.entity.SupplementIntakeEntity;
import io.mrkuhne.mezo.feature.fuel.repository.SupplementIntakeRepository;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
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
     * the wall-clock day of {@code takenAt} in the system zone — FE-faithful (the FE always sends
     * an offset-bearing takenAt, so a prod row's day key IS the local calendar day; a UTC-derived
     * key would fabricate rows that cannot exist and breaks "today" asserts in the 00:00–02:00
     * local window).
     */
    public SupplementIntakeEntity createIntake(UUID owner, UUID pantryItemId, Instant takenAt) {
        SupplementIntakeEntity e = new SupplementIntakeEntity();
        e.setCreatedBy(owner);
        e.setPantryItemId(pantryItemId);
        e.setTakenAt(takenAt);
        e.setTakenDate(LocalDate.ofInstant(takenAt, ZoneId.systemDefault()));
        return repository.saveAndFlush(e);
    }

    /** One logged intake anchored at noon local time on {@code date}, with a slot key — for tests
     *  that reason about the calendar day directly rather than a precise instant. */
    public SupplementIntakeEntity createIntake(UUID owner, UUID pantryItemId, LocalDate date, String slotKey) {
        SupplementIntakeEntity e = new SupplementIntakeEntity();
        e.setCreatedBy(owner);
        e.setPantryItemId(pantryItemId);
        e.setTakenAt(date.atTime(12, 0).atZone(ZoneId.systemDefault()).toInstant());
        e.setTakenDate(date);
        e.setSlotKey(slotKey);
        return repository.saveAndFlush(e);
    }
}
