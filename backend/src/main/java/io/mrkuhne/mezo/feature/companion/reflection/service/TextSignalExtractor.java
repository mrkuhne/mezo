package io.mrkuhne.mezo.feature.companion.reflection.service;

import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContext;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContextHolder;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import tools.jackson.databind.ObjectMapper;

/**
 * Reflexió S1 (bd mezo-eq85.1, spec 2026-09-06 §4.1): the ONE LLM stage of the text-signal path.
 * Gemini phrases, code decides — the model may return nothing but extracted-signal JSON, and every
 * value it returns is re-validated here before anything is persisted:
 *
 * <ul>
 *   <li>{@code confidence != "sure"} ⇒ mood/energy/stress are dropped to null. A neutral two-line
 *       entry must never become a 3/3/3 data point that a correlation later treats as real.
 *   <li>numbers are clamped to 1..5 (the DB CHECK's range) instead of failing the insert;
 *   <li>topics are intersected with the CLOSED {@link #TOPICS} vocabulary — an invented topic is
 *       dropped, never stored, so the derived {@code topic:*} series stay a finite, nameable set;
 *   <li>people/keywords are trimmed, de-duplicated and capped.
 * </ul>
 *
 * <p>Defensive all the way down: a broken/absent/non-JSON answer, or a failing provider call,
 * yields {@link Optional#empty()} — no signal row, never an exception escaping the stage.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.REFLECTION_SWITCH},
        havingValue = "true")
public class TextSignalExtractor {

    /** Prompt marker the fake LLM keys its deterministic answer on. */
    public static final String SIGNAL_MARKER = "SZÖVEG-JEL-KINYERÉS";

    /** The CLOSED topic vocabulary — anything else the model returns is dropped. */
    public static final Set<String> TOPICS = Set.of("munka", "család", "kapcsolatok", "sport",
            "egészség", "pihenés", "alvás", "evés", "pénz", "alkotás", "tanulás", "otthon");

    private static final String PROMPT = SIGNAL_MARKER + """
            . Az alábbi rövid magyar bejegyzésből nyerj ki jeleket. Válaszolj KIZÁRÓLAG JSON-nal:
            {"mood":1-5|null,"energy":1-5|null,"stress":1-5|null,"confidence":"sure"|"unsure",
             "people":["név ahogy a szövegben szerepel"],"topics":["""
            + String.join("|", TOPICS.stream().sorted().toList()) + """
            "],"keywords":["max 3 szabad kulcsszó"]}
            Semleges, kétsoros, érzelemmentes bejegyzésnél confidence="unsure" és a számok null.
            Ne találj ki embert, aki nincs a szövegben.""";

    private final CompanionLlm companionLlm;
    private final ObjectMapper objectMapper;
    private final LlmCallContextHolder llmCallContextHolder;

    /** One validated signal — the ONLY shape the rest of the epic sees an LLM answer in. */
    public record ExtractedSignal(Integer mood, Integer energy, Integer stress, String confidence,
                                  List<String> people, List<String> topics, List<String> keywords) {}

    public Optional<ExtractedSignal> extract(UUID userId, String sourceKind, UUID sourceId, String text) {
        if (text == null || text.isBlank()) {
            return Optional.empty();
        }
        String raw;
        try {
            raw = llmCallContextHolder.runWith(
                    new LlmCallContext("companion_reflection", "signal_" + sourceKind, sourceKind, sourceId),
                    () -> companionLlm.complete(PROMPT, text));
        } catch (RuntimeException e) {
            log.warn("Signal extraction call failed for {} {}", sourceKind, sourceId, e);
            return Optional.empty();
        }
        Raw parsed = parse(raw);
        if (parsed == null) {
            return Optional.empty();
        }
        boolean sure = "sure".equals(parsed.confidence());
        return Optional.of(new ExtractedSignal(
                sure ? clamp(parsed.mood()) : null,
                sure ? clamp(parsed.energy()) : null,
                sure ? clamp(parsed.stress()) : null,
                sure ? "sure" : "unsure",
                clean(parsed.people(), 5, false),
                clean(parsed.topics(), 3, true),
                clean(parsed.keywords(), 3, false)));
    }

    /** The answer exactly as the model wrote it — nothing downstream ever sees this shape. */
    private record Raw(Integer mood, Integer energy, Integer stress, String confidence,
                       List<String> people, List<String> topics, List<String> keywords) {}

    private Raw parse(String raw) {
        if (raw == null) {
            return null;
        }
        int start = raw.indexOf('{');
        int end = raw.lastIndexOf('}');
        if (start < 0 || end <= start) {
            return null;
        }
        try {
            return objectMapper.readValue(raw.substring(start, end + 1), Raw.class);
        } catch (Exception e) {
            log.warn("Signal answer was not parseable JSON — dropping: {}", raw, e);
            return null;
        }
    }

    private static Integer clamp(Integer value) {
        return value == null ? null : Math.clamp(value, 1, 5);
    }

    private static List<String> clean(List<String> in, int max, boolean topicVocabulary) {
        if (in == null) {
            return List.of();
        }
        return in.stream()
                .filter(Objects::nonNull)
                .map(String::trim)
                .filter(s -> !s.isBlank())
                .filter(s -> !topicVocabulary || TOPICS.contains(s.toLowerCase(Locale.ROOT)))
                .map(s -> topicVocabulary ? s.toLowerCase(Locale.ROOT) : s)
                .distinct()
                .limit(max)
                .toList();
    }
}
