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
import io.mrkuhne.mezo.feature.biometrics.sleep.service.SleepAnchorPort;
import io.mrkuhne.mezo.feature.biometrics.weight.service.WeightTrendService;
import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import io.mrkuhne.mezo.feature.fuel.service.IntakeService;
import io.mrkuhne.mezo.feature.fuel.service.ProtocolService;
import io.mrkuhne.mezo.feature.goal.entity.GoalEntity;
import io.mrkuhne.mezo.feature.goal.entity.GoalPrescriptionJson;
import io.mrkuhne.mezo.feature.goal.repository.GoalRepository;
import io.mrkuhne.mezo.feature.meal.service.FuelDayService;
import io.mrkuhne.mezo.feature.medication.entity.MedicationEntity;
import io.mrkuhne.mezo.feature.medication.repository.MedicationRepository;
import io.mrkuhne.mezo.feature.medication.service.MedicationCycleService;
import io.mrkuhne.mezo.feature.medication.service.dto.MedicationCycle;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.MesocycleEntity;
import io.mrkuhne.mezo.feature.train.entity.RunningBlockEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.repository.ExerciseRepository;
import io.mrkuhne.mezo.feature.train.repository.MesocycleRepository;
import io.mrkuhne.mezo.feature.train.repository.RunSessionLogRepository;
import io.mrkuhne.mezo.feature.train.repository.RunningBlockRepository;
import io.mrkuhne.mezo.feature.train.repository.SportSessionRepository;
import io.mrkuhne.mezo.feature.train.repository.WorkoutSessionRepository;
import io.mrkuhne.mezo.feature.train.service.GymScheduleService;
import io.mrkuhne.mezo.feature.train.service.SportService;
import io.mrkuhne.mezo.feature.train.service.WorkoutService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
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
    private static final DateTimeFormatter HH_MM = DateTimeFormatter.ofPattern("HH:mm");

    private final BiometricProfileRepository biometricProfileRepository;
    private final WeightTrendService weightTrendService;
    private final GoalRepository goalRepository;
    private final MesocycleRepository mesocycleRepository;
    private final GymScheduleService gymScheduleService;
    private final SportService sportService;
    private final WorkoutService workoutService;
    private final WorkoutSessionRepository workoutSessionRepository;
    private final ExerciseRepository exerciseRepository;
    private final SportSessionRepository sportSessionRepository;
    private final RunSessionLogRepository runSessionLogRepository;
    private final RunningBlockRepository runningBlockRepository;
    private final FuelDayService fuelDayService;
    private final ProtocolService protocolService;
    private final IntakeService intakeService;
    private final MedicationRepository medicationRepository;
    private final MedicationCycleService medicationCycleService;
    private final SleepLogRepository sleepLogRepository;
    private final CheckInRepository checkInRepository;
    private final SleepAnchorPort sleepAnchorPort;
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
        // empty series = no weigh-ins at all — the service's zeros would read as fabricated numbers
        if (trend.getLatestTrendKg() == null || trend.getEwmaSeries().isEmpty()) {
            b.append(NO_DATA);
        } else {
            b.append(num(trend.getLatestTrendKg())).append(" kg");
            // rates are only defined from 2+ distinct days (NONE = no slope yet)
            if (trend.getDataSufficiency() != WeightTrendResponse.DataSufficiencyEnum.NONE) {
                if (trend.getWeeklyRateKgPerWeek() != null) {
                    b.append(", heti ").append(num(trend.getWeeklyRateKgPerWeek())).append(" kg");
                }
                if (trend.getWeeklyRatePctPerWeek() != null) {
                    b.append(" (").append(num(trend.getWeeklyRatePctPerWeek())).append("%/hét)");
                }
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
        GoalPrescriptionJson.Segment seg = GoalPrescriptionJson.currentSegment(goal.getPrescription(), week);
        if (seg != null) {
            b.append("; e heti recept: ").append(seg.kcal()).append(" kcal, ")
                    .append(seg.proteinG()).append(" g fehérje");
            if (seg.sleepTargetH() != null) {
                b.append(", alvás ").append(num(seg.sleepTargetH())).append(" h");
            }
            if (seg.restDays() != null && !seg.restDays().isEmpty()) {
                b.append(", pihenőnap: ").append(seg.restDays().stream()
                        .map(ContextSnapshotAssembler::huDay).collect(Collectors.joining(", ")));
            }
        }
        if (goal.getMealsPerDay() != null) {
            b.append("; étkezés/nap: ").append(goal.getMealsPerDay());
        }
        // Day anchor is owned by the sleep goal (SleepAnchorPort), not the retired goal columns.
        // The resolver never returns empty (config ghost when no row), so these always render.
        SleepAnchorPort.SleepAnchor anchor = sleepAnchorPort.resolve(userId);
        b.append(", ébredés: ").append(anchor.wake().format(HH_MM))
                .append(", lefekvés: ").append(anchor.bed().format(HH_MM));
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
        // Dated resolution (mezo-xixu, the flagship fix): what's ACTUALLY on today/tomorrow,
        // not just the recurring weekly pattern below — the chat's #1 hallucination source.
        List<SportScheduleSlotResponse> sport = sportService.getSchedule(userId);
        b.append("; Ma: ").append(todayLine(userId, today));
        b.append("; Holnap: ").append(tomorrowLine(userId, today, sport));
        // Recurring weekly pattern + backward digest — kept as TRAILING background context.
        List<GymScheduleSlotResponse> gym = gymScheduleService.getSchedule(userId);
        b.append("; gym-rend: ").append(gym.isEmpty() ? NO_DATA : gym.stream()
                .map(s -> huDay(s.getDayOfWeek()) + " " + s.getTime())
                .collect(Collectors.joining(", ")));
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

    /**
     * Ma: today's DATED resolution — the active meso's template day for today's HU weekday
     * (same read-only lookup as {@link #tomorrowLine}, mezo-xixu). Deliberately does NOT call
     * {@link WorkoutService#getToday}: that method is write-transactional (auto-closes stale
     * instances, ensures closing exercises) and the snapshot renders on every chat turn — a
     * read triggering writes on every turn would violate this assembler's read-only contract.
     */
    private String todayLine(UUID userId, LocalDate today) {
        Optional<WorkoutSessionEntity> todayTemplate = workoutService.findPlannedTemplateForDate(userId, today);
        if (todayTemplate.isEmpty()) {
            return "pihenőnap";
        }
        WorkoutSessionEntity t = todayTemplate.get();
        List<ExerciseEntity> exercises = exerciseRepository
                .findByCreatedByAndWorkoutSessionIdInOrderByOrderIndexAsc(userId, List.of(t.getId()));
        if (exercises.isEmpty()) {
            return "pihenőnap";
        }
        String label = t.getDayLabel() != null ? t.getDayLabel() : "gym";
        return label + ": " + exercises.stream()
                .map(e -> exerciseLine(e.getName(), e.getWorkingSets(), e.getRepMin(), e.getRepMax()))
                .collect(Collectors.joining(", "));
    }

    /**
     * Holnap: tomorrow's DATED resolution — the active meso's template day for tomorrow's HU
     * weekday (present ⇒ GYM, absent ⇒ REST; meso-template-based, no gym_schedule_slot needed),
     * any recurring sport-schedule slot on that weekday, and the active running block's
     * prescribed session for that weekday (best-effort — absent block/week renders nothing, never
     * fabricated).
     */
    private String tomorrowLine(UUID userId, LocalDate today, List<SportScheduleSlotResponse> sport) {
        LocalDate tomorrow = today.plusDays(1);
        int tomorrowDow = tomorrow.getDayOfWeek().getValue() - 1; // 0=Hét..6=Vas (schedule-slot convention)
        List<String> parts = new ArrayList<>();
        Optional<WorkoutSessionEntity> tomorrowTemplate = workoutService.findPlannedTemplateForDate(userId, tomorrow);
        if (tomorrowTemplate.isPresent()) {
            WorkoutSessionEntity t = tomorrowTemplate.get();
            List<ExerciseEntity> exercises = exerciseRepository
                    .findByCreatedByAndWorkoutSessionIdInOrderByOrderIndexAsc(userId, List.of(t.getId()));
            String gymPart = "gym (" + t.getDayLabel() + ")";
            if (!exercises.isEmpty()) {
                gymPart += ": " + exercises.stream()
                        .map(e -> exerciseLine(e.getName(), e.getWorkingSets(), e.getRepMin(), e.getRepMax()))
                        .collect(Collectors.joining(", "));
            }
            parts.add(gymPart);
        } else {
            parts.add("pihenőnap (gym)");
        }
        sport.stream()
                .filter(s -> s.getDayOfWeek() != null && s.getDayOfWeek() == tomorrowDow)
                .forEach(s -> parts.add("sport: " + s.getSport() + " " + s.getTime()
                        + (s.getKind() != null ? " " + s.getKind().getValue() : "")
                        + (s.getDurationMin() != null ? " (" + s.getDurationMin() + " perc)" : "")));
        runningBlockRepository.findByCreatedByAndStatusAndDeletedFalse(userId, "active").stream().findFirst()
                .flatMap(block -> tomorrowRunPart(block, today, tomorrowDow))
                .ifPresent(parts::add);
        return String.join(", ", parts);
    }

    /** The active running block's prescribed session for tomorrow's weekday, if the plan has one. */
    private Optional<String> tomorrowRunPart(RunningBlockEntity block, LocalDate today, int tomorrowDow) {
        if (block.getStructure() == null || block.getWeeks() == null || block.getWeeks() <= 0
                || block.getStartDate() == null) {
            return Optional.empty();
        }
        // week derived from startDate (TrainService.clampWeek idiom), mirrors the meso week above.
        long week = Math.clamp(ChronoUnit.DAYS.between(block.getStartDate(), today) / 7 + 1, 1, block.getWeeks());
        return block.getStructure().weeks().stream()
                .filter(w -> w.weekNumber() != null && w.weekNumber() == week)
                .findFirst()
                .flatMap(w -> w.sessions().stream()
                        .filter(s -> s.dayOfWeek() != null && s.dayOfWeek() == tomorrowDow)
                        .findFirst())
                .map(s -> "futás: " + s.label());
    }

    /**
     * "{name} {workingSets}×{repMin}-{repMax}" — the compact exercise descriptor for Ma:/Holnap:.
     * Null-guarded: a missing rep range (or set count) must never render the literal "null" into
     * the LLM prompt, so each piece is rendered only when present.
     */
    private static String exerciseLine(String name, Integer workingSets, Integer repMin, Integer repMax) {
        StringBuilder b = new StringBuilder(name).append(' ').append(workingSets != null ? workingSets : "?");
        if (repMin != null && repMax != null) {
            b.append('×').append(repMin).append('-').append(repMax);
        }
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
