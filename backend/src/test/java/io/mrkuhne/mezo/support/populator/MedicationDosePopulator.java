package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.medication.entity.MedicationDoseEntity;
import io.mrkuhne.mezo.feature.medication.repository.MedicationDoseRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;

/** Test data factory for the MedicationDose ledger — persists via {@code saveAndFlush} so DB CHECKs fire. */
@TestComponent
@RequiredArgsConstructor
public class MedicationDosePopulator {

    private final MedicationDoseRepository repository;

    /**
     * One logged intake of {@code medId} on {@code date}: {@code administeredAt} is the UTC
     * start-of-day instant, {@code administeredDate} the denormalized day key.
     */
    public MedicationDoseEntity createDose(UUID owner, UUID medId, LocalDate date, BigDecimal dose) {
        MedicationDoseEntity e = new MedicationDoseEntity();
        e.setCreatedBy(owner);
        e.setMedicationId(medId);
        e.setAdministeredAt(date.atStartOfDay(ZoneOffset.UTC).toInstant());
        e.setAdministeredDate(date);
        e.setDose(dose);
        return repository.saveAndFlush(e);
    }
}
