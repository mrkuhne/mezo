package io.mrkuhne.mezo.feature.capacity.port;

import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;

/** What capacity needs from sleep (consumer-owned port; biometrics and season never import capacity). */
public interface CapacitySleepPort {

    /** Logged sleep minutes per wake morning ({@code sleep_log.date}); a day without a night is absent. */
    Map<LocalDate, Integer> sleepMinutes(UUID owner, LocalDate from, LocalDate to);

    /** His nightly need: the sleep goal (or the default) plus the weekly-session increment, via the season's rule. */
    int needMinutes(UUID owner, int gymPerWeek, int sportPerWeek);

    /** His usual bedtime: the sleep goal's anchor pair (config default when he has none), never the ledger. */
    java.time.LocalTime usualBedtime(UUID owner);
}
