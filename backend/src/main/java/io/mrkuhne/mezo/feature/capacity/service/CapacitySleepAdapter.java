package io.mrkuhne.mezo.feature.capacity.service;

import io.mrkuhne.mezo.feature.biometrics.sleep.entity.SleepLogEntity;
import io.mrkuhne.mezo.feature.biometrics.sleep.repository.SleepGoalRepository;
import io.mrkuhne.mezo.feature.biometrics.sleep.repository.SleepLogRepository;
import io.mrkuhne.mezo.feature.biometrics.sleep.service.SleepAnchorPort;
import io.mrkuhne.mezo.feature.capacity.port.CapacitySleepPort;
import io.mrkuhne.mezo.feature.season.service.SleepNeedRule;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/** {@link CapacitySleepPort} over the sleep log and goal rows plus the season's {@link SleepNeedRule}. */
@Component
@RequiredArgsConstructor
public class CapacitySleepAdapter implements CapacitySleepPort {

    private final SleepLogRepository sleepLogs;
    private final SleepGoalRepository sleepGoals;
    private final SleepAnchorPort sleepAnchor;

    @Override
    public Map<LocalDate, Integer> sleepMinutes(UUID owner, LocalDate from, LocalDate to) {
        Map<LocalDate, Integer> out = new LinkedHashMap<>();
        for (SleepLogEntity s : sleepLogs.findByCreatedByAndDeletedFalseAndDateBetweenOrderByDateDesc(owner, from, to)) {
            if (s.getDurationH() != null && s.getDurationH().signum() > 0) {
                out.putIfAbsent(s.getDate(),
                    s.getDurationH().multiply(BigDecimal.valueOf(60)).setScale(0, RoundingMode.HALF_UP).intValue());
            }
        }
        return out;
    }

    @Override
    public int needMinutes(UUID owner, int gymPerWeek, int sportPerWeek) {
        Integer goal = sleepGoals.findByCreatedByAndDeletedFalse(owner).map(g -> g.getTargetMinutes()).orElse(null);
        return SleepNeedRule.sleepNeedMinutes(SleepNeedRule.base(goal), gymPerWeek, sportPerWeek);
    }

    @Override
    public java.time.LocalTime usualBedtime(UUID owner) {
        return sleepAnchor.resolve(owner).bed();
    }
}
