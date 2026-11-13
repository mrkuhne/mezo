package io.mrkuhne.mezo.feature.fuel.service;

import io.mrkuhne.mezo.api.dto.IntakeListResponse;
import io.mrkuhne.mezo.api.dto.IntakeRequest;
import io.mrkuhne.mezo.api.dto.IntakeResponse;
import io.mrkuhne.mezo.feature.biometrics.checkin.config.OwnerZoneProperties;
import io.mrkuhne.mezo.feature.fuel.entity.SupplementIntakeEntity;
import io.mrkuhne.mezo.feature.fuel.repository.SupplementIntakeRepository;
import io.mrkuhne.mezo.feature.pantry.entity.PantryItemEntity;
import io.mrkuhne.mezo.feature.pantry.repository.PantryItemRepository;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import io.mrkuhne.mezo.techcore.time.CapturedAtWindow;
import java.time.Clock;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.ObjectProvider;
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
    private final OwnerZoneProperties ownerZone;
    private final ObjectProvider<Clock> clock;

    @Transactional
    public IntakeResponse logIntake(UUID userId, IntakeRequest request) {
        UUID ref = request.getClientRef();
        if (ref != null) { // a retried request is answered from the stored row, before any re-validation
            var existing = repository.findByCreatedByAndClientRefAndDeletedFalse(userId, ref);
            if (existing.isPresent()) {
                return toResponse(existing.get());
            }
        }
        PantryItemEntity item = pantryItemRepository
            .findByIdAndCreatedByAndDeletedFalse(request.getPantryItemId(), userId)
            .orElseThrow(() -> new SystemRuntimeErrorException(
                SystemMessage.error("RESOURCE_NOT_FOUND").build(), HttpStatus.NOT_FOUND));
        if (KIND_FOOD.equals(item.getCatalog().getKind())) {
            throw new SystemRuntimeErrorException(
                SystemMessage.field("VALIDATION_INVALID_VALUE", "pantryItemId").build(),
                HttpStatus.BAD_REQUEST);
        }
        // The FE always sends an offset-bearing takenAt (browser wall-clock + local UTC offset, via
        // nowOffsetIso — mirrors medication's LogDoseSheet.toOffsetIso), so takenAt.toLocalDate()
        // below is the browser's calendar day. The UTC-now default is only a fallback for API-direct
        // callers that omit takenAt (using the JVM zone would misfile a 00:00–02:00 local tap).
        // Boop B4: capturedAt (the phone's moment) wins over takenAt; its own offset dates the intake.
        OffsetDateTime takenAt = request.getCapturedAt() != null
            ? CapturedAtWindow.require(request.getCapturedAt(), ownerZone.zoneId(), clock.getIfAvailable(Clock::systemUTC))
            : request.getTakenAt() != null ? request.getTakenAt() : OffsetDateTime.now(ZoneOffset.UTC);
        String dose = request.getDose() != null && !request.getDose().isBlank() ? request.getDose() : item.getDose();
        if (ref != null) {
            // Race-safe: a concurrent insert of the same clientRef waits, then does nothing; read the winner back.
            repository.insertIfClientRefAbsent(userId, item.getId(), takenAt.toInstant(), takenAt.toLocalDate(),
                request.getSlotKey(), dose, request.getNote(), ref);
            return toResponse(repository.findByCreatedByAndClientRefAndDeletedFalse(userId, ref).orElseThrow());
        }
        SupplementIntakeEntity e = new SupplementIntakeEntity();
        e.setCreatedBy(userId); // server-side ownership — never from the client
        e.setPantryItemId(item.getId());
        e.setTakenAt(takenAt.toInstant());
        e.setTakenDate(takenAt.toLocalDate()); // day key from the offset-bearing wall-clock (FE sends the offset)
        e.setSlotKey(request.getSlotKey());
        e.setDose(dose);
        e.setNote(request.getNote());
        return toResponse(repository.save(e));
    }

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
