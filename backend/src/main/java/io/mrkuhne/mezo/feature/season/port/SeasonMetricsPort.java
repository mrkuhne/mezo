package io.mrkuhne.mezo.feature.season.port;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
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
}
