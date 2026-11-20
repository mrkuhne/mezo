package io.mrkuhne.mezo.feature.season.service;

import io.mrkuhne.mezo.feature.biometrics.sleep.config.SleepGoalProperties;
import io.mrkuhne.mezo.feature.biometrics.sleep.entity.SleepGoalEntity;
import io.mrkuhne.mezo.feature.biometrics.sleep.repository.SleepGoalRepository;
import io.mrkuhne.mezo.feature.season.port.SeasonSleepPort;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * {@link SeasonSleepPort} over the sleep goal row. Reads and writes the repository directly because the sleep-goal
 * service bean is behind its own feature switch; the semantics match it (ghost defaults when unset, one live row).
 */
@Component
@RequiredArgsConstructor
public class SeasonSleepAdapter implements SeasonSleepPort {

    private final SleepGoalRepository repository;
    private final SleepGoalProperties properties;

    @Override
    public SleepGoal get(UUID owner) {
        return repository.findByCreatedByAndDeletedFalse(owner)
            .map(g -> new SleepGoal(true, g.getTargetMinutes(), g.getAnchor(), g.getAnchorTime()))
            .orElseGet(() -> new SleepGoal(false, properties.defaultTargetMin(), properties.defaultAnchor(),
                defaultTime(properties.defaultAnchor())));
    }

    @Override
    public void setTargetMinutes(UUID owner, int minutes) {
        SleepGoalEntity row = rowOrNew(owner);
        row.setTargetMinutes(minutes);
        repository.save(row);
    }

    @Override
    public void write(UUID owner, int minutes, String anchor, String anchorTime) {
        SleepGoalEntity row = rowOrNew(owner);
        row.setTargetMinutes(minutes);
        row.setAnchor(anchor);
        row.setAnchorTime(anchorTime);
        repository.save(row);
    }

    private SleepGoalEntity rowOrNew(UUID owner) {
        return repository.findByCreatedByAndDeletedFalse(owner).orElseGet(() -> {
            SleepGoalEntity e = new SleepGoalEntity();
            e.setCreatedBy(owner);
            e.setAnchor(properties.defaultAnchor());
            e.setAnchorTime(defaultTime(properties.defaultAnchor()));
            e.setRegularityBandMin(properties.regularityBandMin());
            return e;
        });
    }

    private String defaultTime(String anchor) {
        return "WAKE".equals(anchor) ? properties.defaultWake() : properties.defaultBed();
    }
}
