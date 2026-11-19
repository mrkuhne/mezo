package io.mrkuhne.mezo.feature.penz.service.engine;

import java.time.LocalDate;
import java.time.YearMonth;

/**
 * The part of a week's budget that comes from one month (old {@code WeekPortion}):
 * {@code max(0, floor(remainingAtFrom × daysInWeek / daysToMonthEnd))}.
 */
public record WeekPortion(
    YearMonth month,
    LocalDate from,
    int daysInWeek,
    int daysToMonthEnd,
    long remainingAtFromMinor,
    long portionMinor) {
}
