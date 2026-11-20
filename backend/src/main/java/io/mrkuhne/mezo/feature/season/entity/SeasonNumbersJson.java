package io.mrkuhne.mezo.feature.season.entity;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * The consequences of one season draft (the contract's {@code SeasonNumbers}) — every value computed by the goal
 * engine, the sleep rule or the feasibility band; {@code null} where the server cannot compute it. Stored as the
 * {@code season_revision.before} / {@code after} jsonb snapshots.
 */
public record SeasonNumbersJson(
    int trainDayKcal,
    Integer restDayKcal,       // null when gym + sport days cover all seven weekdays
    int proteinG,
    int carbsTrainG,
    int sleepNeedMin,
    String bedtime,
    LocalDate targetDate,      // cut / bulk only
    Integer weeksToTarget,     // cut / bulk only
    String paceVerdict,        // feasible | warnings | aggressive; cut / bulk only
    BigDecimal kgPerWeek,      // signed planned weekly change; cut / bulk only
    BigDecimal bandLowKg,      // maintain only
    BigDecimal bandHighKg,     // maintain only
    int gymPerWeek,
    int sportPerWeek
) {
}
