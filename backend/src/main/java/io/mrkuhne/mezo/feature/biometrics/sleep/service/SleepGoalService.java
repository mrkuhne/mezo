package io.mrkuhne.mezo.feature.biometrics.sleep.service;

import io.mrkuhne.mezo.api.dto.SetSleepGoalRequest;
import io.mrkuhne.mezo.api.dto.SleepGoalResponse;
import io.mrkuhne.mezo.feature.biometrics.sleep.config.SleepGoalProperties;
import io.mrkuhne.mezo.feature.biometrics.sleep.entity.SleepGoalEntity;
import io.mrkuhne.mezo.feature.biometrics.sleep.repository.SleepGoalRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.SLEEP_GOAL_SWITCH, havingValue = "true")
public class SleepGoalService {

    private static final DateTimeFormatter HH_MM = DateTimeFormatter.ofPattern("HH:mm");

    private final SleepGoalRepository repository;
    private final SleepGoalProperties properties;

    /** Config-default ghost when unset — never 404 (spec §3): every user has a working anchor. */
    public SleepGoalResponse getGoal(UUID userId) {
        return repository.findByCreatedByAndDeletedFalse(userId)
            .map(g -> compose(g.getTargetMinutes(), g.getAnchor(), g.getAnchorTime(), g.getRegularityBandMin()))
            .orElseGet(() -> {
                String time = "WAKE".equals(properties.defaultAnchor())
                    ? properties.defaultWake() : properties.defaultBed();
                return compose(properties.defaultTargetMin(), properties.defaultAnchor(), time,
                    properties.regularityBandMin());
            });
    }

    @Transactional
    public SleepGoalResponse setGoal(UUID userId, SetSleepGoalRequest req) {
        SleepGoalEntity row = repository.findByCreatedByAndDeletedFalse(userId)
            .orElseGet(() -> {
                SleepGoalEntity e = new SleepGoalEntity();
                e.setCreatedBy(userId); // server-side from principal, never from client
                return e;
            });
        row.setTargetMinutes(req.getTargetMinutes());
        row.setAnchor(req.getAnchor());
        row.setAnchorTime(req.getAnchorTime());
        row.setRegularityBandMin(req.getRegularityBandMin() != null
            ? req.getRegularityBandMin() : properties.regularityBandMin());
        repository.save(row);
        return compose(row.getTargetMinutes(), row.getAnchor(), row.getAnchorTime(), row.getRegularityBandMin());
    }

    private SleepGoalResponse compose(int targetMinutes, String anchor, String anchorTime, int bandMin) {
        var resolved = SleepAnchorResolver.derive(anchor, LocalTime.parse(anchorTime), targetMinutes);
        return SleepGoalResponse.builder()
            .targetMinutes(targetMinutes)
            .anchor(anchor)
            .anchorTime(anchorTime)
            .wakeTime(HH_MM.format(resolved.wake()))
            .bedTime(HH_MM.format(resolved.bed()))
            .regularityBandMin(bandMin)
            .build();
    }
}
