package io.mrkuhne.mezo.feature.goal.engine.port;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * Consumer-owned port (ADR 0012): per-day logged intake for the learned-expenditure filter
 * (mezo-zz91i). Implemented in feature/meal off the FuelDayService week rollup, so "consumed"
 * means exactly what Fuel shows. Only LOGGED days are returned (kcal > 0) — absence is missing
 * data, never a zero-kcal day.
 */
public interface DailyIntakePort {

    record DayIntake(LocalDate date, int kcal, int carbsG) {}

    List<DayIntake> between(UUID userId, LocalDate from, LocalDate to);
}
