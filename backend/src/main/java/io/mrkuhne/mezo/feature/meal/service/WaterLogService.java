package io.mrkuhne.mezo.feature.meal.service;

import io.mrkuhne.mezo.api.dto.WaterLogRequest;
import io.mrkuhne.mezo.api.dto.WaterLogResponse;
import io.mrkuhne.mezo.feature.meal.entity.WaterLogEntity;
import io.mrkuhne.mezo.feature.meal.repository.WaterLogRepository;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.time.LocalDate;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class WaterLogService {

    private final WaterLogRepository repository;

    @Transactional
    public WaterLogResponse logWater(UUID userId, WaterLogRequest request) {
        if (request.getAmountMl() == null || request.getAmountMl() <= 0) {
            throw new SystemRuntimeErrorException(
                SystemMessage.field("VALIDATION_INVALID_VALUE", "amountMl").build(), HttpStatus.BAD_REQUEST);
        }
        WaterLogEntity e = new WaterLogEntity();
        e.setCreatedBy(userId); // server-side ownership — never from the client
        e.setLogDate(request.getDate() != null ? request.getDate() : LocalDate.now());
        e.setAmountMl(request.getAmountMl());
        WaterLogEntity saved = repository.save(e);
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
