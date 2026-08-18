package io.mrkuhne.mezo.feature.progression.needs;

import java.time.LocalDate;
import java.util.UUID;

/** Day-close bonus signal from the needs feature — always lands on the recovery LIFE skill. */
public record NeedsSignal(UUID needsDayId, int xp, String label, LocalDate occurredOn) {}
