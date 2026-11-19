package io.mrkuhne.mezo.feature.penz.service.engine;

import java.time.LocalDate;
import java.util.List;

/** A Monday-start week's allowance (old {@code WeeklyAllowance}), HUF minor units. */
public record WeeklyAllowance(
    LocalDate weekStart,
    LocalDate weekEnd,
    LocalDate countedFrom,
    List<WeekPortion> portions,
    long budgetMinor,
    long spentMinor,
    long remainingMinor) {

    public WeeklyAllowance {
        portions = List.copyOf(portions);
    }
}
