package io.mrkuhne.mezo.feature.companion.tools;

import io.mrkuhne.mezo.api.dto.ExerciseRecordResponse;
import io.mrkuhne.mezo.api.dto.MesoDay;
import io.mrkuhne.mezo.api.dto.MesocycleResponse;
import io.mrkuhne.mezo.api.dto.RecordSetRef;
import io.mrkuhne.mezo.api.dto.RunPrescribedSession;
import io.mrkuhne.mezo.api.dto.RunningBlockResponse;
import io.mrkuhne.mezo.api.dto.SportScheduleSlotResponse;
import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import io.mrkuhne.mezo.feature.companion.service.ContextSnapshotAssembler;
import io.mrkuhne.mezo.feature.train.entity.ExerciseEntity;
import io.mrkuhne.mezo.feature.train.entity.ExerciseSetEntity;
import io.mrkuhne.mezo.feature.train.entity.RunSessionLogEntity;
import io.mrkuhne.mezo.feature.train.entity.SportSessionEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.repository.ExerciseRepository;
import io.mrkuhne.mezo.feature.train.repository.ExerciseSetRepository;
import io.mrkuhne.mezo.feature.train.repository.RunSessionLogRepository;
import io.mrkuhne.mezo.feature.train.repository.SportSessionRepository;
import io.mrkuhne.mezo.feature.train.repository.WorkoutSessionRepository;
import io.mrkuhne.mezo.feature.train.service.ExerciseRecordService;
import io.mrkuhne.mezo.feature.train.service.RunningService;
import io.mrkuhne.mezo.feature.train.service.SportService;
import io.mrkuhne.mezo.feature.train.service.SportSlotSkipService;
import io.mrkuhne.mezo.feature.train.service.TrainService;
import io.mrkuhne.mezo.feature.train.service.WorkoutService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import lombok.RequiredArgsConstructor;
import org.springframework.ai.chat.model.ToolContext;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.time.temporal.ChronoUnit;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

/** V0.5 read tools over the train feature (gym instances + sport/run history + forward plan). */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class TrainTools {

    /** get_training_plan's supported scope values; anything else (incl. null) falls back to "today". */
    private static final List<String> PLAN_SCOPES = List.of("today", "tomorrow", "week", "meso", "date");

    /** get_training_log's supported scope values; anything else (incl. null) falls back to "gym". */
    private static final List<String> LOG_SCOPES = List.of("gym", "sport", "run");

    private final WorkoutSessionRepository workoutSessionRepository;
    private final ExerciseSetRepository exerciseSetRepository;
    private final SportSessionRepository sportSessionRepository;
    private final RunSessionLogRepository runSessionLogRepository;
    private final CompanionProperties properties;
    // Forward-plan collaborators (mezo-xixu): WorkoutService.findPlannedTemplateForDate (read-only —
    // NEVER WorkoutService.getToday, which auto-closes stale instances + ensures closing exercises,
    // the ContextSnapshotAssembler.todayLine precedent), TrainService.listMesocycles for scope=meso,
    // RunningService.listBlocks for the active block's prescribed runs.
    private final WorkoutService workoutService;
    private final ExerciseRepository exerciseRepository;
    private final TrainService trainService;
    private final RunningService runningService;
    // mezo-ajp: the recurring weekly sport schedule is the ONLY forward-planned sport in the model
    // (sport_session is a backward log), so a day's sport can only come from here — read-only.
    private final SportService sportService;
    // mezo-d58h.5: the ONE skip predicate (SportSlotSkipService) — sportSlotsOn below MUST filter
    // through it, exactly like ContextSnapshotAssembler#dayLine, or the two read paths drift and
    // the AI contradicts the "skip tonight" card the user just tapped.
    private final SportSlotSkipService sportSlotSkipService;
    // Read-only compute-on-read aggregation over working sets (ExerciseRecordService#list) —
    // NEVER a write-transactional method; there is none on this service.
    private final ExerciseRecordService exerciseRecordService;

    @Tool(name = "get_training_log", description = "Múltbeli edzésnapló megadott ablakra scope szerint: "
            + "scope=gym — gym-edzések (dátum, edzésnap, sorozatszám, összvolumen kg-ban); scope=sport — "
            + "sportalkalmak (röplabda/cross/TRX: időtartam, intenzitás, RPE, szettek); scope=run — futások "
            + "(hét, session, kör, RPE, időtartam). Használd, amikor a user MÚLTBELI edzésekről/sportról/"
            + "futásról kérdez. scope: gym (alapértelmezés), sport, run.")
    public String getTrainingLog(
            @ToolParam(required = false, description = "gym|sport|run (alapértelmezés: gym).") String scope,
            @ToolParam(required = false, description = "Hány napra visszamenőleg (alapértelmezés 7).") Integer days,
            ToolContext toolContext) {
        String s = normalizeLogScope(scope);
        return switch (s) {
            case "sport" -> renderSportLog(toolContext, days);
            case "run" -> renderRunLog(toolContext, days);
            default -> renderGymLog(toolContext, days);
        };
    }

    private static String normalizeLogScope(String scope) {
        if (scope == null) {
            return "gym";
        }
        String s = scope.trim().toLowerCase();
        return LOG_SCOPES.contains(s) ? s : "gym";
    }

    /** scope=gym: done gym instances in the window, with per-instance set count + volume. */
    private String renderGymLog(ToolContext toolContext, Integer days) {
        UUID userId = ToolContexts.userId(toolContext);
        int d = ToolText.clamp(days, 1, properties.tools().maxWindowDays(), 7);
        LocalDate today = LocalDate.now();
        List<WorkoutSessionEntity> instances =
                workoutSessionRepository.findDoneInstancesBetween(userId, today.minusDays(d - 1L), today);
        String header = "Gym-edzések (utolsó " + d + " nap):";
        if (instances.isEmpty()) {
            return header + " " + ToolText.NO_DATA;
        }
        StringBuilder b = new StringBuilder(header);
        for (WorkoutSessionEntity w : instances) {
            List<ExerciseSetEntity> sets = exerciseSetRepository
                    .findByCreatedByAndWorkoutSessionIdOrderByCreatedAtAsc(userId, w.getId())
                    .stream().filter(s -> !s.isSkipped() && s.getReps() != null).toList();
            BigDecimal volume = sets.stream()
                    .filter(s -> s.getWeightKg() != null)
                    .map(s -> s.getWeightKg().multiply(BigDecimal.valueOf(s.getReps())))
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            b.append('\n').append(w.getDate()).append(": ").append(w.getDayLabel());
            if (w.getType() != null) {
                b.append(" (").append(w.getType()).append(')');
            }
            b.append(" — ").append(sets.size()).append(" sorozat, volumen ")
                    .append(ToolText.num(volume)).append(" kg");
            // The closing note in FULL here (mezo-d20.13). The context snapshot carries a clipped
            // copy on every turn; this tool is the just-in-time layer the "hogy ment kedden?"
            // question lands on, so it is the one place the whole sentence belongs. Blank renders
            // nothing — never a placeholder for what the user chose not to write (ADR 0010).
            String note = w.getClosingNote();
            if (note != null && !note.isBlank()) {
                b.append("\n  jegyzet: \"").append(note.strip()).append('"');
            }
        }
        instances.reversed().stream().limit(5).forEach(w ->
                ToolContexts.audit(toolContext).addRef("Workout", w.getDate().toString()));
        return b.toString();
    }

    /** scope=sport: sport sessions (röplabda/cross/TRX) in the window. */
    private String renderSportLog(ToolContext toolContext, Integer days) {
        UUID userId = ToolContexts.userId(toolContext);
        int d = ToolText.clamp(days, 1, properties.tools().maxWindowDays(), 7);
        LocalDate from = LocalDate.now().minusDays(d - 1L);
        List<SportSessionEntity> sport = sportSessionRepository
                .findByCreatedByAndDeletedFalseAndDateGreaterThanEqualOrderByDateDesc(userId, from);
        String header = "Sportalkalmak (utolsó " + d + " nap):";
        if (sport.isEmpty()) {
            return header + " " + ToolText.NO_DATA;
        }
        StringBuilder b = new StringBuilder(header);
        for (SportSessionEntity s : sport) {
            b.append('\n').append(s.getDate()).append(": ").append(s.getSport());
            if (s.getDurationMin() != null) {
                b.append(' ').append(s.getDurationMin()).append(" perc");
            }
            if (s.getIntensity() != null) {
                b.append(", intenzitás ").append(s.getIntensity()).append("/10");
            }
            if (s.getRpe() != null) {
                b.append(", RPE ").append(ToolText.num(s.getRpe()));
            }
            if (s.getSetsPlayed() != null) {
                b.append(", ").append(s.getSetsPlayed()).append(" szett");
            }
        }
        sport.stream().limit(3).forEach(s ->
                ToolContexts.audit(toolContext).addRef("Sport", s.getDate().toString()));
        return b.toString();
    }

    /** scope=run: run-plan log rows in the window. */
    private String renderRunLog(ToolContext toolContext, Integer days) {
        UUID userId = ToolContexts.userId(toolContext);
        int d = ToolText.clamp(days, 1, properties.tools().maxWindowDays(), 7);
        LocalDate from = LocalDate.now().minusDays(d - 1L);
        List<RunSessionLogEntity> runs = runSessionLogRepository
                .findByCreatedByAndDeletedFalseAndDateGreaterThanEqualOrderByDateDesc(userId, from);
        String header = "Futások (utolsó " + d + " nap):";
        if (runs.isEmpty()) {
            return header + " " + ToolText.NO_DATA;
        }
        StringBuilder b = new StringBuilder(header);
        for (RunSessionLogEntity r : runs) {
            b.append('\n').append(r.getDate()).append(": ").append(r.getWeekNumber()).append(". hét ")
                    .append(r.getSessionKey());
            if (r.getCompletedRounds() != null) {
                b.append(" — ").append(r.getCompletedRounds()).append(" kör");
            }
            if (r.getRpeActual() != null) {
                b.append(", RPE ").append(r.getRpeActual());
            }
            if (r.getDurationMin() != null) {
                b.append(", ").append(r.getDurationMin()).append(" perc");
            }
        }
        runs.stream().limit(3).forEach(r ->
                ToolContexts.audit(toolContext).addRef("Run", r.getDate().toString()));
        return b.toString();
    }

    @Tool(name = "get_training_plan", description = "Az ELŐRE ütemezett edzésterv adott ablakra: gym-nap + "
            + "gyakorlatok, sport, futás; scope=meso a teljes aktív ciklus. Használd, amikor a user a "
            + "MAI/HOLNAPI/heti/jövőbeli edzésről vagy a mezociklus tervéről kérdez. scope: today "
            + "(alapértelmezés), tomorrow, week, meso, date.")
    public String getTrainingPlan(
            @ToolParam(required = false, description = "today|tomorrow|week|meso|date (alapértelmezés: today).")
            String scope,
            @ToolParam(required = false, description = "ISO dátum (ÉÉÉÉ-HH-NN) — csak scope=date esetén.")
            String date,
            ToolContext toolContext) {
        UUID userId = ToolContexts.userId(toolContext);
        String s = normalizeScope(scope);
        if ("meso".equals(s)) {
            return renderMeso(userId, toolContext);
        }
        if ("week".equals(s)) {
            return renderWeek(userId, toolContext);
        }
        return renderDay(userId, s, resolveDate(s, date), toolContext);
    }

    private static String normalizeScope(String scope) {
        if (scope == null) {
            return "today";
        }
        String s = scope.trim().toLowerCase();
        return PLAN_SCOPES.contains(s) ? s : "today";
    }

    private static LocalDate resolveDate(String scope, String date) {
        LocalDate today = LocalDate.now();
        return switch (scope) {
            case "tomorrow" -> today.plusDays(1);
            case "date" -> parseDate(date, today);
            default -> today;
        };
    }

    /** An unparsable/missing date param falls back to today rather than failing the whole call. */
    private static LocalDate parseDate(String date, LocalDate fallback) {
        if (date == null || date.isBlank()) {
            return fallback;
        }
        try {
            return LocalDate.parse(date.trim());
        } catch (DateTimeParseException e) {
            return fallback;
        }
    }

    /**
     * today/tomorrow/date renders: the resolved gym day (via {@link WorkoutService#findPlannedTemplateForDate}
     * — read-only, never {@code WorkoutService.getToday}) + the active running block's prescribed session for
     * that weekday. "nincs adat" only when there is NEITHER an active mesocycle NOR an active running block at
     * all — a real rest day within an active plan renders "pihenőnap", never fabricated as "no data".
     */
    private String renderDay(UUID userId, String scope, LocalDate date, ToolContext toolContext) {
        boolean hasActiveMeso = hasActiveMeso(userId);
        List<RunningBlockResponse> activeBlocks = activeRunningBlocks(userId);
        List<SportScheduleSlotResponse> sportSlots = sportService.getSchedule(userId);
        String header = "Edzésterv (" + dayHeaderLabel(scope, date) + "):";
        // mezo-ajp: a scheduled sport slot is a plan in its own right — a volleyball evening with
        // no meso and no running block must never render "nincs adat".
        if (!hasActiveMeso && activeBlocks.isEmpty() && sportSlots.isEmpty()) {
            return header + " " + ToolText.NO_DATA;
        }
        ToolContexts.audit(toolContext).addRef("TrainingPlan", date.toString());
        return header + "\n" + dayContentLine(userId, date, activeBlocks, sportSlots);
    }

    /** The next 7 days (today..+6), one compact line per day — same content as {@link #renderDay}. */
    private String renderWeek(UUID userId, ToolContext toolContext) {
        LocalDate today = LocalDate.now();
        boolean hasActiveMeso = hasActiveMeso(userId);
        List<RunningBlockResponse> activeBlocks = activeRunningBlocks(userId);
        List<SportScheduleSlotResponse> sportSlots = sportService.getSchedule(userId);
        String header = "Edzésterv (" + today + " – " + today.plusDays(6) + "):";
        if (!hasActiveMeso && activeBlocks.isEmpty() && sportSlots.isEmpty()) {
            return header + " " + ToolText.NO_DATA;
        }
        StringBuilder b = new StringBuilder(header);
        for (int i = 0; i < 7; i++) {
            LocalDate d = today.plusDays(i);
            b.append('\n').append(d).append(": ").append(dayContentLine(userId, d, activeBlocks, sportSlots));
        }
        ToolContexts.audit(toolContext).addRef("TrainingPlan", today + ".." + today.plusDays(6));
        return b.toString();
    }

    /**
     * "gym ({day-label}): {exercises}" (or "pihenőnap (gym)"), then an optional "; sport: …" per
     * schedule slot falling on this date's weekday, then an optional "; futás: {label}" tail —
     * the same three parts, in the same order, as {@code ContextSnapshotAssembler}'s Ma:/Holnap:.
     */
    private String dayContentLine(UUID userId, LocalDate date, List<RunningBlockResponse> activeBlocks,
            List<SportScheduleSlotResponse> sportSlots) {
        Optional<WorkoutSessionEntity> template = workoutService.findPlannedTemplateForDate(userId, date);
        List<ExerciseEntity> exercises = template.map(t -> exerciseRepository
                .findByCreatedByAndWorkoutSessionIdInOrderByOrderIndexAsc(userId, List.of(t.getId())))
                .orElse(List.of());
        // mezo-4qu: the gym half is rendered by the SHARED ToolText.gymLine, exactly like the sport
        // half (ToolText.sportLine) — the tool and the chat snapshot can no longer disagree about a
        // day. An absent template yields no exercises, which the helper reads as a rest day.
        StringBuilder line = new StringBuilder(ToolText.gymLine(
                template.map(WorkoutSessionEntity::getDayLabel).orElse(null),
                exercises.stream()
                        .map(e -> ToolText.exerciseLine(e.getName(), e.getWorkingSets(), e.getRepMin(), e.getRepMax()))
                        .toList()));
        sportSlotsOn(userId, sportSlots, date).forEach(s -> line.append("; ").append(ToolText.sportLine(
                s.getSport(), s.getTime(), s.getKind() == null ? null : s.getKind().getValue(),
                s.getDurationMin())));
        activeBlocks.stream().findFirst()
                .flatMap(block -> runSessionLabel(block, date))
                .ifPresent(label -> line.append("; futás: ").append(label));
        return line.toString();
    }

    /**
     * The recurring slots whose weekday matches {@code date} (slot convention: 0=Hét..6=Vas), minus
     * any occurrence the user skipped for that exact date (mezo-d58h.5, SportSlotSkipService — the
     * ONE predicate; see {@link ContextSnapshotAssembler}'s {@code dayLine}, which must apply it the
     * same way or the two read paths disagree about the same day).
     */
    private List<SportScheduleSlotResponse> sportSlotsOn(UUID userId, List<SportScheduleSlotResponse> slots,
            LocalDate date) {
        int dow = date.getDayOfWeek().getValue() - 1;
        return slots.stream()
                .filter(s -> s.getDayOfWeek() != null && s.getDayOfWeek() == dow)
                .filter(s -> !sportSlotSkipService.isSkipped(userId, dow, s.getTime(), date))
                .toList();
    }

    /** scope=meso: the active mesocycle's full structure — weeks/phases/day-templates. */
    private String renderMeso(UUID userId, ToolContext toolContext) {
        MesocycleResponse active = trainService.listMesocycles(userId).stream()
                .filter(m -> m.getStatus() == MesocycleResponse.StatusEnum.ACTIVE)
                .findFirst().orElse(null);
        if (active == null) {
            return "Mezociklus terv: " + ToolText.NO_DATA;
        }
        StringBuilder b = new StringBuilder("Mezociklus terv: ").append(active.getTitle())
                .append(" — ").append(active.getCurrentWeek()).append('/').append(active.getWeeks()).append(". hét");
        if (active.getSplit() != null) {
            b.append(" (").append(active.getSplit()).append(')');
        }
        if (!active.getPhaseCurve().isEmpty()) {
            b.append("; fázisok: ").append(active.getPhaseCurve().stream()
                    .map(MesocycleResponse.PhaseCurveEnum::getValue).collect(Collectors.joining(", ")));
        }
        for (MesoDay day : active.getDays()) {
            b.append('\n').append(day.getDay()).append(": ").append(day.getType());
            if (!day.getExercises().isEmpty()) {
                b.append(" — ").append(day.getExercises().stream()
                        .map(e -> ToolText.exerciseLine(e.getName(), e.getWorkingSets(), e.getRepMin(), e.getRepMax()))
                        .collect(Collectors.joining(", ")));
            }
        }
        ToolContexts.audit(toolContext).addRef("TrainingPlan", active.getTitle());
        return b.toString();
    }

    private boolean hasActiveMeso(UUID userId) {
        return trainService.listMesocycles(userId).stream()
                .anyMatch(m -> m.getStatus() == MesocycleResponse.StatusEnum.ACTIVE);
    }

    private List<RunningBlockResponse> activeRunningBlocks(UUID userId) {
        return runningService.listBlocks(userId).stream()
                .filter(b -> b.getStatus() == RunningBlockResponse.StatusEnum.ACTIVE)
                .toList();
    }

    private static String dayHeaderLabel(String scope, LocalDate date) {
        return switch (scope) {
            case "tomorrow" -> "holnap, " + date;
            case "date" -> date.toString();
            default -> "ma, " + date;
        };
    }

    /**
     * The active running block's prescribed session for {@code date}'s weekday — week derived from
     * the block's startDate (the {@code TrainService.clampWeek}/{@code ContextSnapshotAssembler
     * .tomorrowRunPart} idiom), not the stored currentWeek, so it resolves correctly for ANY date in
     * the block's span (renderWeek walks 7 distinct dates, not just "today").
     */
    private static Optional<String> runSessionLabel(RunningBlockResponse block, LocalDate date) {
        if (block.getStructure() == null || block.getStructure().getWeeks() == null
                || block.getWeeks() == null || block.getWeeks() <= 0 || block.getStartDate() == null) {
            return Optional.empty();
        }
        long week = Math.clamp(ChronoUnit.DAYS.between(block.getStartDate(), date) / 7 + 1, 1, block.getWeeks());
        int dow = date.getDayOfWeek().getValue() - 1;
        return block.getStructure().getWeeks().stream()
                .filter(w -> w.getWeekNumber() != null && w.getWeekNumber() == week)
                .findFirst()
                .flatMap(w -> w.getSessions().stream()
                        .filter(sess -> sess.getDayOfWeek() != null && sess.getDayOfWeek() == dow)
                        .findFirst())
                .map(RunPrescribedSession::getLabel);
    }

    @Tool(name = "get_exercise_records", description = "Egyéni csúcsok (PR) és becsült 1RM (e1RM, Epley) "
            + "gyakorlatonként: legjobb szett, rep-rekordok, utóbbi top-szettek. Használd, amikor a user "
            + "PR-ról, rekordról, 'meg tudom-e dönteni', vagy egy gyakorlat legjobbjairól kérdez.")
    public String getExerciseRecords(
            @ToolParam(required = false, description = "Gyakorlat neve (részleges egyezés is jó) — "
                    + "üresen a legjobb e1RM-ek toplistáját adja.") String exercise,
            ToolContext toolContext) {
        UUID userId = ToolContexts.userId(toolContext);
        List<ExerciseRecordResponse> records = exerciseRecordService.list(userId);
        if (records.isEmpty()) {
            return "Egyéni csúcsok (PR): " + ToolText.NO_DATA;
        }
        if (exercise == null || exercise.isBlank()) {
            return renderTopRecords(records, toolContext);
        }
        String needle = exercise.trim().toLowerCase();
        List<ExerciseRecordResponse> matches = records.stream()
                .filter(r -> r.getName() != null && r.getName().toLowerCase().contains(needle))
                .limit(5)
                .toList();
        if (matches.isEmpty()) {
            return "Egyéni csúcsok (PR) — \"" + exercise + "\": " + ToolText.NO_DATA;
        }
        return renderRecordDetails(matches, toolContext);
    }

    /** No-arg summary: the strongest lifts ranked by estimated 1RM (bodyweight-only exercises have none). */
    private String renderTopRecords(List<ExerciseRecordResponse> records, ToolContext toolContext) {
        List<ExerciseRecordResponse> top = records.stream()
                .filter(r -> r.getBestE1rm() != null)
                .sorted(Comparator.comparing((ExerciseRecordResponse r) -> r.getBestE1rm().getValue()).reversed())
                .limit(5)
                .toList();
        if (top.isEmpty()) {
            return "Egyéni csúcsok (PR): " + ToolText.NO_DATA;
        }
        StringBuilder b = new StringBuilder("Egyéni csúcsok (PR), legjobb becsült 1RM szerint:");
        for (ExerciseRecordResponse r : top) {
            b.append('\n').append(r.getName()).append(": e1RM ")
                    .append(ToolText.num(r.getBestE1rm().getValue())).append(" kg")
                    .append(" (legjobb szett: ").append(renderSetRef(r.getBestSet())).append(')');
            ToolContexts.audit(toolContext).addRef("ExerciseRecord", r.getName());
        }
        return b.toString();
    }

    /** With-name detail: full PR breakdown per matching exercise (bestSet/e1RM, rep records, recent top sets). */
    private String renderRecordDetails(List<ExerciseRecordResponse> matches, ToolContext toolContext) {
        StringBuilder b = new StringBuilder();
        for (int i = 0; i < matches.size(); i++) {
            ExerciseRecordResponse r = matches.get(i);
            if (i > 0) {
                b.append('\n');
            }
            b.append(r.getName()).append(" — PR:");
            if (r.getBestSet() == null && r.getBestE1rm() == null) {
                b.append(' ').append(ToolText.NO_DATA).append(" (testsúlyos gyakorlat, nincs súly-PR)");
            } else {
                if (r.getBestSet() != null) {
                    b.append("\nlegjobb szett: ").append(renderSetRef(r.getBestSet()));
                }
                if (r.getBestE1rm() != null) {
                    b.append("\ne1RM: ").append(ToolText.num(r.getBestE1rm().getValue())).append(" kg (")
                            .append(renderSetRef(r.getBestE1rm().getSet())).append(')');
                }
            }
            if (!r.getRepRecords().isEmpty()) {
                b.append("\nrekordok ismétlésenként: ").append(r.getRepRecords().stream()
                        .map(this::renderSetRef).collect(Collectors.joining(", ")));
            }
            if (!r.getRecentTopSets().isEmpty()) {
                b.append("\nutóbbi top szettek: ").append(r.getRecentTopSets().stream()
                        .map(this::renderSetRef).collect(Collectors.joining(", ")));
            }
            ToolContexts.audit(toolContext).addRef("ExerciseRecord", r.getName());
        }
        return b.toString();
    }

    /** "{weight} kg × {reps} ({date})", falling back to a rep-only line for bodyweight sets — never "null". */
    private String renderSetRef(RecordSetRef ref) {
        if (ref == null) {
            return ToolText.NO_DATA;
        }
        StringBuilder s = new StringBuilder();
        if (ref.getWeightKg() != null) {
            s.append(ToolText.num(ref.getWeightKg())).append(" kg × ").append(ref.getReps());
        } else {
            s.append(ref.getReps()).append(" ismétlés (testsúly)");
        }
        if (ref.getDate() != null) {
            s.append(" (").append(ref.getDate()).append(')');
        }
        return s.toString();
    }
}
