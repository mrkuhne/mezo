package io.mrkuhne.mezo.feature.proactive.service;

import io.mrkuhne.mezo.feature.auth.service.PromptPersona;
import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.companion.service.MetricKey;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContext;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContextHolder;
import io.mrkuhne.mezo.feature.proactive.config.DiagnosisProperties;
import io.mrkuhne.mezo.feature.proactive.entity.DiagnosisEntity;
import io.mrkuhne.mezo.feature.proactive.entity.DiagnosisEvidenceEnvelope;
import io.mrkuhne.mezo.feature.proactive.entity.DiagnosisSuspectsEnvelope;
import io.mrkuhne.mezo.feature.proactive.entity.DiagnosisSuspectsEnvelope.Suspect;
import io.mrkuhne.mezo.feature.proactive.entity.DiagnosisEvidenceEnvelope.EvidenceItem;
import io.mrkuhne.mezo.feature.proactive.repository.DiagnosisRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

/**
 * Fatigue diagnosis generator (mezo-hqfi.2, spec §3.3) — the {@code WeeklyReviewGenerator} recipe
 * on a rolling window: PURE-CODE gather ({@link FatigueEvidenceCollector}) → ONE SMART-tier call
 * with a strict-JSON contract → every field bounds-checked on the way in.
 *
 * <p>A suspect is DROPPED (not repaired, not asked for again) when its evidence indexes are
 * empty or ANY of them is out of range, its {@code metricKey} is not a known {@link MetricKey},
 * its direction is outside the {@code ExperimentEntity} vocabulary, or its probe length is
 * outside 3..28 days. No surviving suspect ⇒ NO row — the "unusable answer ⇒ no row" rule.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.PROACTIVE_SWITCH},
        havingValue = "true")
public class DiagnosisGenerator {

    /** Prompt prefix the fake dispatches on — MIRRORED as a literal in FakeCompanionLlm. */
    public static final String DIAGNOSIS_MARKER = "FARADTSAG-DIAGNOZIS-FELADAT";

    private static final int MIN_SUSPECTS = 1;
    private static final int MAX_SUSPECTS = 4;
    private static final int MIN_PROBE_DAYS = 3;
    private static final int MAX_PROBE_DAYS = 28;
    private static final int MAX_TEXT_LEN = 400;
    private static final Set<String> DIRECTIONS = Set.of("up", "down", "stable");
    private static final Set<String> STRENGTHS = Set.of("strong", "moderate", "weak");

    /** mezo-eq85.9: this generator's own LLM-call feature/operation. Package-visible (not
     *  {@code private}) so {@link FatigueEvidenceCollector} — the PURE-CODE gather this generator
     *  delegates to — can share the SAME label for its memory-retrieval audit row rather than
     *  hard-coding a second copy; the Task-8 single-constant guard, applied across the two classes
     *  the {@code DiagnosisGenerator}/{@code FatigueEvidenceCollector} split already has. {@code
     *  proactive_diagnosis} sits on {@code mezo.llm-log.budget.throttled-features}. */
    static final LlmCallContext CONTEXT = new LlmCallContext("proactive_diagnosis", "generate", null, null);

    /** The shared instruction block — the recipe supplies the question sentence up front. */
    private static final String PROMPT_RULES =
            "Válaszolj KIZÁRÓLAG a megadott evidencia-jelöltekből. "
            + "Számot kitalálni tilos; olyan összefüggésre hivatkozni, ami nincs a jelöltek között, tilos; "
            + "gyógyszer-adagolást érintő javaslat tilos. Minden gyanúsítotthoz NEVEZD MEG a mechanizmust "
            + "(miért okozna fáradtságot), ne csak az együttjárást állapítsd meg. Minden gyanúsítotthoz "
            + "kötelező legalább egy evidenceIndex. Legfeljebb 4 gyanúsított, a legerősebb elöl. "
            + "A probe.metricKey CSAK a jelöltek között szereplő metricKey lehet, az expectedDirection "
            + "csak up|down|stable, a totalDays 3 és 28 között. Válaszolj KIZÁRÓLAG szigorú JSON-nal: "
            + "{\"verdict\": \"1-2 mondat\", \"confidence\": \"strong|moderate|weak\", \"suspects\": "
            + "[{\"title\": \"...\", \"claim\": \"...\", \"evidenceIndexes\": [sorszámok], "
            + "\"strength\": \"strong|moderate|weak\", \"probe\": {\"text\": \"...\", "
            + "\"metricKey\": \"...\", \"expectedDirection\": \"up|down|stable\", \"totalDays\": 7}}]}";

    /** WEIGHT-only prompt block (mezo-85x5r §2): the SZÁMVETÉS rows are code-computed facts the
     *  model must not contradict; the suspects stay confined to the VÍZ side. Appended after the
     *  recipe's question sentence, verbatim (Task 4 brief). */
    private static final String WEIGHT_PROMPT_BLOCK =
            "A SZÁMVETÉS sorai kód által számolt tények — nem mondhatsz nekik ellent, és a plafon fölé "
            + "nem tulajdoníthatsz szövetet. A gyanúsítottak a VÍZ-részre vonatkoznak: CH-ugrás (1 g CH "
            + "3–4 g vizet köt glikogénként), só-ugrás, terhelés-ugrás (izomjavítási vízvisszatartás), "
            + "alváshiány/stressz (kortizol), késői nagy étkezés a mérés előtt, gyógyszer-ciklus "
            + "étvágy-hatás, kreatin/supplement-váltás. 2–3 hét konzisztens trend előtt tartós "
            + "irányváltást kimondani tilos.";

    private final DiagnosisRepository diagnosisRepository;
    private final FatigueEvidenceCollector collector;
    private final CompanionLlm companionLlm;
    private final LlmCallContextHolder llmCallContextHolder;
    private final DiagnosisProperties properties;
    private final ObjectMapper objectMapper;
    private final PromptPersona promptPersona;
    private final WeightDecompositionInputsAssembler weightDecompositionInputsAssembler;

    record ParsedProbe(String text, String metricKey, String expectedDirection, Integer totalDays) {
    }

    record ParsedSuspect(String title, String claim, List<Integer> evidenceIndexes,
            String strength, ParsedProbe probe) {
    }

    record ParsedDiagnosis(String verdict, String confidence, List<ParsedSuspect> suspects) {
    }

    /** The pre-recipe entry point — fatigue, kept so existing callers read unchanged. */
    @Transactional
    public DiagnosisEntity generate(UUID userId, LocalDate today) {
        return generate(userId, today, DiagnosisEntity.PHENOMENON_FATIGUE);
    }

    @Transactional
    public DiagnosisEntity generate(UUID userId, LocalDate today, String phenomenon) {
        return generate(userId, today, phenomenon, null);
    }

    /**
     * @param anchorStart the WEEK-ANCHORED {@code weight} phenomenon's ISO Monday — the window
     *                    becomes {@code [anchorStart, min(anchorStart+6, today)]} instead of the
     *                    rolling {@code properties.windowDays()} window. {@code null} for the
     *                    rolling phenomena (fatigue/sleep) — unchanged behavior.
     */
    @Transactional
    public DiagnosisEntity generate(UUID userId, LocalDate today, String phenomenon, LocalDate anchorStart) {
        DiagnosisRecipe recipe = DiagnosisRecipe.byPhenomenon(phenomenon);
        if (recipe == null) {
            log.warn("Unknown diagnosis phenomenon '{}' for {} — no row", phenomenon, userId);
            return null;
        }
        FatigueEvidenceCollector.FatigueGather gather;
        LocalDate windowFrom = null;
        LocalDate windowTo = null;
        if (anchorStart != null) {
            windowFrom = anchorStart;
            windowTo = AnchoredWeek.windowTo(anchorStart, today);
            List<EvidenceItem> prepended = DiagnosisRecipe.WEIGHT.equals(recipe)
                    ? WeightDecomposition.compute(weightDecompositionInputsAssembler
                            .assemble(userId, windowFrom, windowTo)).derivedItems()
                    : List.of();
            gather = collector.gather(userId, windowFrom, windowTo, recipe, prepended);
        } else {
            gather = collector.gather(userId, today, recipe);
        }
        if (gather == null) {
            log.debug("Not enough data for a fatigue diagnosis for {}", userId);
            return null;
        }
        String answer = llmCallContextHolder.runWith(CONTEXT,
                () -> companionLlm.completeSmart(promptPersona.render(userId, prompt(recipe)), gather.payload()));
        ParsedDiagnosis parsed = parse(answer);
        if (parsed == null || parsed.verdict() == null || parsed.verdict().isBlank()
                || !STRENGTHS.contains(parsed.confidence())) {
            log.warn("Unusable diagnosis answer for {} — no row", userId);
            return null;
        }
        List<Suspect> suspects = resolveSuspects(parsed.suspects(), gather.candidates().size());
        if (suspects.size() < MIN_SUSPECTS) {
            log.warn("No suspect survived validation for {} — no row", userId);
            return null;
        }
        DiagnosisEntity diagnosis = new DiagnosisEntity();
        diagnosis.setCreatedBy(userId);
        diagnosis.setPhenomenon(recipe.phenomenon());
        diagnosis.setWindowDays(anchorStart != null
                ? (int) (ChronoUnit.DAYS.between(windowFrom, windowTo) + 1)
                : properties.windowDays());
        diagnosis.setAnchorStart(anchorStart);
        diagnosis.setVerdict(truncate(parsed.verdict().strip()));
        diagnosis.setConfidence(parsed.confidence());
        diagnosis.setEvidence(new DiagnosisEvidenceEnvelope(gather.candidates()));
        diagnosis.setSuspects(new DiagnosisSuspectsEnvelope(suspects));
        diagnosis.setGeneratedAt(Instant.now().truncatedTo(ChronoUnit.MICROS));
        return diagnosisRepository.saveAndFlush(diagnosis);
    }

    private static String prompt(DiagnosisRecipe recipe) {
        String weightBlock = DiagnosisRecipe.WEIGHT.equals(recipe) ? " " + WEIGHT_PROMPT_BLOCK : "";
        return DIAGNOSIS_MARKER + "\n" + recipe.questionHu() + weightBlock + " " + PROMPT_RULES;
    }

    private ParsedDiagnosis parse(String answer) {
        if (answer == null) {
            return null;
        }
        int start = answer.indexOf('{');
        int end = answer.lastIndexOf('}');
        if (start < 0 || end <= start) {
            return null;
        }
        try {
            return objectMapper.readValue(answer.substring(start, end + 1), ParsedDiagnosis.class);
        } catch (Exception e) {
            log.warn("Diagnosis answer failed to parse: {}", e.getMessage());
            return null;
        }
    }

    /** Drop-on-violation: a malformed suspect never lands, and is never repaired. */
    private List<Suspect> resolveSuspects(List<ParsedSuspect> parsed, int candidateCount) {
        if (parsed == null) {
            return List.of();
        }
        List<Suspect> resolved = new ArrayList<>();
        for (ParsedSuspect suspect : parsed) {
            if (resolved.size() >= MAX_SUSPECTS) {
                break;
            }
            if (suspect == null || isBlank(suspect.title()) || isBlank(suspect.claim())
                    || !STRENGTHS.contains(suspect.strength()) || suspect.probe() == null) {
                continue;
            }
            List<Integer> offered = suspect.evidenceIndexes() == null ? List.of()
                    : suspect.evidenceIndexes().stream().filter(Objects::nonNull).distinct().toList();
            List<Integer> indexes = offered.stream()
                    .filter(i -> i >= 0 && i < candidateCount).toList();
            // An out-of-range index is a fabrication signal — reject the WHOLE suspect rather
            // than silently keeping the indexes that happened to survive.
            if (indexes.isEmpty() || indexes.size() != offered.size()) {
                continue;
            }
            ParsedProbe probe = suspect.probe();
            if (isBlank(probe.text()) || !isKnownMetric(probe.metricKey())
                    || !DIRECTIONS.contains(probe.expectedDirection())
                    || probe.totalDays() == null
                    || probe.totalDays() < MIN_PROBE_DAYS || probe.totalDays() > MAX_PROBE_DAYS) {
                continue;
            }
            resolved.add(new Suspect(resolved.size() + 1, truncate(suspect.title().strip()),
                    truncate(suspect.claim().strip()), indexes, suspect.strength(),
                    truncate(probe.text().strip()), probe.metricKey(),
                    probe.expectedDirection(), probe.totalDays()));
        }
        return resolved;
    }

    private static boolean isKnownMetric(String metricKey) {
        if (metricKey == null) {
            return false;
        }
        for (MetricKey known : MetricKey.values()) {
            if (known.name().equals(metricKey)) {
                return true;
            }
        }
        return false;
    }

    private static boolean isBlank(String text) {
        return text == null || text.isBlank();
    }

    private static String truncate(String text) {
        return text.length() <= MAX_TEXT_LEN ? text : text.substring(0, MAX_TEXT_LEN);
    }
}
