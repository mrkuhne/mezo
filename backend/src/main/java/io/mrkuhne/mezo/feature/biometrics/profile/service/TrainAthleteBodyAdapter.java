package io.mrkuhne.mezo.feature.biometrics.profile.service;

import io.mrkuhne.mezo.feature.biometrics.profile.entity.BiometricProfileEntity;
import io.mrkuhne.mezo.feature.biometrics.profile.repository.BiometricProfileRepository;
import io.mrkuhne.mezo.feature.biometrics.weight.entity.WeightLogEntity;
import io.mrkuhne.mezo.feature.biometrics.weight.repository.WeightLogRepository;
import io.mrkuhne.mezo.feature.train.service.AthleteBodyPort;
import java.time.LocalDate;
import java.time.Period;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * Biometrics-side adapter for train's {@link AthleteBodyPort} (ADR 0012 — see the port's javadoc).
 * The weight is the latest weigh-in ({@code GoalPrescriptionCalculator}'s rule); sex, birth date
 * and the optional body-fat % come from the single-row biometric profile.
 */
@Component
@RequiredArgsConstructor
public class TrainAthleteBodyAdapter implements AthleteBodyPort {

    private final BiometricProfileRepository profileRepository;
    private final WeightLogRepository weightLogRepository;

    @Override
    public Optional<AthleteBody> bodyAt(UUID userId, LocalDate date) {
        BiometricProfileEntity profile =
            profileRepository.findByCreatedByAndDeletedFalse(userId).orElse(null);
        if (profile == null) {
            return Optional.empty();
        }
        WeightLogEntity weight = weightLogRepository
            .findFirstByCreatedByAndDeletedFalseOrderByDateDescCreatedAtDesc(userId).orElse(null);
        if (weight == null) {
            return Optional.empty(); // no weigh-in ⇒ no honest estimate, the caller stores NULL
        }
        LocalDate on = date != null ? date : LocalDate.now();
        int age = Period.between(profile.getBirthDate(), on).getYears();
        return Optional.of(new AthleteBody(
            weight.getWeightKg(), profile.getSex(), age, profile.getBodyFatPct()));
    }
}
