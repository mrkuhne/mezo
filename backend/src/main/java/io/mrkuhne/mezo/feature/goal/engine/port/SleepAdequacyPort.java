package io.mrkuhne.mezo.feature.goal.engine.port;

import java.time.LocalDate;
import java.util.UUID;

/**
 * Consumer-owned port (ADR 0012): the adaptive review asks "is the owner in sleep debt?" without
 * depending on companion (which owns the flag variant and may be switched off). Implemented in
 * feature/biometrics/sleep. Window/thresholds come from {@code mezo.goal.adaptive.*}.
 */
public interface SleepAdequacyPort {

    /** Cumulative sleep deficit over the configured window ≥ threshold (small-n gated). */
    boolean sleepDebted(UUID userId, LocalDate today);
}
