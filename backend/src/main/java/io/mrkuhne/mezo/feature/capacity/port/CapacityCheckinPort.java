package io.mrkuhne.mezo.feature.capacity.port;

import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;

/** What capacity needs from check-ins and day closes (consumer-owned port; biometrics/dayclose never import capacity). */
public interface CapacityCheckinPort {

    /**
     * One day's self-report. {@code energy}/{@code mental} come from the latest answered check-in of the day;
     * {@code dayRating}/{@code eveningEnergy} from the day close. Either side may be absent.
     */
    record DayFeel(Integer energy, Integer mental, Integer dayRating, Integer eveningEnergy, boolean hasCheckin,
                   boolean hasClose) {
    }

    /** Days of {@code from..to} that have a check-in or a close; other days are absent. */
    Map<LocalDate, DayFeel> feel(UUID owner, LocalDate from, LocalDate to);
}
