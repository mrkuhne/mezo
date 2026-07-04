package io.mrkuhne.mezo.feature.companion.service;

import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import io.mrkuhne.mezo.feature.companion.entity.DailySummaryEntity;
import io.mrkuhne.mezo.feature.companion.entity.PatternCritiqueEnvelope;
import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.companion.entity.PatternEvidenceEnvelope;
import io.mrkuhne.mezo.feature.companion.repository.DailySummaryRepository;
import io.mrkuhne.mezo.feature.companion.repository.PatternRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.time.LocalDate;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * V3.2 weekly hypothesis loop (spec §8, arch §4.7): gather → propose → critique → score →
 * route (keep / revise-once / discard) → persist. Every stage is pure-compute or pure-LLM,
 * never both (NFR-M-4); both LLM stages run on the SMART tier ({@code llm.smart-model} — its
 * debut). Survivors land as {@code kind=ai_hypothesis} {@code pattern} rows in the V3.1 Inbox:
 * {@code confidence} = the weighted critique score, critique jsonb attached (its
 * {@code reasoning} surfaces as the card's "AI gondolatmenete"), {@code r/n/p} stay null.
 * Identity = {@code "hyp-" + hash(normalized title)}; an existing row with the same key — ANY
 * status — is never re-proposed (a rejected hypothesis stays rejected). Defensive parsing all
 * the way down: broken LLM JSON means zero survivors, never a broken run.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class HypothesisPipelineService {

    /** Prompt markers the fake LLM keys its deterministic answers on. */
    public static final String HYPOTHESIS_MARKER = "HIPOTÉZIS-JAVASLAT";
    public static final String CRITIQUE_MARKER = "HIPOTÉZIS-KRITIKA";
    public static final String REVISE_MARKER = "HIPOTÉZIS-REVÍZIÓ";

    /** Arch §4.7 weights — they DEFINE the score's meaning, deliberately code, not config. */
    static final double W_STATISTICAL = 0.35;
    static final double W_CONFOUNDERS = 0.25;
    static final double W_L3ALIGN = 0.20;
    static final double W_ACTIONABILITY = 0.20;

    private static final String PROPOSE_PROMPT = HYPOTHESIS_MARKER + """
            . Az alábbi heti kontextus (napi összefoglalók + megerősített tények + statisztikai
            minták) alapján javasolj legfeljebb %d MECHANIZMUS-szintű hipotézist Daniel adatairól —
            olyan ok-okozati sejtést, amit a páronkénti statisztika önmagában nem lát. Csak a
            megadott adatokra építs. Válaszolj KIZÁRÓLAG JSON tömbbel, pontosan ebben a formában:
            [{"title":"...","mechanism":"...","category":"physiology|trigger|response"}]
            Ha nincs értelmes hipotézis: []""";

    private static final String CRITIQUE_PROMPT = CRITIQUE_MARKER + """
            . Értékeld szigorúan az alábbi hipotézist a heti kontextus tükrében, négy szempont
            szerint (0..1): statistical (a megadott statisztikai minták mennyire támasztják alá —
            ha nem hivatkozhatsz konkrét r/n értékre, pontozz alacsonyra), confounders (mennyire
            kizárhatók a zavaró tényezők), l3align (mennyire illeszkedik a megerősített tényekhez),
            actionability (mennyire fordítható konkrét lépésre). Válaszolj KIZÁRÓLAG JSON-nal:
            {"statistical":0.0,"confounders":0.0,"l3align":0.0,"actionability":0.0,"reasoning":"..."}""";

    private static final String REVISE_PROMPT = REVISE_MARKER + """
            . A hipotézis a kritika alapján határeset. Fogalmazd át úgy, hogy a kritika kifogásait
            kezelje (szűkebb állítás, jobb illeszkedés a tényekhez). Válaszolj KIZÁRÓLAG JSON-nal:
            {"title":"...","mechanism":"...","category":"physiology|trigger|response"}""";

    private static final Set<String> CATEGORIES = Set.of("physiology", "trigger", "response");

    private final CompanionLlm companionLlm;
    private final DailySummaryRepository dailySummaryRepository;
    private final KnowledgeFactService knowledgeFactService;
    private final PatternRepository patternRepository;
    private final CompanionProperties properties;
    private final ObjectMapper objectMapper;

    /** One hypothesis as the LLM returns it. */
    record Hypothesis(String title, String mechanism, String category) {}

    /** The 4-factor critique as the LLM returns it. */
    record Critique(Double statistical, Double confounders, Double l3align, Double actionability,
                    String reasoning) {}

    /** Runs the whole weekly loop for one user; returns the number of persisted survivors. */
    public int run(UUID userId) {
        String context = gather(userId);
        if (context == null) {
            log.debug("No narrative context for user {} — no hypothesis round", userId);
            return 0;
        }
        int max = properties.hypotheses().maxPerRun();
        // null-safe end to end: JDK Set.of().contains(null) THROWS, and a category-less
        // proposal is valid-looking LLM output — it must skip one hypothesis, never the round
        List<Hypothesis> proposals = propose(userId, context).stream()
                .filter(java.util.Objects::nonNull)
                .filter(h -> h.title() != null && !h.title().isBlank())
                .filter(h -> h.category() != null && CATEGORIES.contains(h.category()))
                .limit(max)
                .toList();
        int persisted = 0;
        for (Hypothesis hypothesis : proposals) {
            try {
                if (judgeAndPersist(userId, context, hypothesis)) {
                    persisted++;
                }
            } catch (Exception e) {
                log.warn("Hypothesis round failed for '{}' of user {}", hypothesis.title(), userId, e);
            }
        }
        return persisted;
    }

    /** Critique → score → keep / revise-once / discard (arch §4.7 thresholds). */
    private boolean judgeAndPersist(UUID userId, String context, Hypothesis hypothesis) {
        CompanionProperties.Hypotheses config = properties.hypotheses();
        Critique critique = critique(context, hypothesis);
        double score = score(critique);
        if (score >= config.keepThreshold()) {
            return persist(userId, hypothesis, critique, score);
        }
        if (score >= config.reviseThreshold()) {
            Hypothesis revised = revise(context, hypothesis, critique);
            if (revised == null || revised.title() == null || revised.title().isBlank()
                    || revised.category() == null || !CATEGORIES.contains(revised.category())) {
                return false;
            }
            Critique reCritique = critique(context, revised);
            double reScore = score(reCritique);
            if (reScore >= config.keepThreshold()) {
                return persist(userId, revised, reCritique, reScore);
            }
        }
        return false;
    }

    /** Pure compute: weekly narrative context — null when there is nothing to hypothesize over. */
    private String gather(UUID userId) {
        List<DailySummaryEntity> summaries = dailySummaryRepository
                .findTop7ByCreatedByOrderBySummaryDateDesc(userId);
        if (summaries.isEmpty()) {
            return null;
        }
        String narratives = summaries.stream()
                .map(s -> s.getSummaryDate() + ": " + s.getNarrative())
                .collect(Collectors.joining("\n"));
        String facts = knowledgeFactService.renderPromptBlock(userId);
        String statistical = patternRepository
                .findByCreatedByAndDeletedFalseOrderByLastDetectedAtDesc(userId).stream()
                .filter(p -> PatternEntity.KIND_STATISTICAL.equals(p.getKind()))
                .map(p -> "- " + p.getTitle() + " (r=" + p.getR() + ", n=" + p.getN()
                        + ", p=" + p.getP() + ", státusz: " + p.getStatus() + ")")
                .collect(Collectors.joining("\n"));
        return "NAPI ÖSSZEFOGLALÓK:\n" + narratives
                + (facts.isBlank() ? "" : "\n\n" + facts)
                + (statistical.isBlank() ? "" : "\n\nSTATISZTIKAI MINTÁK:\n" + statistical);
    }

    private List<Hypothesis> propose(UUID userId, String context) {
        String raw;
        try {
            raw = companionLlm.completeSmart(
                    String.format(Locale.ROOT, PROPOSE_PROMPT, properties.hypotheses().maxPerRun()),
                    context);
        } catch (Exception e) {
            log.warn("Hypothesis proposal LLM call failed for user {}", userId, e);
            return List.of();
        }
        int start = raw.indexOf('[');
        int end = raw.lastIndexOf(']');
        if (start < 0 || end <= start) {
            return List.of();
        }
        try {
            return objectMapper.readValue(raw.substring(start, end + 1), new TypeReference<>() {});
        } catch (Exception e) {
            log.warn("Hypothesis proposal was not parseable JSON — dropping: {}", raw, e);
            return List.of();
        }
    }

    private Critique critique(String context, Hypothesis hypothesis) {
        String payload = "HIPOTÉZIS: " + hypothesis.title() + "\nMECHANIZMUS: " + hypothesis.mechanism()
                + "\n\nKONTEXTUS:\n" + context;
        String raw = companionLlm.completeSmart(CRITIQUE_PROMPT, payload);
        Critique parsed = parseObject(raw, new TypeReference<Critique>() {});
        // a broken critique is a ZERO critique — an unjudgeable hypothesis never survives
        return parsed != null ? parsed : new Critique(0.0, 0.0, 0.0, 0.0, null);
    }

    private Hypothesis revise(String context, Hypothesis hypothesis, Critique critique) {
        String payload = "HIPOTÉZIS: " + hypothesis.title() + "\nMECHANIZMUS: " + hypothesis.mechanism()
                + "\nKRITIKA: " + (critique.reasoning() == null ? "" : critique.reasoning())
                + "\n\nKONTEXTUS:\n" + context;
        String raw = companionLlm.completeSmart(REVISE_PROMPT, payload);
        return parseObject(raw, new TypeReference<Hypothesis>() {});
    }

    private <T> T parseObject(String raw, TypeReference<T> type) {
        int start = raw.indexOf('{');
        int end = raw.lastIndexOf('}');
        if (start < 0 || end <= start) {
            return null;
        }
        try {
            return objectMapper.readValue(raw.substring(start, end + 1), type);
        } catch (Exception e) {
            log.warn("Hypothesis-stage answer was not parseable JSON — dropping: {}", raw, e);
            return null;
        }
    }

    /** Arch §4.7 weighted score; null sub-scores count as zero (no fabricated confidence). */
    static double score(Critique critique) {
        return W_STATISTICAL * zeroIfNull(critique.statistical())
                + W_CONFOUNDERS * zeroIfNull(critique.confounders())
                + W_L3ALIGN * zeroIfNull(critique.l3align())
                + W_ACTIONABILITY * zeroIfNull(critique.actionability());
    }

    private static double zeroIfNull(Double value) {
        return value == null ? 0 : Math.clamp(value, 0.0, 1.0);
    }

    /** Persist unless the identity hash already exists in ANY status (rejected stays rejected). */
    private boolean persist(UUID userId, Hypothesis hypothesis, Critique critique, double score) {
        String title = hypothesis.title().length() > 200
                ? hypothesis.title().substring(0, 200) : hypothesis.title();
        String pairKey = hypothesisKey(title);
        if (patternRepository.findByCreatedByAndKindAndPairKeyAndDeletedFalse(
                userId, PatternEntity.KIND_AI_HYPOTHESIS, pairKey).isPresent()) {
            log.debug("Hypothesis '{}' already known (any status) — skipping", title);
            return false;
        }
        PatternEntity pattern = new PatternEntity();
        pattern.setCreatedBy(userId);
        pattern.setKind(PatternEntity.KIND_AI_HYPOTHESIS);
        pattern.setPairKey(pairKey);
        pattern.setCategory(hypothesis.category());
        pattern.setCategoryLabel(categoryLabel(hypothesis.category()));
        pattern.setTitle(title);
        pattern.setMechanism(hypothesis.mechanism());
        pattern.setEvidence(new PatternEvidenceEnvelope(List.of(
                String.format(Locale.ROOT, "kritika-pontszám %.2f", score),
                "heti hipotézis-kör", LocalDate.now().toString())));
        pattern.setConfidence(BigDecimal.valueOf(score).setScale(3, RoundingMode.HALF_UP));
        pattern.setCritique(new PatternCritiqueEnvelope(critique.statistical(), critique.confounders(),
                critique.l3align(), critique.actionability(), critique.reasoning()));
        pattern.setStatus(PatternEntity.STATUS_PROPOSED);
        pattern.setLastDetectedAt(Instant.now());
        patternRepository.saveAndFlush(pattern);
        return true;
    }

    /** Stable identity: {@code hyp-} + 8-hex SHA-256 of the normalized title. */
    public static String hypothesisKey(String title) {
        String normalized = title.trim().toLowerCase(Locale.ROOT).replaceAll("\\s+", " ");
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(normalized.getBytes(StandardCharsets.UTF_8));
            return "hyp-" + HexFormat.of().formatHex(digest, 0, 4);
        } catch (Exception e) {
            // unreachable — SHA-256 is JDK-guaranteed; error_handling.md forbids raw runtime types
            throw new SystemRuntimeErrorException(SystemMessage.error("INTERNAL_ERROR").build());
        }
    }

    private static String categoryLabel(String category) {
        return switch (category) {
            case "physiology" -> "Fiziológia";
            case "trigger" -> "Trigger";
            default -> "Response";
        };
    }
}
