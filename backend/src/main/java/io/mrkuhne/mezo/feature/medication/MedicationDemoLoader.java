package io.mrkuhne.mezo.feature.medication;

import io.mrkuhne.mezo.feature.auth.OwnerProperties;
import io.mrkuhne.mezo.feature.auth.entity.AppUserEntity;
import io.mrkuhne.mezo.feature.auth.repository.AppUserRepository;
import io.mrkuhne.mezo.feature.medication.entity.MedicationCycleJson;
import io.mrkuhne.mezo.feature.medication.entity.MedicationCycleJson.Phase;
import io.mrkuhne.mezo.feature.medication.entity.MedicationDoseEntity;
import io.mrkuhne.mezo.feature.medication.entity.MedicationEntity;
import io.mrkuhne.mezo.feature.medication.repository.MedicationDoseRepository;
import io.mrkuhne.mezo.feature.medication.repository.MedicationRepository;
import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.time.temporal.TemporalAdjusters;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Seeds the owner's Fuel "Gyógyszer" slice on startup with the Retatrutide medication (7-day cycle:
 * peak 1-2 / stable 3-5 / trough 6-7, default dose 6 mg) plus ONE logged dose on the most recent
 * Monday on-or-before today, so the running app shows a real {@code retaDay} 1-7 (mirrors
 * {@link io.mrkuhne.mezo.feature.pantry.PantryCatalogLoader}). {@code @Profile("demodata")} — the
 * profile prod runs — so the seed lands in prod for the single owner. Idempotent: only seeds when the
 * owner has no active medication, so a restart never duplicates and a user who has since curated their
 * own entry is left untouched. Runs after {@link io.mrkuhne.mezo.feature.auth.OwnerSeedData} (Order 0)
 * so the owner exists.
 */
@Component
@Profile("demodata")
@Order(70)
@RequiredArgsConstructor
public class MedicationDemoLoader implements CommandLineRunner {

    private final MedicationRepository medicationRepository;
    private final MedicationDoseRepository doseRepository;
    private final AppUserRepository appUserRepository;
    private final OwnerProperties ownerProperties;

    @Override
    @Transactional
    public void run(String... args) {
        AppUserEntity owner = appUserRepository.findByEmail(ownerProperties.ownerEmail()).orElse(null);
        if (owner == null) {
            return; // no owner yet (non-demodata path) — nothing to seed
        }
        UUID ownerId = owner.getId();
        if (medicationRepository.findFirstByCreatedByAndActiveTrueAndDeletedFalse(ownerId).isPresent()) {
            return; // owner already has an active medication — leave it untouched (idempotent)
        }
        MedicationEntity med = medicationRepository.save(reta(ownerId));
        doseRepository.save(recentMondayDose(ownerId, med.getId()));
    }

    /** The Retatrutide catalog row: 7-day cycle (peak 1-2 / stable 3-5 / trough 6-7), 6 mg, active. */
    private MedicationEntity reta(UUID ownerId) {
        MedicationEntity e = new MedicationEntity();
        e.setCreatedBy(ownerId);
        e.setName("Retatrutide");
        e.setActiveIngredient("retatrutide");
        e.setRoute("subQ");
        e.setCadence("weekly");
        e.setDefaultDose(new BigDecimal("6"));
        e.setDoseUnit("mg");
        e.setActive(true);
        e.setCycle(new MedicationCycleJson(7, List.of(
            new Phase("peak", 1, 2, "Csúcs"),
            new Phase("stable", 3, 5, "Stabil"),
            new Phase("trough", 6, 7, "Mélypont"))));
        return e;
    }

    /**
     * One 6 mg intake on the most recent Monday on-or-before today (08:00 UTC), so the derived
     * retaDay — days-since-last-dose + 1 — lands in 1-7 for the demo.
     */
    private MedicationDoseEntity recentMondayDose(UUID ownerId, UUID medicationId) {
        LocalDate monday = LocalDate.now(ZoneOffset.UTC)
            .with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
        MedicationDoseEntity d = new MedicationDoseEntity();
        d.setCreatedBy(ownerId);
        d.setMedicationId(medicationId);
        d.setAdministeredAt(monday.atTime(8, 0).toInstant(ZoneOffset.UTC));
        d.setAdministeredDate(monday);
        d.setDose(new BigDecimal("6"));
        return d;
    }
}
