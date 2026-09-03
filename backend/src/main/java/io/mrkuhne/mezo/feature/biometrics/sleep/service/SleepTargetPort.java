package io.mrkuhne.mezo.feature.biometrics.sleep.service;

import java.math.BigDecimal;
import java.util.UUID;

/**
 * Read seam for the nightly sleep target in hours — the goal engine seeds the prescription's
 * {@code sleepTargetH} from here (mezo-3g5w; replaces the hardcoded 8.0 seed). Config-ghost when
 * no sleep-goal row exists (never null), mirroring {@link SleepAnchorPort}.
 */
public interface SleepTargetPort {

    BigDecimal targetHours(UUID userId);
}
