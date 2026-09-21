package io.mrkuhne.mezo.feature.character.service;

import io.mrkuhne.mezo.feature.biometrics.sleep.repository.SleepLogRepository;
import io.mrkuhne.mezo.feature.character.config.CharacterCouncilDebateProperties;
import io.mrkuhne.mezo.feature.companion.tools.ToolContexts;
import io.mrkuhne.mezo.feature.train.repository.WorkoutSessionRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.ai.chat.model.ToolContext;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

/** Deterministic comparison over existing owned reads. Missing sleep is never a zero-hour night. */
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = {FeaturesConfiguration.CHARACTER_SWITCH, FeaturesConfiguration.COMPANION_SWITCH}, havingValue = "true")
public class CharacterCouncilPeriodTools {
    private final SleepLogRepository sleep;
    private final WorkoutSessionRepository workouts;
    private final CharacterCouncilDebateProperties properties;
    private final ObjectMapper json;

    @Tool(name = "compare_council_periods", description = "Két explicit, inkluzív dátumablak alvás- és edzésadatai. "
            + "A ténylegesen naplózott alvásnapok/duration napok száma, átlagos alvás órában, naptári napok, "
            + "lezárt konditermi edzések és edzésnapok száma. Nem méri a nem naplózott alvást, nem tartalmaz "
            + "futást vagy más sportot, nem oksági teszt. Az ablak átfedését is jelöli. Használd, amikor "
            + "két időszakot vagy az alvás és edzéssűrűség adatait pontos számokkal kell összevetni.")
    public String compare(
            @ToolParam(description = "Vizsgált ablak első napja YYYY-MM-DD") String from,
            @ToolParam(description = "Vizsgált ablak utolsó napja YYYY-MM-DD") String to,
            @ToolParam(description = "Összehasonlítás első napja YYYY-MM-DD") String baselineFrom,
            @ToolParam(description = "Összehasonlítás utolsó napja YYYY-MM-DD") String baselineTo,
            ToolContext context) {
        LocalDate start;
        LocalDate end;
        LocalDate baseStart;
        LocalDate baseEnd;
        try {
            start = LocalDate.parse(from);
            end = LocalDate.parse(to);
            baseStart = LocalDate.parse(baselineFrom);
            baseEnd = LocalDate.parse(baselineTo);
        } catch (RuntimeException invalidDate) {
            return json.writeValueAsString(Map.of("error", "Négy érvényes YYYY-MM-DD dátum szükséges."));
        }
        if (!validWindow(start, end) || !validWindow(baseStart, baseEnd)) {
            return json.writeValueAsString(Map.of("error", "Az ablak legyen növekvő és legfeljebb "
                    + properties.maxComparisonDays() + " napos."));
        }
        var owner = ToolContexts.userId(context);
        return json.writeValueAsString(Map.of("current", window(owner, start, end),
                "baseline", window(owner, baseStart, baseEnd),
                "overlapping", !end.isBefore(baseStart) && !baseEnd.isBefore(start),
                "readAt", Instant.now(), "scope", "recorded_sleep_and_completed_gym_only",
                "coverage", "missing sleep is unknown; no logged gym is not proof of no activity"));
    }

    private boolean validWindow(LocalDate from, LocalDate to) {
        return !to.isBefore(from) && ChronoUnit.DAYS.between(from, to) < properties.maxComparisonDays();
    }

    private Map<String, Object> window(UUID owner, LocalDate from, LocalDate to) {
        var nights = sleep.findByCreatedByAndDeletedFalseAndDateBetweenOrderByDateDesc(owner, from, to);
        var durations = nights.stream().filter(row -> row.getDurationH() != null).toList();
        var sessions = workouts.findDoneInstancesBetween(owner, from, to);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("from", from);
        result.put("to", to);
        result.put("calendarDays", ChronoUnit.DAYS.between(from, to) + 1);
        result.put("sleepLoggedDays", nights.stream().map(row -> row.getDate()).distinct().count());
        result.put("sleepDurationDays", durations.stream().map(row -> row.getDate()).distinct().count());
        result.put("meanSleepHours", durations.isEmpty() ? null : durations.stream()
                .map(row -> row.getDurationH()).reduce(BigDecimal.ZERO, BigDecimal::add)
                .divide(BigDecimal.valueOf(durations.size()), 2, RoundingMode.HALF_UP));
        result.put("completedGymSessions", sessions.size());
        result.put("completedGymDays", sessions.stream().map(row -> row.getDate()).distinct().count());
        result.put("sources", Map.of("sleep_log", nights.stream().map(row -> Map.of("id", row.getId(),
                        "date", row.getDate(), "fingerprint", fingerprint(row.getDate() + "|" + row.getDurationH() + "|" + row.getSource()), "source", row.getSource())).toList(),
                "workout_session", sessions.stream().map(row -> Map.of("id", row.getId(), "date", row.getDate(),
                        "fingerprint", fingerprint(row.getDate() + "|" + row.getStatus() + "|" + row.getFinishedAt()))).toList()));
        return result;
    }
    private static String fingerprint(String value) {
        try {
            return java.util.HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(java.nio.charset.StandardCharsets.UTF_8)));
        } catch (java.security.NoSuchAlgorithmException unavailable) {
            throw new IllegalStateException(unavailable);
        }
    }

}
