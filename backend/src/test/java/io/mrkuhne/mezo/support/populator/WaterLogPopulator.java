package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.meal.entity.WaterLogEntity;
import io.mrkuhne.mezo.feature.meal.repository.WaterLogRepository;
import java.time.LocalDate;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;

@TestComponent
@RequiredArgsConstructor
public class WaterLogPopulator {

    private final WaterLogRepository repository;

    public WaterLogEntity createWaterLog(UUID owner, LocalDate date, int amountMl) {
        WaterLogEntity e = new WaterLogEntity();
        e.setCreatedBy(owner);
        e.setLogDate(date);
        e.setAmountMl(amountMl);
        return repository.saveAndFlush(e);
    }
}
