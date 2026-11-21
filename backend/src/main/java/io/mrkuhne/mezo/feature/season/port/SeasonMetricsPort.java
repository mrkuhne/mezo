package io.mrkuhne.mezo.feature.season.port;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/** Body and recipe reads the season's numbers and overview need (consumer-owned port). */
public interface SeasonMetricsPort {

    record TrendPoint(LocalDate date, BigDecimal kg) {
    }

    /** The latest logged weight (kg). */
    Optional<BigDecimal> latestWeightKg(UUID owner);

    /** EWMA trend points, oldest first. */
    List<TrendPoint> trend(UUID owner);

    /** The 14-day trend rate (kg/week, signed) the engine reports; null without data. */
    BigDecimal trendRateKgPerWeek(UUID owner);

    /** Distinct weigh-in days on or after {@code from}. */
    int weighInDaysSince(UUID owner, LocalDate from);

    /** Average sleep (minutes) of the nights in {@code from..to}; null without a night. */
    Integer averageSleepMinutes(UUID owner, LocalDate from, LocalDate to);

    /** How many recipes he has. */
    long recipeCount(UUID owner);

    /** Logged sleep minutes per wake morning ({@code sleep_log.date}) in {@code from..to}; a day without a night is absent. */
    Map<LocalDate, Integer> sleepMinutes(UUID owner, LocalDate from, LocalDate to);

    /**
     * The experiment signals per day of {@code from..to} (Évad S4), keyed by the contract's
     * {@code SeasonExperimentSignalKey}: {@code sleep_min} (logged sleep per wake morning), {@code deep_min},
     * {@code hrv_ms} and {@code resting_hr} (the wearable day), {@code energy}, {@code mood} and {@code morning_feel}
     * (the day's check-ins averaged; morning feel = rested). Every key is present; a day without data is absent.
     */
    Map<String, Map<LocalDate, Double>> experimentSignals(UUID owner, LocalDate from, LocalDate to);
}
