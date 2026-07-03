package io.mrkuhne.mezo.feature.companion.tools;

import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import io.mrkuhne.mezo.feature.train.entity.ExerciseSetEntity;
import io.mrkuhne.mezo.feature.train.entity.RunSessionLogEntity;
import io.mrkuhne.mezo.feature.train.entity.SportSessionEntity;
import io.mrkuhne.mezo.feature.train.entity.WorkoutSessionEntity;
import io.mrkuhne.mezo.feature.train.repository.ExerciseSetRepository;
import io.mrkuhne.mezo.feature.train.repository.RunSessionLogRepository;
import io.mrkuhne.mezo.feature.train.repository.SportSessionRepository;
import io.mrkuhne.mezo.feature.train.repository.WorkoutSessionRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import lombok.RequiredArgsConstructor;
import org.springframework.ai.chat.model.ToolContext;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/** V0.5 read tools over the train feature (gym instances + sport/run history). */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class TrainTools {

    private final WorkoutSessionRepository workoutSessionRepository;
    private final ExerciseSetRepository exerciseSetRepository;
    private final SportSessionRepository sportSessionRepository;
    private final RunSessionLogRepository runSessionLogRepository;
    private final CompanionProperties properties;

    @Tool(name = "get_recent_workouts", description = "Gym-edzések az elmúlt napokra: dátum, edzésnap "
            + "(pl. Pull A), sorozatszám, összvolumen kg-ban. Kérdés edzésekről, edzésmennyiségről, volumenről.")
    public String getRecentWorkouts(
            @ToolParam(required = false, description = "Hány napra visszamenőleg (alapértelmezés 7).") Integer days,
            ToolContext toolContext) {
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
        }
        instances.reversed().stream().limit(5).forEach(w ->
                ToolContexts.audit(toolContext).addRef("Workout", w.getDate().toString()));
        return b.toString();
    }

    @Tool(name = "get_sport_sessions", description = "Sportalkalmak (röplabda/cross/TRX) és futások az "
            + "elmúlt napokra: dátum, időtartam, intenzitás, RPE, körök. Kérdés sportról, futásról, terhelésről.")
    public String getSportSessions(
            @ToolParam(required = false, description = "Hány napra visszamenőleg (alapértelmezés 7).") Integer days,
            ToolContext toolContext) {
        UUID userId = ToolContexts.userId(toolContext);
        int d = ToolText.clamp(days, 1, properties.tools().maxWindowDays(), 7);
        LocalDate from = LocalDate.now().minusDays(d - 1L);
        List<SportSessionEntity> sport = sportSessionRepository
                .findByCreatedByAndDeletedFalseAndDateGreaterThanEqualOrderByDateDesc(userId, from);
        List<RunSessionLogEntity> runs = runSessionLogRepository
                .findByCreatedByAndDeletedFalseAndDateGreaterThanEqualOrderByDateDesc(userId, from);
        String header = "Sportalkalmak (utolsó " + d + " nap):";
        if (sport.isEmpty() && runs.isEmpty()) {
            return header + " " + ToolText.NO_DATA;
        }
        StringBuilder b = new StringBuilder(header);
        if (sport.isEmpty()) {
            b.append(' ').append(ToolText.NO_DATA);
        }
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
        if (!runs.isEmpty()) {
            b.append("\nFutások:");
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
        }
        sport.stream().limit(3).forEach(s ->
                ToolContexts.audit(toolContext).addRef("Sport", s.getDate().toString()));
        runs.stream().limit(3).forEach(r ->
                ToolContexts.audit(toolContext).addRef("Run", r.getDate().toString()));
        return b.toString();
    }
}
