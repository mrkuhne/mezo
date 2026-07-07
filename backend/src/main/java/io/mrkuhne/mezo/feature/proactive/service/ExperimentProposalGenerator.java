package io.mrkuhne.mezo.feature.proactive.service;

import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.companion.repository.PatternRepository;
import io.mrkuhne.mezo.feature.companion.service.ContextSnapshotAssembler;
import io.mrkuhne.mezo.feature.companion.service.KnowledgeFactService;
import io.mrkuhne.mezo.feature.proactive.config.ProactiveProperties;
import io.mrkuhne.mezo.feature.proactive.entity.ExperimentEntity;
import io.mrkuhne.mezo.feature.proactive.entity.PredictionEntity;
import io.mrkuhne.mezo.feature.proactive.repository.ExperimentRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
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
 * P2 N=1 experiment proposal (spec §5.2): the prediction-generator idiom — PURE-CODE gather
 * (V0.3 snapshot + facts + numbered CONFIRMED-pattern candidates + the fixed metric catalog) →
 * ONE SMART-tier call answering strict-JSON {@code {experiments:[{title, hypothesis, patternIndex,
 * metricKey, expectedDirection, totalDays}]}}. The model SELECTS metric + direction from the
 * offered lists; totalDays is clamped to config. Bounded by the OPEN-experiment cap (proposed +
 * active): a no-op when the cap is met. No CONFIRMED patterns ⇒ no proposals (the grounding gate).
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.PROACTIVE_SWITCH},
        havingValue = "true")
public class ExperimentProposalGenerator {

    /** Prompt prefix the fake dispatches on — MIRRORED as a literal in FakeCompanionLlm. */
    public static final String EXPERIMENT_MARKER = "N1-KISERLET-FELADAT";

    private static final Set<String> VALID_METRICS = Set.of(
            PredictionEntity.METRIC_WEIGHT_TREND,
            PredictionEntity.METRIC_SLEEP_AVG,
            PredictionEntity.METRIC_TRAINING_VOLUME);

    private static final Set<String> VALID_DIRECTIONS = Set.of(
            PredictionEntity.DIRECTION_UP,
            PredictionEntity.DIRECTION_DOWN,
            PredictionEntity.DIRECTION_STABLE);

    private static final String PROMPT = EXPERIMENT_MARKER + "\n"
            + "Javasolj 1-3 N=1 kísérletet Danielnek, KIZÁRÓLAG a megadott megerősített mintákból "
            + "és a jelen kontextusból. Minden kísérlet egy MINTA-JELÖLThöz kötődik (patternIndex), "
            + "egy METRIKA-KATALÓGUS elemhez (metricKey), egy IRÁNY-hoz (expectedDirection: mit "
            + "várunk a metrikától, ha a kísérlet beválik) és egy hossz-hoz (totalDays). Számot vagy "
            + "adatot kitalálni tilos; gyógyszer adagolására vonatkozó változtatást SOHA ne javasolj. "
            + "Válaszolj KIZÁRÓLAG szigorú JSON-nal: {\"experiments\": [{\"title\": \"rövid cím\", "
            + "\"hypothesis\": \"a hipotézis\", \"patternIndex\": a MINTA-JELÖLT sorszáma, "
            + "\"metricKey\": a katalógusból, \"expectedDirection\": \"up|down|stable\", "
            + "\"totalDays\": a kísérlet hossza napokban}]}";

    private final ExperimentRepository experimentRepository;
    private final PatternRepository patternRepository;
    private final ContextSnapshotAssembler contextSnapshotAssembler;
    private final KnowledgeFactService knowledgeFactService;
    private final CompanionLlm companionLlm;
    private final ObjectMapper objectMapper;
    private final ProactiveProperties properties;

    public record Gather(String payload, List<PatternEntity> candidates) {
    }

    record ParsedExperiment(String title, String hypothesis, Integer patternIndex,
                            String metricKey, String expectedDirection, Integer totalDays) {
    }

    record ParsedExperiments(List<ParsedExperiment> experiments) {
    }

    @Transactional
    public List<ExperimentEntity> propose(UUID userId) {
        int open = (int) experimentRepository.countByCreatedByAndStatusIn(userId,
                List.of(ExperimentEntity.STATUS_PROPOSED, ExperimentEntity.STATUS_ACTIVE));
        int room = properties.experiment().maxOpen() - open;
        if (room <= 0) {
            return List.of();   // cap met — no-op (§9 decision y)
        }
        Gather gather = gather(userId);
        if (gather == null) {
            log.debug("No confirmed patterns for {} — no experiment proposals", userId);
            return List.of();
        }
        String answer = companionLlm.completeSmart(PROMPT, gather.payload());
        ParsedExperiments parsed = parse(answer);
        if (parsed == null || parsed.experiments() == null) {
            log.warn("Unusable experiment proposal answer for {} — no rows", userId);
            return List.of();
        }
        List<ExperimentEntity> saved = new ArrayList<>();
        for (ParsedExperiment p : parsed.experiments()) {
            if (saved.size() >= room) {
                break;
            }
            if (p == null || isBlank(p.title()) || isBlank(p.hypothesis())) {
                continue;
            }
            if (!VALID_METRICS.contains(p.metricKey()) || !VALID_DIRECTIONS.contains(p.expectedDirection())) {
                continue;   // unvalidatable = fiction — drop the row
            }
            ExperimentEntity e = new ExperimentEntity();
            e.setCreatedBy(userId);
            e.setTitle(p.title().strip());
            e.setHypothesis(p.hypothesis().strip());
            e.setStatus(ExperimentEntity.STATUS_PROPOSED);
            e.setMetricKey(p.metricKey());
            e.setExpectedDirection(p.expectedDirection());
            e.setTotalDays(clampDays(p.totalDays()));
            e.setGeneratedAt(Instant.now().truncatedTo(ChronoUnit.MICROS));
            saved.add(experimentRepository.saveAndFlush(e));
        }
        return saved;
    }

    /** PURE-CODE payload; null when the user has no CONFIRMED patterns (the grounding gate). */
    public Gather gather(UUID userId) {
        List<PatternEntity> confirmed = patternRepository
                .findByCreatedByAndStatusAndDeletedFalseOrderByLastDetectedAtDesc(
                        userId, PatternEntity.STATUS_CONFIRMED);
        if (confirmed.isEmpty()) {
            return null;
        }
        StringBuilder payload = new StringBuilder(contextSnapshotAssembler.render(userId, LocalDate.now()));
        payload.append(knowledgeFactService.renderPromptBlock(userId));
        payload.append("\n\nMINTA-JELÖLTEK (a patternIndex ezekre mutat):\n");
        for (int i = 0; i < confirmed.size(); i++) {
            PatternEntity p = confirmed.get(i);
            payload.append(i).append(": ").append(p.getTitle())
                    .append(" (r=").append(p.getR())
                    .append(", n=").append(p.getN()).append(")\n");
        }
        payload.append("\nMETRIKA-KATALÓGUS: ")
                .append(PredictionEntity.METRIC_WEIGHT_TREND).append(" | ")
                .append(PredictionEntity.METRIC_SLEEP_AVG).append(" | ")
                .append(PredictionEntity.METRIC_TRAINING_VOLUME);
        payload.append("\nIRÁNYOK: ")
                .append(PredictionEntity.DIRECTION_UP).append(" | ")
                .append(PredictionEntity.DIRECTION_DOWN).append(" | ")
                .append(PredictionEntity.DIRECTION_STABLE);
        return new Gather(payload.toString(), confirmed);
    }

    /** Clamp the model's window to [min-days, max-days]; null/absent ⇒ min-days. */
    private int clampDays(Integer days) {
        int min = properties.experiment().minDays();
        int max = properties.experiment().maxDays();
        if (days == null) {
            return min;
        }
        return Math.max(min, Math.min(max, days));
    }

    private ParsedExperiments parse(String answer) {
        if (answer == null) {
            return null;
        }
        int start = answer.indexOf('{');
        int end = answer.lastIndexOf('}');
        if (start < 0 || end <= start) {
            return null;
        }
        try {
            return objectMapper.readValue(answer.substring(start, end + 1), ParsedExperiments.class);
        } catch (Exception e) {
            log.warn("Experiment proposal answer failed to parse: {}", e.getMessage());
            return null;
        }
    }

    private boolean isBlank(String s) {
        return s == null || s.isBlank();
    }
}
