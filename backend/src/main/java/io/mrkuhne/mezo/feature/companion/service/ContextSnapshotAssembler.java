package io.mrkuhne.mezo.feature.companion.service;

import io.mrkuhne.mezo.api.dto.FuelDayResponse;
import io.mrkuhne.mezo.api.dto.GamificationProfileResponse;
import io.mrkuhne.mezo.api.dto.GrowthWeekResponse;
import io.mrkuhne.mezo.api.dto.GymScheduleSlotResponse;
import io.mrkuhne.mezo.api.dto.HabitSummaryResponse;
import io.mrkuhne.mezo.api.dto.IntentionDayResponse;
import io.mrkuhne.mezo.api.dto.IntentionFocusResponse;
import io.mrkuhne.mezo.api.dto.MacroSet;
import io.mrkuhne.mezo.api.dto.ProgressionProfileResponse;
import io.mrkuhne.mezo.api.dto.ProtocolResponse;
import io.mrkuhne.mezo.api.dto.RitualDayResponse;
import io.mrkuhne.mezo.api.dto.SkillLevel;
import io.mrkuhne.mezo.api.dto.SportScheduleSlotResponse;
import io.mrkuhne.mezo.api.dto.WeightTrendResponse;
import io.mrkuhne.mezo.feature.biometrics.checkin.entity.CheckInEntity;
import io.mrkuhne.mezo.feature.biometrics.checkin.repository.CheckInRepository;
import io.mrkuhne.mezo.feature.biometrics.profile.entity.BiometricProfileEntity;
import io.mrkuhne.mezo.feature.biometrics.profile.repository.BiometricProfileRepository;
import io.mrkuhne.mezo.feature.biometrics.sleep.entity.SleepLogEntity;
import io.mrkuhne.mezo.feature.biometrics.sleep.repository.SleepLogRepository;
import io.mrkuhne.mezo.feature.biometrics.sleep.service.SleepAnchorPort;
import io.mrkuhne.mezo.feature.biometrics.weight.repository.WeightLogRepository;
import io.mrkuhne.mezo.feature.biometrics.weight.service.WeightTrendService;
import io.mrkuhne.mezo.feature.companion.TodayQuestSource;
import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import io.mrkuhne.mezo.feature.companion.tools.ToolText;
import io.mrkuhne.mezo.feature.fuel.service.IntakeService;
import io.mrkuhne.mezo.feature.fuel.service.ProtocolService;
import io.mrkuhne.mezo.feature.gamification.service.GamificationService;
import io.mrkuhne.mezo.feature.goal.entity.GoalEntity;
import io.mrkuhne.mezo.feature.goal.entity.GoalPrescriptionJson;
import io.mrkuhne.mezo.feature.goal.repository.GoalRepository;
import io.mrkuhne.mezo.feature.habit.service.HabitService;
import io.mrkuhne.mezo.feature.intention.service.IntentionService;
import io.mrkuhne.mezo.feature.meal.service.FuelDayService;
import io.mrkuhne.mezo.feature.medication.entity.MedicationEntity;
import io.mrkuhne.mezo.feature.medication.repository.MedicationRepository;
import io.mrkuhne.mezo.feature.medication.service.MedicationCycleService;
import io.mrkuhne.mezo.feature.medication.service.dto.MedicationCycle;
import io.mrkuhne.mezo.feature.progression.service.GrowthWeekService;
import io.mrkuhne.mezo.feature.progression.service.ProgressionService;
import io.mrkuhne.mezo.feature.ritual.service.RitualService;
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
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.ObjectProvider;
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
    /** [Növekedés]'s skill highlight cap — terse, not a full profile dump. */
    private static final int TOP_SKILLS_LIMIT = 3;

    private final BiometricProfileRepository biometricProfileRepository;
    private final WeightTrendService weightTrendService;
    private final WeightLogRepository weightLogRepository;
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
    private final ObjectProvider<GamificationService> gamificationService;
    private final ProgressionService progressionService;
    private final GrowthWeekService growthWeekService;
    private final ObjectProvider<TodayQuestSource> todayQuestSource;
    private final ObjectProvider<HabitService> habitService;
    private final ObjectProvider<IntentionService> intentionService;
    private final ObjectProvider<RitualService> ritualService;
    private final CompanionProperties properties;

    public String render(UUID userId, LocalDate today) {
        return HEADER + today + "):\n"
                + profileBlock(userId, today, true) + '\n'
                + goalBlock(userId, today) + '\n'
                + trainBlock(userId, today) + '\n'
                + growthBlock(userId, today) + '\n'
                + practiceBlock(userId, today) + '\n'
                + fuelBlock(userId, today) + '\n'
                + medicationBlock(userId, today) + '\n'
                + recoveryBlock(userId, today, true);
    }

    /**
     * The morning-message variant (companion-feed, spec §3): same block composition as
     * {@link #render}, but strips weight/sleep entirely at the source — the morning message is
     * generated BEFORE those get logged for the day, and a prompt prohibition alone is not
     * enough (the model would still see and could still leak the numbers).
     */
    public String renderWithoutBiometrics(UUID userId, LocalDate today) {
        return HEADER + today + "):\n"
                + profileBlock(userId, today, false) + '\n'
                + goalBlock(userId, today) + '\n'
                + trainBlock(userId, today) + '\n'
                + growthBlock(userId, today) + '\n'
                + practiceBlock(userId, today) + '\n'
                + fuelBlock(userId, today) + '\n'
                + medicationBlock(userId, today) + '\n'
                + recoveryBlock(userId, today, false);
    }

    private String profileBlock(UUID userId, LocalDate today, boolean withWeight) {
        BiometricProfileEntity profile =
                biometricProfileRepository.findByCreatedByAndDeletedFalse(userId).orElse(null);
        StringBuilder b = new StringBuilder("[Profil] ");
        if (profile == null) {
            b.append(NO_DATA);
        } else {
            b.append(ToolText.num(profile.getHeightCm())).append(" cm");
            if (profile.getBirthDate() != null) {
                b.append(", ").append(ChronoUnit.YEARS.between(profile.getBirthDate(), today)).append(" év");
            }
            b.append(", ").append("M".equals(profile.getSex()) ? "férfi" : "nő");
        }
        if (!withWeight) {
            return b.toString();
        }
        b.append("; mérés: ");
        weightLogRepository.findFirstByCreatedByAndDeletedFalseOrderByDateDescCreatedAtDesc(userId)
                .ifPresentOrElse(
                        w -> b.append(ToolText.num(w.getWeightKg())).append(" kg (").append(w.getDate()).append(')'),
                        () -> b.append(NO_DATA));
        b.append("; súlytrend: ");
        WeightTrendResponse trend = weightTrendService.computeTrend(userId);
        // empty series = no weigh-ins at all — the service's zeros would read as fabricated numbers
        if (trend.getLatestTrendKg() == null || trend.getEwmaSeries().isEmpty()) {
            b.append(NO_DATA);
        } else {
            b.append(ToolText.num(trend.getLatestTrendKg())).append(" kg");
            // rates are only defined from 2+ distinct days (NONE = no slope yet)
            if (trend.getDataSufficiency() != WeightTrendResponse.DataSufficiencyEnum.NONE) {
                if (trend.getWeeklyRateKgPerWeek() != null) {
                    b.append(", heti ").append(ToolText.num(trend.getWeeklyRateKgPerWeek())).append(" kg");
                }
                if (trend.getWeeklyRatePctPerWeek() != null) {
                    b.append(" (").append(ToolText.num(trend.getWeeklyRatePctPerWeek())).append("%/hét)");
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
                .append(ToolText.num(goal.getStartWeightKg())).append(" → ")
                .append(goal.getTargetWeightKg() != null ? ToolText.num(goal.getTargetWeightKg()) : "?")
                .append(" kg, ").append(goal.getStartDate()).append(" → ").append(goal.getTargetDate());
        long week = ChronoUnit.DAYS.between(goal.getStartDate(), today) / 7 + 1;
        b.append(", ").append(week).append(". hét");
        GoalPrescriptionJson.Segment seg = GoalPrescriptionJson.currentSegment(goal.getPrescription(), week);
        if (seg != null) {
            b.append("; e heti recept: ").append(seg.kcal()).append(" kcal, ")
                    .append(seg.proteinG()).append(" g fehérje");
            if (seg.sleepTargetH() != null) {
                b.append(", alvás ").append(ToolText.num(seg.sleepTargetH())).append(" h");
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
        b.append("; Ma (terv): ").append(dayLine(userId, today, today, sport));
        b.append("; ").append(todayLoggedLine(userId, today));
        b.append("; Holnap (terv): ").append(dayLine(userId, today, today.plusDays(1), sport));
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
     * What is ACTUALLY logged for today (mezo-xrhd) — the antidote to reading the plan as history.
     * The dated "Ma (terv):" line above is a PLAN and nothing else; without this line beside it the
     * only completion signal was the trailing "elmúlt N nap" digest, which the companion-feed
     * midday note ignored, telling Daniel he was done with a workout he had not started. Gym uses
     * the same completed-instance signal as the habit metric "training_done_today"; sport and run
     * count today's own logs.
     */
    private String todayLoggedLine(UUID userId, LocalDate today) {
        boolean gymDone = !workoutSessionRepository.findDoneInstanceDates(userId, today, today).isEmpty();
        long sportToday = sportSessionRepository
                .findByCreatedByAndDeletedFalseAndDateGreaterThanEqualOrderByDateDesc(userId, today)
                .stream().filter(s -> today.equals(s.getDate())).count();
        long runToday = runSessionLogRepository
                .findByCreatedByAndDeletedFalseAndDateGreaterThanEqualOrderByDateDesc(userId, today)
                .stream().filter(r -> today.equals(r.getDate())).count();
        return "Ma eddig naplózva: gym: " + (gymDone ? "elvégezve" : "nincs elvégzett edzés")
                + "; sport: " + sportToday + " alkalom; futás: " + runToday + " alkalom";
    }

    /**
     * One day's DATED resolution — the active meso's template day for that HU weekday (present ⇒
     * GYM, absent ⇒ REST; meso-template-based, no gym_schedule_slot needed), any recurring
     * sport-schedule slot on that weekday, and the active running block's prescribed session for
     * that weekday (best-effort — absent block/week renders nothing, never fabricated).
     *
     * <p>Ma: and Holnap: share this ONE method (mezo-ajp): they used to be two near-identical
     * renderers that had drifted apart — "Ma" resolved gym only, so today's sport and run were
     * invisible and the model had to re-derive them from the trailing weekly "sport-rend" pattern,
     * the very hallucination path the dated resolution exists to remove.
     *
     * <p>Deliberately does NOT call {@link WorkoutService#getToday}: that method is
     * write-transactional (auto-closes stale instances, ensures closing exercises) and the snapshot
     * renders on every chat turn — a read triggering writes on every turn would violate this
     * assembler's read-only contract.
     */
    private String dayLine(UUID userId, LocalDate today, LocalDate date,
            List<SportScheduleSlotResponse> sport) {
        int dow = date.getDayOfWeek().getValue() - 1; // 0=Hét..6=Vas (schedule-slot convention)
        List<String> parts = new ArrayList<>();
        Optional<WorkoutSessionEntity> template = workoutService.findPlannedTemplateForDate(userId, date);
        List<ExerciseEntity> exercises = template.map(t -> exerciseRepository
                .findByCreatedByAndWorkoutSessionIdInOrderByOrderIndexAsc(userId, List.of(t.getId())))
                .orElse(List.of());
        // mezo-4qu: the gym half comes from the SHARED ToolText.gymLine, the same way the sport half
        // comes from ToolText.sportLine — the criterion that a present-but-EMPTY meso template day
        // is a REST day (the mezo-650a weekend-training hallucination) now lives in ONE place, so
        // this renderer and TrainTools#dayContentLine cannot drift apart again.
        parts.add(ToolText.gymLine(
                template.map(WorkoutSessionEntity::getDayLabel).orElse(null),
                exercises.stream()
                        .map(e -> ToolText.exerciseLine(e.getName(), e.getWorkingSets(), e.getRepMin(), e.getRepMax()))
                        .toList()));
        sport.stream()
                .filter(s -> s.getDayOfWeek() != null && s.getDayOfWeek() == dow)
                .forEach(s -> parts.add(ToolText.sportLine(s.getSport(), s.getTime(),
                        s.getKind() == null ? null : s.getKind().getValue(), s.getDurationMin())));
        runningBlockRepository.findByCreatedByAndStatusAndDeletedFalse(userId, "active").stream().findFirst()
                .flatMap(block -> runPart(block, today, dow))
                .ifPresent(parts::add);
        return String.join(", ", parts);
    }

    /** The active running block's prescribed session for weekday {@code dow}, if the plan has one. */
    private Optional<String> runPart(RunningBlockEntity block, LocalDate today, int dow) {
        if (block.getStructure() == null || block.getWeeks() == null || block.getWeeks() <= 0
                || block.getStartDate() == null) {
            return Optional.empty();
        }
        // week derived from startDate (TrainService.clampWeek idiom), mirrors the meso week above.
        // Ma: and Holnap: are at most one day apart, so both resolve from `today`'s week — the
        // block's own start date, not the rendered date, is what fixes which week we are in.
        long week = Math.clamp(ChronoUnit.DAYS.between(block.getStartDate(), today) / 7 + 1, 1, block.getWeeks());
        return block.getStructure().weeks().stream()
                .filter(w -> w.weekNumber() != null && w.weekNumber() == week)
                .findFirst()
                .flatMap(w -> w.sessions().stream()
                        .filter(s -> s.dayOfWeek() != null && s.dayOfWeek() == dow)
                        .findFirst())
                .map(s -> "futás: " + s.label());
    }

    /**
     * [Növekedés]: account level + coins + streak (Gamification — a fresh account's level 1 /
     * 0 coins is a real ghost, not fabricated; GAMIFICATION_SWITCH-gated, so the bean can be
     * absent while COMPANION_SWITCH stays on — read defensively via {@link ObjectProvider}),
     * the highest-earned skills (Progression — the taxonomy's level-1/0-XP ghost rows are
     * filtered out; an untouched skill would otherwise read as a fabricated fact), and this
     * week's XP/quest rollup (GrowthWeek — honest zeros, a real computed window, the
     * goalBlock/fuelBlock precedent).
     */
    private String growthBlock(UUID userId, LocalDate today) {
        GamificationService gamification = gamificationService.getIfAvailable();
        GamificationProfileResponse gami = gamification == null ? null : gamification.getProfile(userId);
        ProgressionProfileResponse prog = progressionService.getProfile(userId);
        GrowthWeekResponse week = growthWeekService.growthWeek(userId, today);
        StringBuilder b = new StringBuilder("[Növekedés] szint ");
        if (gami == null) {
            b.append(NO_DATA);
        } else {
            b.append(gami.getLevel())
                    .append(" (").append(gami.getTotalXp()).append(" XP), ")
                    .append(gami.getCoins()).append(" érme, ")
                    .append(gami.getStreakDays()).append(" napos sorozat");
        }
        List<SkillLevel> top = topSkills(prog);
        b.append("; top skill: ").append(top.isEmpty() ? NO_DATA : top.stream()
                .map(s -> s.getSkillKey() + " L" + s.getLevel())
                .collect(Collectors.joining(", ")));
        b.append("; e heti XP: ").append(week.getLifeXp())
                .append(" (küldetés ").append(week.getQuestCompleted()).append('/')
                .append(week.getQuestClosed()).append(" zárva)");
        return b.toString();
    }

    /** Highest-level skills with real XP (0-XP taxonomy ghosts excluded), across all 3 kinds. */
    private static List<SkillLevel> topSkills(ProgressionProfileResponse prog) {
        List<SkillLevel> all = new ArrayList<>();
        all.addAll(prog.getAthletic());
        all.addAll(prog.getMuscle());
        all.addAll(prog.getLife());
        return all.stream()
                .filter(s -> s.getCumulativeXp() != null && s.getCumulativeXp() > 0)
                .sorted(Comparator.comparingInt(SkillLevel::getLevel).reversed()
                        .thenComparing(Comparator.comparingLong(SkillLevel::getCumulativeXp).reversed()))
                .limit(TOP_SKILLS_LIMIT)
                .toList();
    }

    /**
     * [Napi gyakorlat]: today's quest completion count via {@link TodayQuestSource} — a port
     * companion owns so the read stays quest → companion (never back: quest already depends on
     * companion for {@code QuestFlavor}'s AI rewriting, so a direct import here would form a
     * 2-slice cycle; {@code progression.QuestLedgerSource} is the precedent) and deliberately
     * bypasses {@link io.mrkuhne.mezo.feature.quest.service.QuestService#getDay}, which lazily
     * generates today's rows and awards XP on derived-quest evaluation ({@code @Transactional},
     * not read-only; the {@link #todayLine} / {@link #tomorrowLine} precedent above applies
     * equally: a read that fires writes on every chat turn would violate this assembler's
     * read-only contract) — plus habit-chain strength ({@link HabitService#summary}, already
     * read-only), the standing creed / today's foci / evening reflection (Intention), and whether
     * today's napzárás is closed (Ritual). {@code HabitService}/{@code IntentionService}/
     * {@code RitualService} each carry their own feature switch (HABIT_SWITCH/INTENTION_SWITCH/
     * RITUAL_SWITCH) independent of COMPANION_SWITCH, so each is read defensively via
     * {@link ObjectProvider} — the {@link #todayQuestSource} precedent. Honest absence per part,
     * never fabricated.
     */
    private String practiceBlock(UUID userId, LocalDate today) {
        TodayQuestSource questSource = todayQuestSource.getIfAvailable();
        TodayQuestSource.Stats quest = questSource == null ? null : questSource.todayStats(userId, today);
        StringBuilder b = new StringBuilder("[Napi gyakorlat] küldetés: ");
        if (quest == null || quest.total() == 0) {
            b.append(NO_DATA);
        } else {
            b.append(quest.completed()).append('/').append(quest.total());
        }

        HabitService habitSvc = habitService.getIfAvailable();
        HabitSummaryResponse habits = habitSvc == null ? null : habitSvc.summary(userId);
        b.append("; szokás-lánc: ");
        if (habits == null) {
            b.append(NO_DATA);
        } else {
            b.append("reggeli ").append(habits.getPerfectMorningDays30())
                    .append(", esti ").append(habits.getPerfectEveningDays30())
                    .append(" tökéletes nap (30 nap)");
        }

        IntentionService intentionSvc = intentionService.getIfAvailable();
        IntentionDayResponse intention = intentionSvc == null ? null : intentionSvc.getDay(userId, today);
        b.append("; hitvallás: ").append(intention == null || intention.getCreed() == null
                ? NO_DATA : intention.getCreed());
        b.append(", mai fókusz: ").append(intention == null || intention.getFoci().isEmpty() ? NO_DATA
                : intention.getFoci().stream().map(IntentionFocusResponse::getText)
                        .collect(Collectors.joining(", ")));
        if (intention != null && intention.getReflection() != null) {
            b.append(", esti reflexió: ").append(huReflection(intention.getReflection()));
        }

        RitualService ritualSvc = ritualService.getIfAvailable();
        RitualDayResponse ritual = ritualSvc == null ? null : ritualSvc.getDay(userId, today);
        b.append("; napzárás: ").append(ritual == null ? NO_DATA
                : (Boolean.TRUE.equals(ritual.getClosed()) ? "zárva" : "nyitva"));
        return b.toString();
    }

    /** Raw enum value ("yes"/"partial"/"no") would leak English into an otherwise-Hungarian block. */
    private static String huReflection(IntentionDayResponse.ReflectionEnum reflection) {
        return switch (reflection) {
            case YES -> "igen";
            case PARTIAL -> "részben";
            case NO -> "nem";
        };
    }

    private String fuelBlock(UUID userId, LocalDate today) {
        FuelDayResponse day = fuelDayService.getDay(userId, today);
        MacroSet c = day.getConsumed();
        MacroSet t = day.getTargets();
        StringBuilder b = new StringBuilder("[Mai üzemanyag] ");
        b.append(ToolText.num(c.getKcal())).append('/').append(ToolText.num(t.getKcal())).append(" kcal, fehérje ")
                .append(ToolText.num(c.getP())).append('/').append(ToolText.num(t.getP())).append(" g, szénhidrát ")
                .append(ToolText.num(c.getC())).append('/').append(ToolText.num(t.getC())).append(" g, zsír ")
                .append(ToolText.num(c.getF())).append('/').append(ToolText.num(t.getF())).append(" g, víz ")
                .append(ToolText.num(c.getWater())).append('/').append(ToolText.num(t.getWater())).append(" ml");
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
        if (cycle.cycleDay() == 0) {
            // honest zero — active med but no recorded dose to anchor the cycle
            return "[Gyógyszer] " + med.getName() + ": nincs rögzített dózis";
        }
        return "[Gyógyszer] " + med.getName() + ": ciklus " + cycle.cycleDay() + ". nap ("
                + cycle.phaseLabel() + ")";
    }

    private String recoveryBlock(UUID userId, LocalDate today, boolean withSleep) {
        StringBuilder b = new StringBuilder("[Regeneráció]");
        if (withSleep) {
            b.append(" alvás");
            SleepLogEntity sleep =
                    sleepLogRepository.findFirstByCreatedByAndDeletedFalseOrderByDateDesc(userId).orElse(null);
            if (sleep == null) {
                b.append(": ").append(NO_DATA);
            } else {
                b.append(" (").append(sleep.getDate()).append("): ").append(ToolText.num(sleep.getDurationH())).append(" h");
                if (sleep.getQuality() != null) {
                    b.append(", minőség ").append(sleep.getQuality()).append("/5");
                }
            }
            b.append(";");
        }
        b.append(" check-in");
        CheckInEntity checkIn = checkInRepository
                .findFirstByCreatedByAndDeletedFalseOrderByDateDescSlotTimeDesc(userId).orElse(null);
        if (checkIn == null) {
            b.append(": ").append(NO_DATA);
        } else if (!today.equals(checkIn.getDate())) {
            // mezo-xrhd: the latest check-in EVER used to render with its date and nothing else, so
            // "no check-in today" was something the model had to derive — and silently didn't. The
            // last check-in's values and note stay in the payload: they are still real context.
            b.append(": MA MÉG NINCS (utolsó: ").append(checkIn.getDate()).append(' ')
                    .append(checkIn.getSlotTime()).append(" — ").append(checkInValues(checkIn))
                    .append(')');
        } else {
            b.append(" (").append(checkIn.getDate()).append(' ').append(checkIn.getSlotTime()).append("): ")
                    .append(checkInValues(checkIn));
        }
        return b.toString();
    }

    /** One check-in's rendered values — shared by the today and the MA MÉG NINCS branch above. */
    private String checkInValues(CheckInEntity checkIn) {
        StringBuilder b = new StringBuilder("energia ").append(checkIn.getEnergy())
                .append("/10, stressz ").append(checkIn.getStress()).append("/10");
        if (checkIn.getNote() != null && !checkIn.getNote().isBlank()) {
            int max = properties.snapshot().checkinNoteMaxChars();
            String note = checkIn.getNote();
            b.append(", megjegyzés: \"")
                    .append(note.length() <= max ? note : note.substring(0, max) + "…").append('"');
        }
        return b.toString();
    }

    private static String huDay(Integer dayOfWeek) {
        return dayOfWeek != null && dayOfWeek >= 0 && dayOfWeek < 7 ? HU_DAYS.get(dayOfWeek) : "?";
    }
}
