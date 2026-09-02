package io.mrkuhne.mezo.feature.lifegoal.entity;

/** A ha–akkor plan's machine-readable trigger (spec D9). {@code source} is a SignalCatalog trigger
 *  key (e.g. {@code sport_session_logged}, {@code checkin_energy_lte}); null trigger = manual plan. */
public record PlanTriggerJson(String source, String condition, Integer delayHours) {}
