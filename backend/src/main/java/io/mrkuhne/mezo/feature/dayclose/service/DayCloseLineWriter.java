package io.mrkuhne.mezo.feature.dayclose.service;

import io.mrkuhne.mezo.api.dto.CheckInResponse;
import io.mrkuhne.mezo.api.dto.CheckInSnapshot;
import io.mrkuhne.mezo.api.dto.DayClosePlanGoal;
import io.mrkuhne.mezo.feature.dayclose.config.DayCloseProperties;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContext;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContextHolder;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDate;
import java.util.HexFormat;
import java.util.List;
import java.util.Optional;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Service;

/**
 * Boop's one-sentence lines (B3, mezo-r36n9.13, spec §5.2 / §5.4): after the evening close (the day's rating,
 * the goal and its outcome, the evening energy, Boop's own goals) and after a check-in (its answers, the energy
 * against the earlier check-ins of the day, the watch snapshot when there is one). One cheap-tier call per
 * prompt; the prompt's hash is the cache key the caller stores the line under, so the same inputs never call
 * the model twice.
 *
 * <p>{@link #write} never throws: no model bean, a failed call or a blank answer is an empty result, which
 * the caller turns into the 503 the phone retries on. No {@code @Transactional}: it reads nothing.
 *
 * <p>The system prompts start with {@link #DAY_MARKER} / {@link #CHECKIN_MARKER}; {@code FakeCompanionLlm}
 * mirrors them literally (companion must not import dayclose's internals for that).
 */
@Slf4j
@Service
public class DayCloseLineWriter {

    static final String DAY_MARKER = "BOOP_DAY_LINE_V1";
    static final String CHECKIN_MARKER = "BOOP_CHECKIN_LINE_V1";
    static final String LLM_FEATURE = "boop_day_close";

    private static final String VOICE = """
        Te Boop vagy, a felhasználó személyes edzője és társa egy telefonos alkalmazásban. Magyarul, tegezve \
        beszélsz, melegen és röviden. Pontosan EGY mondatot írsz (legfeljebb 25 szó), idézőjel, emoji, \
        felsorolás és bevezető nélkül. Nem ítélkezel, nem hibáztatsz, nem beszélsz sorozatokról vagy \
        kihagyásról, nem adsz orvosi tanácsot, és nem találsz ki adatot: csak a megadott számokra és \
        szavakra hivatkozol.""";

    static final String DAY_SYSTEM_PROMPT = DAY_MARKER + "\n" + VOICE + """

        Most zárta le a napját. Mondj egy mondatot a napjáról, ami konkrétan hivatkozik legalább egy megadott \
        adatra (az értékelés, a nap célja és hogy sikerült-e, az esti energia, a saját céljaid), és csendesen \
        a pihenés felé fordít.""";

    static final String CHECKIN_SYSTEM_PROMPT = CHECKIN_MARKER + "\n" + VOICE + """

        Most töltött ki egy napközbeni kitöltést. Mondj egy mondatot róla: vesd össze az energiáját a nap \
        korábbi kitöltéseivel, ha vannak, és ha van órás adat (pulzus, HRV a szokotthoz képest, lépés, \
        alvás), arra is utalhatsz.""";

    private static final String[] RATING_WORDS = {"nehéz", "inkább nehéz", "rendben", "jó", "remek"};

    /** The day's inputs to Boop's evening sentence — the journal text is deliberately not one of them (it
     *  arrives later and must not invalidate the line). */
    public record DayInputs(LocalDate date, int dayRating, Integer eveningEnergy, String goalText,
                            String goalOutcome, List<DayClosePlanGoal> planGoals) {}

    /** One prompt and the hash of all of it — the cache key. */
    public record Prompt(String systemPrompt, String userMessage, String hash, String operation) {}

    private final ObjectProvider<DayCloseLlm> llm;
    private final LlmCallContextHolder llmCallContextHolder;
    private final DayCloseProperties properties;

    public DayCloseLineWriter(ObjectProvider<DayCloseLlm> llm, LlmCallContextHolder llmCallContextHolder,
                              DayCloseProperties properties) {
        this.llm = llm;
        this.llmCallContextHolder = llmCallContextHolder;
        this.properties = properties;
    }

    public Prompt dayPrompt(DayInputs in) {
        StringBuilder sb = new StringBuilder();
        sb.append("Nap: ").append(in.date()).append('\n');
        sb.append("A nap értékelése: ").append(in.dayRating()).append("/5 (")
            .append(RATING_WORDS[Math.max(1, Math.min(5, in.dayRating())) - 1]).append(")\n");
        sb.append("Esti energia: ").append(in.eveningEnergy() == null ? "nincs megadva" : in.eveningEnergy() + "/10")
            .append('\n');
        if (in.goalText() != null && !in.goalText().isBlank()) {
            sb.append("A nap célja: ").append(in.goalText().strip()).append(" — ").append(outcomeWords(in.goalOutcome()))
                .append('\n');
        } else {
            sb.append("A nap célja: nem volt megadva\n");
        }
        List<DayClosePlanGoal> goals = in.planGoals() == null ? List.of() : in.planGoals();
        if (!goals.isEmpty()) {
            sb.append("Boop saját céljai:\n");
            for (DayClosePlanGoal g : goals) {
                sb.append("- ").append(g.getTitle()).append(": ").append(g.getResult());
                if (g.getMet() != null) {
                    sb.append(g.getMet() ? " (teljesült)" : " (nem teljesült)");
                }
                sb.append('\n');
            }
        }
        return prompt(DAY_SYSTEM_PROMPT, sb.toString(), "day_line");
    }

    /** {@code earlier} = the day's other done check-ins before {@code current}'s slot, in slot order. */
    public Prompt checkInPrompt(CheckInResponse current, List<CheckInResponse> earlier) {
        StringBuilder sb = new StringBuilder();
        sb.append("Nap: ").append(current.getDate()).append(", kitöltés: ").append(current.getSlotTime()).append('\n');
        sb.append("Most:");
        appendScale(sb, "energia", current.getEnergy());
        appendScale(sb, "hangulat", current.getMood());
        appendScale(sb, "feszültség", current.getStress());
        appendScale(sb, "test", current.getBody());
        appendScale(sb, "fejtisztaság", current.getMental());
        sb.append('\n');
        if (current.getNote() != null && !current.getNote().isBlank()) {
            sb.append("Megjegyzése: ").append(current.getNote().strip()).append('\n');
        }
        if (earlier.isEmpty()) {
            sb.append("Ez a nap első kitöltése.\n");
        } else {
            sb.append("Korábban ma:\n");
            for (CheckInResponse e : earlier) {
                sb.append("- ").append(e.getSlotTime()).append(": energia ")
                    .append(e.getEnergy() == null ? "nincs" : e.getEnergy()).append('\n');
            }
        }
        CheckInSnapshot s = current.getSnapshot();
        if (s != null && (s.getHrBpm() != null || s.getHrvMs() != null || s.getSteps() != null
                || s.getSleepMinutes() != null)) {
            sb.append("Az órád ekkor:");
            if (s.getHrBpm() != null) {
                sb.append(" pulzus ").append(s.getHrBpm()).append(';');
            }
            if (s.getHrvMs() != null) {
                sb.append(" HRV ").append(Math.round(s.getHrvMs()));
                if (s.getHrvUsualMs() != null) {
                    sb.append(" (szokott ").append(Math.round(s.getHrvUsualMs())).append(')');
                }
                sb.append(';');
            }
            if (s.getSteps() != null) {
                sb.append(" lépés ").append(s.getSteps())
                    .append(Boolean.TRUE.equals(s.getStepsIsDayTotal()) ? " (egész napos összeg)" : "").append(';');
            }
            if (s.getSleepMinutes() != null) {
                sb.append(" alvás ").append(s.getSleepMinutes() / 60).append(" óra ")
                    .append(s.getSleepMinutes() % 60).append(" perc;");
            }
            sb.append('\n');
        }
        return prompt(CHECKIN_SYSTEM_PROMPT, sb.toString(), "checkin_line");
    }

    /** Boop's sentence, or empty when the model is not there, failed or answered nothing usable. */
    public Optional<String> write(Prompt prompt) {
        DayCloseLlm model = llm.getIfAvailable();
        if (model == null) {
            return Optional.empty();
        }
        try {
            String raw = llmCallContextHolder.runWith(
                new LlmCallContext(LLM_FEATURE, prompt.operation(), null, null),
                () -> model.complete(prompt.systemPrompt(), prompt.userMessage()));
            return clean(raw);
        } catch (RuntimeException e) {
            log.warn("Boop day-close line LLM call failed ({}): {}", prompt.operation(), e.getMessage());
            return Optional.empty();
        }
    }

    /** The first non-blank line, without wrapping quotes, cut to {@code mezo.dayclose.line-max-chars}. */
    Optional<String> clean(String raw) {
        if (raw == null) {
            return Optional.empty();
        }
        String line = raw.strip().lines().map(String::strip).filter(l -> !l.isEmpty()).findFirst().orElse("");
        line = line.replaceAll("^[\"„“”'»«]+|[\"„“”'»«]+$", "").strip();
        if (line.isEmpty()) {
            return Optional.empty();
        }
        return Optional.of(line.length() > properties.lineMaxChars()
            ? line.substring(0, properties.lineMaxChars()).strip() : line);
    }

    private static Prompt prompt(String system, String user, String operation) {
        return new Prompt(system, user, sha256(system + "\n\n" + user), operation);
    }

    private static void appendScale(StringBuilder sb, String label, Integer value) {
        if (value != null) {
            sb.append(' ').append(label).append(' ').append(value).append("/10;");
        }
    }

    private static String outcomeWords(String outcome) {
        if (outcome == null) {
            return "nem értékelte";
        }
        return switch (outcome) {
            case "done" -> "sikerült";
            case "partial" -> "részben sikerült";
            case "no" -> "nem sikerült";
            default -> "nem értékelte";
        };
    }

    private static String sha256(String s) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(s.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            // SHA-256 is mandatory on every JVM (java.security.MessageDigest spec).
            throw new AssertionError(e);
        }
    }
}
