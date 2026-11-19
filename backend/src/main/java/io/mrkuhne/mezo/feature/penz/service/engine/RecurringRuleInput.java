package io.mrkuhne.mezo.feature.penz.service.engine;

import java.time.LocalDate;
import java.util.UUID;

/**
 * The engine's view of a recurring rule (old {@code RecurringRule}, only the fields the engine
 * reads). {@code amountHufMinor} is the rule's CURRENT HUF amount, used for occurrences not yet
 * materialized. {@code endDate} and {@code lastMaterializedDate} may be null.
 */
public record RecurringRuleInput(
    UUID id,
    RuleKind kind,
    long amountHufMinor,
    Frequency frequency,
    LocalDate startDate,
    LocalDate endDate,
    LocalDate lastMaterializedDate,
    boolean active) {
}
