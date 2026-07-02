package io.mrkuhne.mezo.feature.fuel.service;

import io.mrkuhne.mezo.api.dto.IntakeListResponse;
import io.mrkuhne.mezo.api.dto.IntakeRequest;
import io.mrkuhne.mezo.api.dto.IntakeResponse;
import io.mrkuhne.mezo.feature.fuel.entity.SupplementIntakeEntity;
import io.mrkuhne.mezo.feature.fuel.repository.SupplementIntakeRepository;
import io.mrkuhne.mezo.feature.pantry.entity.PantryItemEntity;
import io.mrkuhne.mezo.feature.pantry.repository.PantryItemRepository;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Append-only supplement-intake ledger (mirrors {@code medication_dose}). {@code logIntake}
 * snapshots the pantry item's dose when the request omits one, and denormalizes the wall-clock
 * {@code takenDate} for per-day reads; {@code deleteIntake} is an owner-scoped soft delete.
 */
@Service
@RequiredArgsConstructor
public class IntakeService {

    private static final String KIND_FOOD = "food";

    private final SupplementIntakeRepository repository;
    private final PantryItemRepository pantryItemRepository;

    @Transactional
    public IntakeResponse logIntake(UUID userId, IntakeRequest request) {
        PantryItemEntity item = pantryItemRepository
            .findByIdAndCreatedByAndDeletedFalse(request.getPantryItemId(), userId)
            .orElseThrow(() -> new SystemRuntimeErrorException(
                SystemMessage.error("RESOURCE_NOT_FOUND").build(), HttpStatus.NOT_FOUND));
        if (KIND_FOOD.equals(item.getKind())) {
            throw new SystemRuntimeErrorException(
                SystemMessage.field("VALIDATION_INVALID_VALUE", "pantryItemId").build(),
                HttpStatus.BAD_REQUEST);
        }
        OffsetDateTime takenAt = request.getTakenAt() != null ? request.getTakenAt() : OffsetDateTime.now();
        SupplementIntakeEntity e = new SupplementIntakeEntity();
        e.setCreatedBy(userId); // server-side ownership — never from the client
        e.setPantryItemId(item.getId());
        e.setTakenAt(takenAt.toInstant());
        e.setTakenDate(takenAt.toLocalDate()); // offset-bearing wall-clock date, the medication_dose precedent
        e.setSlotKey(request.getSlotKey());
        e.setDose(request.getDose() != null && !request.getDose().isBlank() ? request.getDose() : item.getDose());
        e.setNote(request.getNote());
        return toResponse(repository.save(e));
    }

    @Transactional(readOnly = true)
    public IntakeListResponse listForDay(UUID userId, LocalDate date) {
        return new IntakeListResponse()
            .intakes(repository.findByCreatedByAndTakenDateAndDeletedFalseOrderByTakenAtAsc(userId, date)
                .stream().map(this::toResponse).toList());
    }

    @Transactional
    public void deleteIntake(UUID userId, UUID id) {
        SupplementIntakeEntity e = repository.findByIdAndCreatedByAndDeletedFalse(id, userId)
            .orElseThrow(() -> new SystemRuntimeErrorException(
                SystemMessage.error("RESOURCE_NOT_FOUND").build(), HttpStatus.NOT_FOUND));
        repository.delete(e);
    }

    private IntakeResponse toResponse(SupplementIntakeEntity e) {
        return new IntakeResponse()
            .id(e.getId())
            .pantryItemId(e.getPantryItemId())
            .takenAt(e.getTakenAt().atOffset(ZoneOffset.UTC))
            .takenDate(e.getTakenDate())
            .slotKey(e.getSlotKey())
            .dose(e.getDose())
            .note(e.getNote());
    }
}
