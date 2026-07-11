package io.mrkuhne.mezo.feature.activity.service;

import io.mrkuhne.mezo.feature.activity.config.ActivityProperties;
import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.progression.ProgressionTaxonomy;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.math.BigDecimal;
import java.util.Optional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

/**
 * One-shot LIFE-skill classification of a free-text activity (E2, spec §5) on the companion
 * CHEAP tier (FactExtractionService pattern: marker-prefixed prompt, strict-JSON answer,
 * defensive parse — a broken answer degrades to "uncategorized", never an error). The XP
 * suggestion is only a proposal; ActivityService clamps and caps it deterministically.
 */
@Slf4j
@Component
@RequiredArgsConstructor
@ConditionalOnProperty(name = {FeaturesConfiguration.ACTIVITY_SWITCH, FeaturesConfiguration.COMPANION_SWITCH},
    havingValue = "true")
public class ActivityClassifier {

    /** First word of the system prompt — FakeCompanionLlm mirrors it (literal, no import back). */
    public static final String CLASSIFY_MARKER = "TEVEKENYSEG-BESOROLAS-FELADAT";

    private static final String CLASSIFY_PROMPT = CLASSIFY_MARKER + """
        : Az alábbi magyar szabadszöveges tevékenység-bejegyzést sorold be PONTOSAN EGY life-skill
        kulcs alá: mindfulness (meditáció, légzés, naplózás), mindset (hála, vizualizáció, célírás),
        cooking (főzés, meal-prep), financial (költségvetés, megtakarítás, no-spend), productivity
        (deep work, tervezés, halogatott feladat), learning (olvasás, kurzus, nyelvtanulás),
        connection (hívás, minőségi idő, segítségnyújtás), recovery (mobilitás, szauna, pihenés).
        Válaszolj KIZÁRÓLAG egyetlen JSON objektummal:
        {"skillKey": "<kulcs>", "confidence": <0..1>, "xpSuggestion": <5..25 egész>,
         "durationMin": <egész vagy null>, "amountHuf": <egész vagy null>}
        Az xpSuggestion az erőfeszítéssel arányos. Ha nem egyértelmű, a confidence legyen alacsony.""";

    private final CompanionLlm companionLlm;
    private final ObjectMapper objectMapper;
    private final ActivityProperties properties;

    /** One classification as proposed by the model (record mirrors the strict-JSON answer). */
    public record Classification(String skillKey, BigDecimal confidence, Integer xpSuggestion,
                                 Integer durationMin, Long amountHuf) {}

    /** Empty = LLM failed or answered garbage → the caller stores the entry uncategorized. */
    public Optional<Classification> classify(String text) {
        String raw;
        try {
            raw = companionLlm.complete(CLASSIFY_PROMPT, text);
        } catch (Exception e) {
            log.warn("Activity classification failed, storing uncategorized: {}", e.getMessage());
            return Optional.empty();
        }
        return parse(raw);
    }

    private Optional<Classification> parse(String raw) {
        int start = raw.indexOf('{');
        int end = raw.lastIndexOf('}');
        if (start < 0 || end <= start) {
            return Optional.empty();
        }
        try {
            Classification c = objectMapper.readValue(raw.substring(start, end + 1), Classification.class);
            if (c.skillKey() != null && !ProgressionTaxonomy.LIFE.contains(c.skillKey())) {
                // hallucinated key → keep the extraction, drop the category (uncategorized flow)
                return Optional.of(new Classification(null, BigDecimal.ZERO, c.xpSuggestion(),
                    c.durationMin(), c.amountHuf()));
            }
            return Optional.of(c);
        } catch (Exception e) {
            log.warn("Activity classification answer unparseable: {}", e.getMessage());
            return Optional.empty();
        }
    }
}
