package io.mrkuhne.mezo.feature.character.detector;

import io.mrkuhne.mezo.feature.biometrics.checkin.service.CheckInItem;
import java.util.List;
import java.util.Map;

/** Pure-code signal detector (spec §5). Stateless; returns 0..n signals for the input day. */
public interface CharacterDetector {
    String key();
    List<DetectorSignal> detect(DetectorInput input);

    /**
     * The check-in items this detector reads and is waiting on, each with the Hungarian "why"
     * sentence the question of the day shows when it asks for one (Check-in 2.0 follow-up A).
     * Empty = the detector does not feed on check-in items the chooser rotates.
     */
    default Map<CheckInItem, String> checkInNeeds() {
        return Map.of();
    }
}
