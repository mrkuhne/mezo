package io.mrkuhne.mezo.feature.nutrition.service.dayplan;

import java.time.LocalDate;
import java.util.List;

/**
 * The day as the planner sees it (Boop B4, mezo-r36n9.14): every window in clock order, what is
 * left of the budget, and at most one next-meal tip.
 *
 * <p>{@code remaining} is target − consumed − the skipped windows' kcal; it goes NEGATIVE over
 * budget rather than clamping, and is {@code null} on a kímélő (GUIDANCE) day. {@code tip} is
 * {@code null} late in the day, after a skip, and whenever there is nothing left to offer.
 */
public record DayPlan(LocalDate date, List<DayPlanWindow> windows, Macros4 remaining, Tip tip) {
}
