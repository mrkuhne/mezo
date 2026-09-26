package io.mrkuhne.mezo.feature.meal.service;

import io.mrkuhne.mezo.feature.biometrics.checkin.entity.CheckInEntity;
import io.mrkuhne.mezo.feature.biometrics.checkin.repository.CheckInRepository;
import io.mrkuhne.mezo.feature.biometrics.profile.entity.BiometricProfileEntity;
import io.mrkuhne.mezo.feature.biometrics.profile.repository.BiometricProfileRepository;
import io.mrkuhne.mezo.feature.biometrics.sleep.entity.SleepLogEntity;
import io.mrkuhne.mezo.feature.biometrics.sleep.repository.SleepLogRepository;
import io.mrkuhne.mezo.feature.biometrics.weight.entity.WeightLogEntity;
import io.mrkuhne.mezo.feature.biometrics.weight.repository.WeightLogRepository;
import io.mrkuhne.mezo.feature.goal.entity.GoalEntity;
import io.mrkuhne.mezo.feature.goal.repository.GoalRepository;
import io.mrkuhne.mezo.feature.medication.entity.MedicationEntity;
import io.mrkuhne.mezo.feature.medication.repository.MedicationRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.Period;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The PERSON behind the plate, for the coach's glucose tips (owner, 2026-09-26: „adjunk át minden
 * szükséges adatot a kajáról és a userről"). Everything that moves a post-meal glucose response and
 * that the app actually knows: body (sex, age, height, weight, body fat, NEAT band), the active goal,
 * last night's sleep (a short or poor night measurably worsens insulin sensitivity), the day's
 * check-ins (stress / energy), and an active medication (metformin, a GLP-1 … change the curve).
 *
 * <p>Honest nulls: every field is nullable and the prompt prints "nincs adat" for a gap — a missing
 * profile is never read as a default person. Read in ONE short read-only transaction, detached
 * records out, same reason as {@link MealCoachStore}: the LLM call must not pin a connection.
 */
@Service
@RequiredArgsConstructor
class MealCoachContextReader {

    /** The person, day-level. {@code checkIns} are all of the day's; the prompt cuts per meal. */
    record PersonContext(String sex, Integer age, BigDecimal heightCm, BigDecimal weightKg,
                         BigDecimal bodyFatPct, String activityLevel,
                         String goalTrajectory, List<String> goalGuards,
                         Sleep sleep, String medication, List<CheckIn> checkIns) {

        static PersonContext empty() {
            return new PersonContext(null, null, null, null, null, null, null, List.of(), null, null,
                List.of());
        }
    }

    record Sleep(LocalDate date, BigDecimal durationH, Integer quality, Integer awakenings) {
    }

    /** One check-in; {@code slotTime} is "HH:mm", scales 1-10. */
    record CheckIn(String slotTime, Integer energy, Integer stress, Integer body, Integer mental) {
    }

    private final BiometricProfileRepository profiles;
    private final WeightLogRepository weights;
    private final GoalRepository goals;
    private final SleepLogRepository sleeps;
    private final CheckInRepository checkIns;
    private final MedicationRepository medications;

    @Transactional(readOnly = true)
    PersonContext read(UUID userId, LocalDate date) {
        BiometricProfileEntity profile = profiles.findByCreatedByAndDeletedFalse(userId).orElse(null);
        // The weight as of that day — a later weigh-in must not leak into an earlier meal's prompt.
        BigDecimal weight = weights
            .findFirstByCreatedByAndDeletedFalseAndDateBetweenOrderByCreatedAtDesc(userId, date.minusDays(30), date)
            .map(WeightLogEntity::getWeightKg).orElse(null);
        GoalEntity goal = goals.findByCreatedByAndStatusAndDeletedFalse(userId, "active").stream()
            .findFirst().orElse(null);
        // The night that ENDED on this day, or the one before when that is missing.
        Sleep sleep = sleeps.findByCreatedByAndDeletedFalseAndDateBetweenOrderByDateDesc(userId,
                date.minusDays(1), date).stream().findFirst()
            .map(MealCoachContextReader::toSleep).orElse(null);
        List<CheckIn> dayCheckIns = checkIns.findByCreatedByAndDateOrderBySlotTime(userId, date).stream()
            .filter(c -> "done".equals(c.getState()))
            .map(c -> new CheckIn(c.getSlotTime(), c.getEnergy(), c.getStress(), c.getBody(), c.getMental()))
            .toList();
        String medication = medications.findFirstByCreatedByAndActiveTrueAndDeletedFalse(userId)
            .map(MealCoachContextReader::medicationLabel).orElse(null);

        return new PersonContext(
            profile == null ? null : profile.getSex(),
            profile == null || profile.getBirthDate() == null ? null
                : Period.between(profile.getBirthDate(), date).getYears(),
            profile == null ? null : profile.getHeightCm(),
            weight,
            profile == null ? null : profile.getBodyFatPct(),
            profile == null ? null : profile.getActivityLevel(),
            goal == null ? null : goal.getTrajectory(),
            goal == null || goal.getGuards() == null ? List.of() : List.copyOf(goal.getGuards()),
            sleep, medication, dayCheckIns);
    }

    private static Sleep toSleep(SleepLogEntity s) {
        return new Sleep(s.getDate(), s.getDurationH(), s.getQuality(), s.getAwakenings());
    }

    private static String medicationLabel(MedicationEntity m) {
        String ingredient = m.getActiveIngredient();
        return ingredient == null || ingredient.isBlank() || ingredient.equalsIgnoreCase(m.getName())
            ? m.getName() : m.getName() + " (" + ingredient + ")";
    }

    /** Only the check-ins at or before the meal — a later mood must not explain an earlier plate. */
    static List<CheckIn> upTo(List<CheckIn> all, String hhmm) {
        return all.stream().filter(c -> c.slotTime() != null && c.slotTime().compareTo(hhmm) <= 0).toList();
    }
}
