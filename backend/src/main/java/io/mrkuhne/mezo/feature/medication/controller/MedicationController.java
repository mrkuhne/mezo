package io.mrkuhne.mezo.feature.medication.controller;

import io.mrkuhne.mezo.api.controller.MedicationApi;
import io.mrkuhne.mezo.api.dto.MedicationDayResponse;
import io.mrkuhne.mezo.api.dto.MedicationDoseRequest;
import io.mrkuhne.mezo.api.dto.MedicationDoseResponse;
import io.mrkuhne.mezo.api.dto.MedicationRequest;
import io.mrkuhne.mezo.api.dto.MedicationResponse;
import io.mrkuhne.mezo.feature.medication.service.MedicationService;
import io.mrkuhne.mezo.techcore.security.CurrentUserId;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.RestController;

/**
 * Implements the generated {@link MedicationApi}; HTTP mappings, status codes and {@code @Valid}
 * come from the interface. Thin owner-scoped delegation to {@link MedicationService}, passing the
 * principal's id from {@link CurrentUserId} (never from the client) — mirrors {@code MealController}.
 */
@RestController
@RequiredArgsConstructor
public class MedicationController implements MedicationApi {

    private final MedicationService medicationService;
    private final CurrentUserId currentUserId;

    @Override
    public MedicationDayResponse getMedicationDay() {
        return medicationService.getDay(currentUserId.get());
    }

    @Override
    public MedicationDoseResponse logDose(UUID id, MedicationDoseRequest medicationDoseRequest) {
        return medicationService.logDose(currentUserId.get(), id, medicationDoseRequest);
    }

    @Override
    public void deleteDose(UUID id, UUID doseId) {
        medicationService.deleteDose(currentUserId.get(), id, doseId);
    }

    @Override
    public MedicationResponse updateMedication(UUID id, MedicationRequest medicationRequest) {
        return medicationService.updateMedication(currentUserId.get(), id, medicationRequest);
    }
}
