package io.mrkuhne.mezo.feature.train.service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;

/**
 * Consumer-owned port (ADR 0012, the {@link GoalRecomputePort} pattern): the personalised kcal
 * estimate needs the athlete's body (latest weigh-in + sex/age/body-fat from the biometric
 * profile), but biometrics → train already exists ({@code BiometricProfileService} reads the
 * weekly schedule), so a direct train → biometrics import would close a new slice cycle. Train
 * owns this seam; the biometrics slice provides the adapter.
 */
public interface AthleteBodyPort {

    /**
     * The owner's body as of {@code date}, or empty when the estimate's inputs are not there yet
     * (no biometric profile, or no weigh-in at all) — the caller then persists NULL kcal, never 0.
     *
     * @param date the session's date; the age is taken at that day
     */
    Optional<AthleteBody> bodyAt(UUID userId, LocalDate date);

    /**
     * @param weightKg the latest weigh-in
     * @param sex {@code M|F} as stored on the profile
     * @param age full years at the session's date
     * @param bodyFatPct null when never captured — the lean correction is then neutral
     */
    record AthleteBody(BigDecimal weightKg, String sex, int age, BigDecimal bodyFatPct) {}
}
