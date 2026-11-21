package io.mrkuhne.mezo.feature.capacity.service;

import io.mrkuhne.mezo.feature.capacity.service.CapacityCalculator.Capacity;
import io.mrkuhne.mezo.feature.capacity.service.DemandCalculator.Demand;
import java.time.LocalDate;

/**
 * One day's capacity read (Boop B7 K1): what the day asks ({@code demand}), what he can carry ({@code capacity}),
 * their ratio and the verdict word. {@code calendarKnown} false = no calendar rows lately, so the demand has no
 * meetings in it and the verdict says so. {@code reasonFacts} is the rule-built Hungarian line of the two strongest
 * drivers (empty when nothing stands out).
 */
public record CapacityDay(LocalDate date, String verdict, double ratio, boolean tanulo, int fullDays,
                          int labelledDays, boolean calendarKnown, Demand demand, Capacity capacity,
                          String reasonFacts) {
}
