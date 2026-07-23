package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.biometrics.sleep.entity.SleepGoalEntity;
import io.mrkuhne.mezo.feature.biometrics.sleep.repository.SleepGoalRepository;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;

@TestComponent
@RequiredArgsConstructor
public class SleepGoalPopulator {

    private final SleepGoalRepository sleepGoalRepository;

    /** Any valid goal: 7.5 h asleep target anchored to a 06:45 wake (derived bed 23:15). */
    public SleepGoalEntity goal(UUID owner) {
        return goal(owner, 450, "WAKE", "06:45", 15);
    }

    public SleepGoalEntity goal(UUID owner, int targetMinutes, String anchor, String anchorTime, int bandMin) {
        SleepGoalEntity e = new SleepGoalEntity();
        e.setCreatedBy(owner);
        e.setTargetMinutes(targetMinutes);
        e.setAnchor(anchor);
        e.setAnchorTime(anchorTime);
        e.setRegularityBandMin(bandMin);
        return sleepGoalRepository.saveAndFlush(e);
    }
}
