package io.mrkuhne.mezo.feature.medication.service;

import io.mrkuhne.mezo.api.dto.MedicationDayResponse;
import io.mrkuhne.mezo.api.dto.MedicationDoseRequest;
import io.mrkuhne.mezo.api.dto.MedicationDoseResponse;
import io.mrkuhne.mezo.api.dto.MedicationRequest;
import io.mrkuhne.mezo.api.dto.MedicationResponse;
import io.mrkuhne.mezo.feature.medication.entity.MedicationDoseEntity;
import io.mrkuhne.mezo.feature.medication.entity.MedicationEntity;
import io.mrkuhne.mezo.feature.medication.mapper.MedicationMapper;
import io.mrkuhne.mezo.feature.medication.repository.MedicationDoseRepository;
import io.mrkuhne.mezo.feature.medication.repository.MedicationRepository;
import io.mrkuhne.mezo.feature.medication.service.dto.MedicationCycle;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Owner-scoped logic for the Fuel "Gyógyszer" slice over the {@code medication} catalog +
 * {@code medication_dose} append-only ledger. Mirrors {@code MealService}: a
 * {@code @Service @RequiredArgsConstructor} with method-level {@code @Transactional}, a
 * {@code requireOwned*} 404 ownership gate, server-side date stamping for the write-path, and the
 * {@code VALIDATION_INVALID_VALUE} field-error idiom.
 *
 * <p>The single-user slice tracks ONE active medication at a time. {@link #getDay} resolves that
 * active row (404 if the owner has none), {@link MedicationCycleService#derive derives} where they
 * sit in the cycle TODAY, and assembles the day payload with the recent intake ledger. Each
 * logged dose is server-stamped: {@code createdBy} from the principal, {@code administeredAt}
 * defaulting to now (UTC) when omitted, and {@code administeredDate} always derived from it.
 */
@Service
@RequiredArgsConstructor
public class MedicationService {

    private final MedicationRepository repository;
    private final MedicationDoseRepository doseRepository;
    private final MedicationCycleService cycleService;
    private final MedicationMapper mapper;

    /**
     * The full "Gyógyszer" day payload for the owner's active medication: the catalog row, the
     * cycle derived for TODAY, and the recent (top-10, newest-first) intake ledger. 404 when the
     * owner has no active medication.
     */
    public MedicationDayResponse getDay(UUID userId) {
        MedicationEntity med = repository.findFirstByCreatedByAndActiveTrueAndDeletedFalse(userId)
            .orElseThrow(() -> new SystemRuntimeErrorException(
                SystemMessage.error("RESOURCE_NOT_FOUND").build(), HttpStatus.NOT_FOUND));
        MedicationCycle cycle = cycleService.derive(userId, med, LocalDate.now(ZoneOffset.UTC));
        List<MedicationDoseEntity> recent = doseRepository
            .findTop10ByCreatedByAndMedicationIdAndDeletedFalseOrderByAdministeredAtDesc(
                userId, med.getId());
        return mapper.toDay(med, cycle, recent);
    }

    /**
     * Append one intake to the ledger. Validates {@code dose} (non-null, positive) and
     * {@code administeredAt} (not in the future); server-stamps {@code createdBy}, defaults
     * {@code administeredAt} to now (UTC) when omitted, and derives {@code administeredDate} from it
     * (cf. {@code MealService.applyHeader}). The {@code medicationId} is gated to the owner first.
     */
    @Transactional
    public MedicationDoseResponse logDose(UUID userId, UUID medId, MedicationDoseRequest req) {
        requireOwnedMedication(userId, medId);
        OffsetDateTime administeredAt = req.getAdministeredAt() == null
            ? OffsetDateTime.now(ZoneOffset.UTC) : req.getAdministeredAt();
        validateDose(req.getDose());
        validateNotFuture(administeredAt);

        MedicationDoseEntity dose = new MedicationDoseEntity();
        dose.setCreatedBy(userId); // server-side ownership — never from the client
        dose.setMedicationId(medId);
        dose.setAdministeredAt(administeredAt.toInstant());
        dose.setAdministeredDate(administeredAt.toLocalDate()); // denormalized day key
        dose.setDose(req.getDose());
        dose.setNote(req.getNote());
        return mapper.toDoseResponse(doseRepository.save(dose));
    }

    /** Soft-delete one ledger row, gated to the owner (and to the named medication). */
    @Transactional
    public void deleteDose(UUID userId, UUID medId, UUID doseId) {
        requireOwnedMedication(userId, medId);
        MedicationDoseEntity dose = requireOwnedDose(userId, doseId);
        doseRepository.delete(dose); // @SQLDelete -> is_deleted = true
    }

    /** Apply a PUT body's definition + cycle config onto the owner's medication (mapper write seam). */
    @Transactional
    public MedicationResponse updateMedication(UUID userId, UUID id, MedicationRequest req) {
        MedicationEntity med = requireOwnedMedication(userId, id);
        mapper.applyRequest(med, req);
        return mapper.toResponse(repository.save(med));
    }

    /** Ownership gate: missing and foreign rows are indistinguishable (404), mirroring MealService. */
    private MedicationEntity requireOwnedMedication(UUID userId, UUID id) {
        return repository.findByIdAndCreatedByAndDeletedFalse(id, userId)
            .orElseThrow(() -> new SystemRuntimeErrorException(
                SystemMessage.error("RESOURCE_NOT_FOUND").build(), HttpStatus.NOT_FOUND));
    }

    /** Ownership gate for a ledger row: missing and foreign rows are indistinguishable (404). */
    private MedicationDoseEntity requireOwnedDose(UUID userId, UUID doseId) {
        return doseRepository.findByIdAndCreatedByAndDeletedFalse(doseId, userId)
            .orElseThrow(() -> new SystemRuntimeErrorException(
                SystemMessage.error("RESOURCE_NOT_FOUND").build(), HttpStatus.NOT_FOUND));
    }

    /** {@code dose} must be present and strictly positive. */
    private void validateDose(BigDecimal dose) {
        if (dose == null || dose.signum() <= 0) {
            throw invalidValue("dose");
        }
    }

    /** A logged intake cannot be in the future. */
    private void validateNotFuture(OffsetDateTime administeredAt) {
        if (administeredAt.isAfter(OffsetDateTime.now(ZoneOffset.UTC))) {
            throw invalidValue("administeredAt");
        }
    }

    private SystemRuntimeErrorException invalidValue(String field) {
        return new SystemRuntimeErrorException(
            SystemMessage.field("VALIDATION_INVALID_VALUE", field).build(), HttpStatus.BAD_REQUEST);
    }
}
