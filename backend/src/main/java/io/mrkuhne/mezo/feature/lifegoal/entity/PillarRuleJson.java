package io.mrkuhne.mezo.feature.lifegoal.entity;

import java.math.BigDecimal;
import java.time.LocalDate;

/** Kind-specific rule (spec §4). Unused fields stay null; the scorer (slice 2) reads by kind. */
public record PillarRuleJson(
    BigDecimal threshold, String comparator, Integer daysPerWeek, Integer windowDays,
    BigDecimal startValue, BigDecimal targetValue, LocalDate startDate, LocalDate targetDate,
    String direction, Integer minDataDays) {}
