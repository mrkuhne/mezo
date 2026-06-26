package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.medication.entity.MedicationCycleJson;
import io.mrkuhne.mezo.feature.medication.entity.MedicationCycleJson.Phase;
import io.mrkuhne.mezo.feature.medication.entity.MedicationEntity;
import io.mrkuhne.mezo.feature.medication.repository.MedicationRepository;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;

/** Test data factory for the Medication aggregate — persists via {@code saveAndFlush} so DB CHECKs fire. */
@TestComponent
@RequiredArgsConstructor
public class MedicationPopulator {

    private final MedicationRepository repository;

    /**
     * A Retatrutide catalog row with a 7-day cycle partitioned into peak (1-2) / stable (3-5) /
     * trough (6-7), active, default dose 6 mg.
     */
    public MedicationEntity createReta(UUID owner) {
        MedicationEntity e = new MedicationEntity();
        e.setCreatedBy(owner);
        e.setName("Retatrutide");
        e.setActiveIngredient("retatrutide");
        e.setRoute("subcutaneous");
        e.setCadence("weekly");
        e.setDefaultDose(new BigDecimal("6"));
        e.setDoseUnit("mg");
        e.setActive(true);
        e.setCycle(new MedicationCycleJson(7, List.of(
            new Phase("peak", 1, 2, "Csúcs"),
            new Phase("stable", 3, 5, "Stabil"),
            new Phase("trough", 6, 7, "Mélypont"))));
        return repository.saveAndFlush(e);
    }
}
