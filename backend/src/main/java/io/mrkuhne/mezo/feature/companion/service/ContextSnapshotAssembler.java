package io.mrkuhne.mezo.feature.companion.service;

import io.mrkuhne.mezo.api.dto.FuelDayResponse;
import io.mrkuhne.mezo.api.dto.GymScheduleSlotResponse;
import io.mrkuhne.mezo.api.dto.MacroSet;
import io.mrkuhne.mezo.api.dto.ProtocolResponse;
import io.mrkuhne.mezo.api.dto.SportScheduleSlotResponse;
import io.mrkuhne.mezo.api.dto.WeightTrendResponse;
import io.mrkuhne.mezo.feature.biometrics.checkin.entity.CheckInEntity;
import io.mrkuhne.mezo.feature.biometrics.checkin.repository.CheckInRepository;
import io.mrkuhne.mezo.feature.biometrics.profile.entity.BiometricProfileEntity;
import io.mrkuhne.mezo.feature.biometrics.profile.repository.BiometricProfileRepository;
import io.mrkuhne.mezo.feature.biometrics.sleep.entity.SleepLogEntity;
import io.mrkuhne.mezo.feature.biometrics.sleep.repository.SleepLogRepository;
import io.mrkuhne.mezo.feature.biometrics.weight.service.WeightTrendService;
import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import io.mrkuhne.mezo.feature.fuel.service.IntakeService;
import io.mrkuhne.mezo.feature.fuel.service.ProtocolService;
import io.mrkuhne.mezo.feature.goal.entity.GoalEntity;
import io.mrkuhne.mezo.feature.goal.repository.GoalRepository;
import io.mrkuhne.mezo.feature.meal.service.FuelDayService;
import io.mrkuhne.mezo.feature.medication.entity.MedicationEntity;
import io.mrkuhne.mezo.feature.medication.repository.MedicationRepository;
import io.mrkuhne.mezo.feature.medication.service.MedicationCycleService;
import io.mrkuhne.mezo.feature.medication.service.dto.MedicationCycle;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.repository.MesocycleRepository;
import io.mrkuhne.mezo.feature.train.repository.RunSessionLogRepository;
import io.mrkuhne.mezo.feature.train.repository.SportSessionRepository;
import io.mrkuhne.mezo.feature.train.repository.WorkoutSessionRepository;
import io.mrkuhne.mezo.feature.train.service.GymScheduleService;
import io.mrkuhne.mezo.feature.train.service.SportService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

/**
 * V0.3 — the "pain-killer" (spec §4): renders today's cross-feature state as a compact,
 * deterministic Hungarian text block for the chat system prompt. Read-only composition of
 * EXISTING feature reads — companion depends on the other features, never the reverse.
 * Missing data renders as explicit "nincs adat", never invented; no LLM anywhere.
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class ContextSnapshotAssembler {

    static final String HEADER = "\n\nAKTUÁLIS ÁLLAPOT (pillanatkép — ";
    static final String NO_DATA = "nincs adat";
    /** dayOfWeek 0=Hétfő..6=Vasárnap (GymScheduleSlotEntity convention). */
    private static final List<String> HU_DAYS = List.of("H", "K", "Sze", "Cs", "P", "Szo", "V");

    private final BiometricProfileRepository biometricProfileRepository;
    private final WeightTrendService weightTrendService;
    private final GoalRepository goalRepository;
    private final MesocycleRepository mesocycleRepository;
    private final GymScheduleService gymScheduleService;
    private final SportService sportService;
    private final WorkoutSessionRepository workoutSessionRepository;
    private final SportSessionRepository sportSessionRepository;
    private final RunSessionLogRepository runSessionLogRepository;
    private final FuelDayService fuelDayService;
    private final ProtocolService protocolService;
    private final IntakeService intakeService;
    private final MedicationRepository medicationRepository;
    private final MedicationCycleService medicationCycleService;
    private final SleepLogRepository sleepLogRepository;
    private final CheckInRepository checkInRepository;
    private final CompanionProperties properties;

    public String render(UUID userId, LocalDate today) {
        return HEADER + today + "):\n"
                + profileBlock(userId, today) + '\n'
                + goalBlock(userId, today) + '\n'
                + trainBlock(userId, today) + '\n'
                + fuelBlock(userId, today) + '\n'
                + medicationBlock(userId, today) + '\n'
                + recoveryBlock(userId);
    }

    private String profileBlock(UUID userId, LocalDate today) {
        BiometricProfileEntity profile =
                biometricProfileRepository.findByCreatedByAndDeletedFalse(userId).orElse(null);
        WeightTrendResponse trend = weightTrendService.computeTrend(userId);
        StringBuilder b = new StringBuilder("[Profil] ");
        if (profile == null) {
            b.append(NO_DATA);
        } else {
            b.append(num(profile.getHeightCm())).append(" cm");
            if (profile.getBirthDate() != null) {
                b.append(", ").append(ChronoUnit.YEARS.between(profile.getBirthDate(), today)).append(" év");
            }
            b.append(", ").append("M".equals(profile.getSex()) ? "férfi" : "nő");
        }
        b.append("; súlytrend: ");
        if (trend.getLatestTrendKg() == null) {
            b.append(NO_DATA);
        } else {
            b.append(num(trend.getLatestTrendKg())).append(" kg");
            if (trend.getWeeklyRateKgPerWeek() != null) {
                b.append(", heti ").append(num(trend.getWeeklyRateKgPerWeek())).append(" kg");
            }
            if (trend.getWeeklyRatePctPerWeek() != null) {
                b.append(" (").append(num(trend.getWeeklyRatePctPerWeek())).append("%/hét)");
            }
        }
        return b.toString();
    }

    private String goalBlock(UUID userId, LocalDate today) {
        GoalEntity goal = goalRepository.findByCreatedByAndStatusAndDeletedFalse(userId, "active")
                .stream().findFirst().orElse(null);
        if (goal == null) {
            return "[Cél] " + NO_DATA;
        }
        StringBuilder b = new StringBuilder("[Cél] ");
        b.append(goal.getTitle()).append(" (").append(goal.getTrajectory()).append("): ")
                .append(num(goal.getStartWeightKg())).append(" → ")
                .append(goal.getTargetWeightKg() != null ? num(goal.getTargetWeightKg()) : "?")
                .append(" kg, ").append(goal.getStartDate()).append(" → ").append(goal.getTargetDate());
        long week = ChronoUnit.DAYS.between(goal.getStartDate(), today) / 7 + 1;
        b.append(", ").append(week).append(". hét");
        return b.toString();
    }

    private String trainBlock(UUID userId, LocalDate today) {
        StringBuilder b = new StringBuilder("[Edzés] mezociklus: ");
        MesocycleEntity meso = mesocycleRepository.findByCreatedByAndStatusAndDeletedFalse(userId, "active")
                .stream().findFirst().orElse(null);
        if (meso == null) {
            b.append(NO_DATA);
        } else {
            b.append(meso.getTitle());
            if (meso.getStartDate() != null && meso.getWeeks() != null && meso.getWeeks() > 0) {
                // week derived from startDate (TrainService.clampWeek idiom) — the stored currentWeek can lag
                long week = Math.clamp(
                        ChronoUnit.DAYS.between(meso.getStartDate(), today) / 7 + 1, 1, meso.getWeeks());
                b.append(" — ").append(week).append('/').append(meso.getWeeks()).append(". hét");
            }
            if (meso.getSplit() != null) {
                b.append(" (").append(meso.getSplit()).append(')');
            }
        }
        List<GymScheduleSlotResponse> gym = gymScheduleService.getSchedule(userId);
        b.append("; gym-rend: ").append(gym.isEmpty() ? NO_DATA : gym.stream()
                .map(s -> huDay(s.getDayOfWeek()) + " " + s.getTime())
                .collect(Collectors.joining(", ")));
        List<SportScheduleSlotResponse> sport = sportService.getSchedule(userId);
        b.append("; sport-rend: ").append(sport.isEmpty() ? NO_DATA : sport.stream()
                .map(s -> huDay(s.getDayOfWeek()) + " " + s.getTime()
                        + (s.getKind() != null ? " " + s.getKind().getValue() : "")
                        + (s.getDurationMin() != null ? " (" + s.getDurationMin() + " perc)" : ""))
                .collect(Collectors.joining(", ")));
        int digestDays = properties.snapshot().digestDays();
        LocalDate from = today.minusDays(digestDays - 1L);
        List<LocalDate> gymDates = workoutSessionRepository.findDoneInstanceDates(userId, from, today)
                .stream().sorted().toList();
        int sportCount = sportSessionRepository
                .findByCreatedByAndDeletedFalseAndDateGreaterThanEqualOrderByDateDesc(userId, from).size();
        int runCount = runSessionLogRepository
                .findByCreatedByAndDeletedFalseAndDateGreaterThanEqualOrderByDateDesc(userId, from).size();
        b.append("; elmúlt ").append(digestDays).append(" nap: ").append(gymDates.size()).append(" gym-edzés");
        if (!gymDates.isEmpty()) {
            b.append(" (").append(gymDates.stream().map(LocalDate::toString)
                    .collect(Collectors.joining(", "))).append(')');
        }
        b.append(", ").append(sportCount).append(" sportalkalom, ").append(runCount).append(" futás");
        return b.toString();
    }

    private String fuelBlock(UUID userId, LocalDate today) {
        FuelDayResponse day = fuelDayService.getDay(userId, today);
        MacroSet c = day.getConsumed();
        MacroSet t = day.getTargets();
        StringBuilder b = new StringBuilder("[Mai üzemanyag] ");
        b.append(num(c.getKcal())).append('/').append(num(t.getKcal())).append(" kcal, fehérje ")
                .append(num(c.getP())).append('/').append(num(t.getP())).append(" g, szénhidrát ")
                .append(num(c.getC())).append('/').append(num(t.getC())).append(" g, zsír ")
                .append(num(c.getF())).append('/').append(num(t.getF())).append(" g, víz ")
                .append(num(c.getWater())).append('/').append(num(t.getWater())).append(" ml");
        ProtocolResponse active = protocolService.getView(userId).getActive();
        b.append("; protokoll: ").append(active == null ? NO_DATA : "v" + active.getVersion() + " aktív");
        b.append(", mai bevitel: ").append(intakeService.listForDay(userId, today).getIntakes().size());
        return b.toString();
    }

    private String medicationBlock(UUID userId, LocalDate today) {
        MedicationEntity med =
                medicationRepository.findFirstByCreatedByAndActiveTrueAndDeletedFalse(userId).orElse(null);
        if (med == null) {
            return "[Gyógyszer] " + NO_DATA;
        }
        MedicationCycle cycle = medicationCycleService.derive(userId, med, today);
        if (cycle.retaDay() == 0) {
            // honest zero — active med but no recorded dose to anchor the cycle
            return "[Gyógyszer] " + med.getName() + ": nincs rögzített dózis";
        }
        return "[Gyógyszer] " + med.getName() + ": ciklus " + cycle.retaDay() + ". nap ("
                + cycle.phaseLabel() + ")";
    }

    private String recoveryBlock(UUID userId) {
        StringBuilder b = new StringBuilder("[Regeneráció] alvás");
        SleepLogEntity sleep =
                sleepLogRepository.findFirstByCreatedByAndDeletedFalseOrderByDateDesc(userId).orElse(null);
        if (sleep == null) {
            b.append(": ").append(NO_DATA);
        } else {
            b.append(" (").append(sleep.getDate()).append("): ").append(num(sleep.getDurationH())).append(" h");
            if (sleep.getQuality() != null) {
                b.append(", minőség ").append(sleep.getQuality()).append("/5");
            }
        }
        b.append("; check-in");
        CheckInEntity checkIn = checkInRepository
                .findFirstByCreatedByAndDeletedFalseOrderByDateDescSlotTimeDesc(userId).orElse(null);
        if (checkIn == null) {
            b.append(": ").append(NO_DATA);
        } else {
            b.append(" (").append(checkIn.getDate()).append(' ').append(checkIn.getSlotTime()).append("): ")
                    .append("energia ").append(checkIn.getEnergy()).append("/5, stressz ")
                    .append(checkIn.getStress()).append("/5");
            if (checkIn.getNote() != null && !checkIn.getNote().isBlank()) {
                int max = properties.snapshot().checkinNoteMaxChars();
                String note = checkIn.getNote();
                b.append(", megjegyzés: \"")
                        .append(note.length() <= max ? note : note.substring(0, max) + "…").append('"');
            }
        }
        return b.toString();
    }

    /** Locale-independent compact number: strip trailing zeros, plain (non-scientific) string. */
    private static String num(BigDecimal v) {
        return v == null ? "?" : v.stripTrailingZeros().toPlainString();
    }

    private static String huDay(Integer dayOfWeek) {
        return dayOfWeek != null && dayOfWeek >= 0 && dayOfWeek < 7 ? HU_DAYS.get(dayOfWeek) : "?";
    }
}
