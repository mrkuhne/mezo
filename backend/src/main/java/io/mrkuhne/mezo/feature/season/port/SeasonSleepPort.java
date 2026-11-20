package io.mrkuhne.mezo.feature.season.port;

import java.util.UUID;

/** What the season needs from the sleep goal (consumer-owned port). */
public interface SeasonSleepPort {

    /** {@code isSet} false = config defaults (no row of his). Anchor WAKE | BED, time HH:mm. */
    record SleepGoal(boolean isSet, int targetMinutes, String anchor, String anchorTime) {
    }

    SleepGoal get(UUID owner);

    /** Writes the need, keeping his anchor (a missing row starts from the config default anchor). */
    void setTargetMinutes(UUID owner, int minutes);

    /** Writes the need and the anchor together (the season draft carried a sleep anchor). */
    void write(UUID owner, int minutes, String anchor, String anchorTime);
}
