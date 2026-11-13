package io.mrkuhne.mezo.feature.meal.service;

import io.mrkuhne.mezo.api.dto.WaterLogRequest;
import io.mrkuhne.mezo.api.dto.WaterLogResponse;
import io.mrkuhne.mezo.feature.biometrics.checkin.config.OwnerZoneProperties;
import io.mrkuhne.mezo.feature.meal.entity.WaterLogEntity;
import io.mrkuhne.mezo.feature.meal.repository.WaterLogRepository;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import io.mrkuhne.mezo.techcore.time.CapturedAtWindow;
import java.time.Clock;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class WaterLogService {

    private final WaterLogRepository repository;
    private final OwnerZoneProperties ownerZone;
    private final ObjectProvider<Clock> clock;

    @Transactional
    public WaterLogResponse logWater(UUID userId, WaterLogRequest request) {
        if (request.getAmountMl() == null || request.getAmountMl() <= 0) {
            throw new SystemRuntimeErrorException(
                SystemMessage.field("VALIDATION_INVALID_VALUE", "amountMl").build(), HttpStatus.BAD_REQUEST);
        }
        UUID ref = request.getClientRef();
        if (ref != null) { // a retried request is answered from the stored row, before any window re-check
            var existing = repository.findByCreatedByAndClientRefAndDeletedFalse(userId, ref);
            if (existing.isPresent()) {
                return toResponse(existing.get());
            }
        }
        // Boop B4: a captured-at moment dates the log in the PHONE's own offset (like meals' loggedAt); the
        // explicit `date` still wins. Absent -> the existing server-today default (the JVM zone, unchanged).
        OffsetDateTime capturedAt = request.getCapturedAt() == null ? null : CapturedAtWindow.require(
            request.getCapturedAt(), ownerZone.zoneId(), clock.getIfAvailable(Clock::systemUTC));
        LocalDate day = request.getDate() != null ? request.getDate()
            : capturedAt != null ? capturedAt.toLocalDate() : LocalDate.now();
        if (ref != null) {
            // Race-safe retry path: the log for a repeated clientRef is returned, never duplicated.
            repository.insertIfClientRefAbsent(userId, day, request.getAmountMl(), ref);
            return toResponse(repository.findByCreatedByAndClientRefAndDeletedFalse(userId, ref).orElseThrow());
        }
        WaterLogEntity e = new WaterLogEntity();
        e.setCreatedBy(userId); // server-side ownership — never from the client
        e.setLogDate(day);
        e.setAmountMl(request.getAmountMl());
        return toResponse(repository.save(e));
    }

    private static WaterLogResponse toResponse(WaterLogEntity saved) {
        return WaterLogResponse.builder()
            .id(saved.getId()).date(saved.getLogDate()).amountMl(saved.getAmountMl()).build();
    }

    @Transactional
    public void deleteWaterLog(UUID userId, UUID id) {
        WaterLogEntity e = repository.findByIdAndCreatedByAndDeletedFalse(id, userId)
            .orElseThrow(() -> new SystemRuntimeErrorException(
                SystemMessage.error("RESOURCE_NOT_FOUND").build(), HttpStatus.NOT_FOUND));
        repository.delete(e); // @SQLDelete → soft delete
    }

    public int sumForDay(UUID userId, LocalDate date) {
        return repository.sumAmountForDay(userId, date);
    }
}
