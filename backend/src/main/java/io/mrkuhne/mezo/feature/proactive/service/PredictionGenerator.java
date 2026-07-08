package io.mrkuhne.mezo.feature.proactive.service;

import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.companion.repository.PatternRepository;
import io.mrkuhne.mezo.feature.companion.service.ContextSnapshotAssembler;
import io.mrkuhne.mezo.feature.companion.service.KnowledgeFactService;
import io.mrkuhne.mezo.feature.proactive.config.ProactiveProperties;
import io.mrkuhne.mezo.feature.proactive.entity.PredictionEntity;
import io.mrkuhne.mezo.feature.proactive.repository.PredictionRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

/**
 * P1 prediction generator (spec §5): PURE-CODE gather (V0.3 snapshot for next-week context +
 * facts + numbered CONFIRMED-pattern candidates + the fixed metric catalog) → ONE SMART-tier
 * call with a strict-JSON contract {@code {predictions:[{title, basis, patternIndex, metricKey,
 * expectedDirection}]}}. The model only SELECTS (pattern by index, metric + direction from the
 * offered lists); validity windows are CODE-set, {@code confidence} is COPIED from the grounding
 * pattern (null = „tanulom" — never invented). No CONFIRMED patterns ⇒ NO rows (the grounding
 * gate); a row with an unvalidatable metric/direction is dropped. Existing week ⇒ empty (idempotent).
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.PROACTIVE_SWITCH},
        havingValue = "true")
public class PredictionGenerator {

    /** Prompt prefix the fake dispatches on — MIRRORED as a literal in FakeCompanionLlm. */
    public static final String PREDICTION_MARKER = "HETI-PREDIKCIO-FELADAT";

    private static final Set<String> VALID_METRICS = Set.of(
            PredictionEntity.METRIC_WEIGHT_TREND,
            PredictionEntity.METRIC_SLEEP_AVG,
            PredictionEntity.METRIC_TRAINING_VOLUME);

    private static final Set<String> VALID_DIRECTIONS = Set.of(
            PredictionEntity.DIRECTION_UP,
            PredictionEntity.DIRECTION_DOWN,
            PredictionEntity.DIRECTION_STABLE);

    private static final String PROMPT = PREDICTION_MARKER + "\n"
            + "Készíts a most kezdődő hétre 1-3 magyar előrejelzést Danielről, KIZÁRÓLAG a megadott "
            + "megerősített mintákból és a jelen kontextusból. Minden előrejelzés egy MINTA-JELÖLThöz "
            + "kötődik (patternIndex), egy METRIKA-KATALÓGUS elemhez (metricKey) és egy IRÁNY-hoz "
            + "(expectedDirection). Számot vagy adatot kitalálni tilos; gyógyszer adagolására "
            + "vonatkozó változtatást SOHA ne javasolj. Válaszolj KIZÁRÓLAG szigorú JSON-nal: "
            + "{\"predictions\": [{\"title\": \"rövid állítás\", \"basis\": \"indoklás\", "
            + "\"patternIndex\": a MINTA-JELÖLT sorszáma, \"metricKey\": a katalógusból, "
            + "\"expectedDirection\": \"up|down|stable\"}]}";

    private final PredictionRepository predictionRepository;
    private final PatternRepository patternRepository;
    private final ContextSnapshotAssembler contextSnapshotAssembler;
    private final KnowledgeFactService knowledgeFactService;
    private final CompanionLlm companionLlm;
    private final ObjectMapper objectMapper;
    private final ProactiveProperties properties;

    public record PredictionGather(String payload, List<PatternEntity> candidates) {
    }

    record ParsedPrediction(String title, String basis, Integer patternIndex,
                            String metricKey, String expectedDirection) {
    }

    record ParsedPredictions(List<ParsedPrediction> predictions) {
    }

    @Transactional
    public List<PredictionEntity> generate(UUID userId, LocalDate weekStart) {
        if (predictionRepository.existsByCreatedByAndWeekStart(userId, weekStart)) {
            return List.of();
        }
        PredictionGather gather = gather(userId, weekStart);
        if (gather == null) {
            log.debug("No confirmed patterns for {} — no predictions for week {}", userId, weekStart);
            return List.of();
        }
        String answer = companionLlm.completeSmart(PROMPT, gather.payload());
        ParsedPredictions parsed = parse(answer);
        if (parsed == null || parsed.predictions() == null) {
            log.warn("Unusable prediction answer for {} week {} — no rows", userId, weekStart);
            return List.of();
        }
        List<PredictionEntity> saved = new ArrayList<>();
        for (ParsedPrediction p : parsed.predictions()) {
            if (saved.size() >= properties.prediction().maxPerWeek()) {
                break;
            }
            if (p == null || isBlank(p.title()) || isBlank(p.basis())) {
                continue;
            }
            if (!VALID_METRICS.contains(p.metricKey()) || !VALID_DIRECTIONS.contains(p.expectedDirection())) {
                continue;   // unvalidatable = fiction — drop the row (§9 decision v)
            }
            PredictionEntity e = new PredictionEntity();
            e.setCreatedBy(userId);
            e.setWeekStart(weekStart);
            e.setTitle(p.title().strip());
            e.setBasis(p.basis().strip());
            e.setConfidence(resolveConfidence(p.patternIndex(), gather.candidates()));
            e.setMetricKey(p.metricKey());
            e.setExpectedDirection(p.expectedDirection());
            e.setValidFrom(weekStart);
            e.setValidTo(weekStart.plusDays(6));
            e.setStatus(PredictionEntity.STATUS_PENDING);
            e.setGeneratedAt(Instant.now().truncatedTo(ChronoUnit.MICROS));
            saved.add(predictionRepository.saveAndFlush(e));
        }
        return saved;
    }

    /** PURE-CODE payload; null when the user has no CONFIRMED patterns (the grounding gate). */
    public PredictionGather gather(UUID userId, LocalDate weekStart) {
        List<PatternEntity> confirmed = patternRepository
                .findByCreatedByAndStatusAndDeletedFalseOrderByLastDetectedAtDesc(
                        userId, PatternEntity.STATUS_CONFIRMED);
        if (confirmed.isEmpty()) {
            return null;
        }
        StringBuilder payload = new StringBuilder(contextSnapshotAssembler.render(userId, weekStart));
        payload.append(knowledgeFactService.renderPromptBlock(userId));
        payload.append("\n\nMINTA-JELÖLTEK (a patternIndex ezekre mutat):\n");
        for (int i = 0; i < confirmed.size(); i++) {
            PatternEntity p = confirmed.get(i);
            payload.append(i).append(": ").append(p.getTitle())
                    .append(" (r=").append(p.getR())
                    .append(", n=").append(p.getN())
                    .append(", konfidencia=").append(p.getConfidence()).append(")\n");
        }
        payload.append("\nMETRIKA-KATALÓGUS: ")
                .append(PredictionEntity.METRIC_WEIGHT_TREND).append(" | ")
                .append(PredictionEntity.METRIC_SLEEP_AVG).append(" | ")
                .append(PredictionEntity.METRIC_TRAINING_VOLUME);
        payload.append("\nIRÁNYOK: ")
                .append(PredictionEntity.DIRECTION_UP).append(" | ")
                .append(PredictionEntity.DIRECTION_DOWN).append(" | ")
                .append(PredictionEntity.DIRECTION_STABLE);
        return new PredictionGather(payload.toString(), confirmed);
    }

    /** COPY the grounding pattern's confidence; out-of-range index ⇒ null (never invented). */
    private BigDecimal resolveConfidence(Integer index, List<PatternEntity> candidates) {
        if (index == null || index < 0 || index >= candidates.size()) {
            return null;
        }
        return candidates.get(index).getConfidence();
    }

    private ParsedPredictions parse(String answer) {
        if (answer == null) {
            return null;
        }
        int start = answer.indexOf('{');
        int end = answer.lastIndexOf('}');
        if (start < 0 || end <= start) {
            return null;
        }
        try {
            return objectMapper.readValue(answer.substring(start, end + 1), ParsedPredictions.class);
        } catch (Exception e) {
            log.warn("Prediction answer failed to parse: {}", e.getMessage());
            return null;
        }
    }

    private boolean isBlank(String s) {
        return s == null || s.isBlank();
    }
}
