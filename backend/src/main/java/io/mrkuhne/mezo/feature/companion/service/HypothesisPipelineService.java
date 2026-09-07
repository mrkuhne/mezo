package io.mrkuhne.mezo.feature.companion.service;

import io.mrkuhne.mezo.api.dto.PatternMonitorResponse;
import io.mrkuhne.mezo.feature.appnotification.domain.AppNotificationKind;
import io.mrkuhne.mezo.feature.appnotification.service.AppNotificationEmitter;
import io.mrkuhne.mezo.feature.auth.service.PromptPersona;
import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import io.mrkuhne.mezo.feature.companion.entity.DailySummaryEntity;
import io.mrkuhne.mezo.feature.companion.entity.PatternCritiqueEnvelope;
import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.companion.entity.PatternEvidenceEnvelope;
import io.mrkuhne.mezo.feature.companion.entity.TestPlanEnvelope;
import io.mrkuhne.mezo.feature.companion.repository.DailySummaryRepository;
import io.mrkuhne.mezo.feature.companion.reflection.config.ReflectionProperties;
import io.mrkuhne.mezo.feature.companion.reflection.entity.TextSignalEntity;
import io.mrkuhne.mezo.feature.companion.reflection.repository.TextSignalRepository;
import io.mrkuhne.mezo.feature.companion.reflection.service.ReflectionMemoryGateway;
import io.mrkuhne.mezo.feature.companion.reflection.service.TestPlanValidator;
import io.mrkuhne.mezo.feature.companion.reflection.service.TestPlanValidator.RawTestPlan;
import io.mrkuhne.mezo.feature.companion.repository.PatternRepository;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContext;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContextHolder;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.time.LocalDate;
import java.util.HexFormat;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Optional;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * V3.2 hypothesis loop (spec §8, arch §4.7): gather → propose → critique → score →
 * route (keep / revise-once / discard) → persist. Every stage is pure-compute or pure-LLM,
 * never both (NFR-M-4); both LLM stages run on the SMART tier ({@code llm.smart-model} — its
 * debut). Survivors land as {@code kind=ai_hypothesis} {@code pattern} rows in the V3.1 Inbox:
 * {@code confidence} = the weighted critique score, critique jsonb attached (its
 * {@code reasoning} surfaces as the card's "AI gondolatmenete"), {@code r/n/p} stay null.
 * Identity = {@code "hyp-" + hash(normalized title)}; an existing row with the same key — ANY
 * status — is never re-proposed (a rejected hypothesis stays rejected). S2 (mezo-eq85.2): the
 * weekly {@code HypothesisJob} is retired — the nightly {@code ReflectionJob} drives this loop
 * and caps it with {@code mezo.companion.reflection.propose.max-per-night}. Defensive parsing all
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
            minták) alapján javasolj legfeljebb %d MECHANIZMUS-szintű hipotézist {{NÉV}} adatairól —
            olyan ok-okozati sejtést, amit a páronkénti statisztika önmagában nem lát. Csak a
            megadott adatokra építs. Válaszolj KIZÁRÓLAG JSON tömbbel, pontosan ebben a formában:
            [{"title":"...","mechanism":"...","category":"physiology|trigger|response","testPlan":{"seriesA":"...","seriesB":"...","lagDays":0,"expectedDirection":"positive|negative"}}]
            A testPlan az ELŐRE RÖGZÍTETT teszt, amivel a sejtés MEGCÁFOLHATÓ: két KÜLÖNBÖZŐ sorozat
            kizárólag az alábbi listáról (ne találj ki újat), a lag 0..3 nap, az irány pedig az,
            amit vársz. Ha nem tudsz mérhető tesztet adni, a testPlan legyen null — a sejtés akkor is
            érdekes lehet.
            ELÉRHETŐ SOROZATOK: %s
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
    private final MetricSeriesService metricSeriesService;
    private final PatternMonitorService patternMonitorService;
    private final CompanionProperties properties;
    /** S2 (mezo-eq85.2): the nightly pass owns the proposal cap now — the weekly cron is gone. */
    private final ReflectionProperties reflectionProperties;
    private final ObjectMapper objectMapper;
    private final LlmCallContextHolder llmCallContextHolder;
    private final AppNotificationEmitter appNotificationEmitter;
    private final PromptPersona promptPersona;
    /** S3 (mezo-eq85.3): the reflection collaborators are REFLECTION_SWITCH-gated while this
     *  service is not (TextSignalListenerSwitchOffIT keeps the context up with Reflexió off), so
     *  they can only be reached lazily. Absent ⇒ the loop degrades to the pre-S3 qualitative
     *  behaviour instead of failing. */
    private final ObjectProvider<TestPlanValidator> testPlanValidator;
    private final ObjectProvider<ReflectionMemoryGateway> reflectionMemoryGateway;
    /** A Spring Data repository is never switch-gated, so yesterday's signal digest needs no provider. */
    private final TextSignalRepository textSignalRepository;

    /** One hypothesis as the LLM returns it — {@code testPlan} is a PROPOSAL, never a decision:
     *  {@link TestPlanValidator} is what turns it into something the engine will test. */
    record Hypothesis(String title, String mechanism, String category, RawTestPlan testPlan) {}

    /** The 4-factor critique as the LLM returns it. */
    record Critique(Double statistical, Double confounders, Double l3align, Double actionability,
                    String reasoning) {}

    /**
     * Runs the whole proposal loop for one user; returns the number of persisted survivors.
     *
     * <p>S2 (mezo-eq85.2): {@code extraContext} is appended to the gathered narrative when
     * non-null — the seam the nightly {@code ReflectionJob} hands its own material through
     * (Task 3 fills it). Null means "just the weekly narrative", i.e. the pre-S2 behaviour.
     */
    public int run(UUID userId, String extraContext) {
        String context = gather(userId);
        if (context == null) {
            log.debug("No narrative context for user {} — no hypothesis round", userId);
            return 0;
        }
        String extra = extraContext == null ? nightlyContext(userId) : extraContext;
        if (extra != null && !extra.isBlank()) {
            context = context + "\n\n" + extra;
        }
        int max = reflectionProperties.propose().maxPerNight();
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

    /**
     * S3 (mezo-eq85.3): what the NIGHTLY pass knows on top of the weekly narrative — yesterday's
     * text signals, the hypotheses already open (so the model does not re-propose them), and the
     * memory-platform block retrieved under the {@code REFLECTION} policy. Built here only when
     * the caller handed no {@code extraContext}; every part is optional and a missing part is
     * simply left out.
     */
    private String nightlyContext(UUID userId) {
        String digest = yesterdaySignalDigest(userId);
        String open = openHypotheses(userId);
        String memories = memoryBlock(userId, digest);
        StringBuilder out = new StringBuilder();
        if (!digest.isBlank()) {
            out.append("TEGNAPI JELZÉSEK (a szövegeidből):\n").append(digest);
        }
        if (!open.isBlank()) {
            appendSection(out, "NYITOTT HIPOTÉZISEK (ezeket NE javasold újra):\n" + open);
        }
        if (!memories.isBlank()) {
            appendSection(out, "EMLÉKEK (memória-platform):\n" + memories);
        }
        return out.toString();
    }

    private static void appendSection(StringBuilder out, String section) {
        if (!out.isEmpty()) {
            out.append("\n\n");
        }
        out.append(section);
    }

    /** Yesterday's newest signal per source, as one line each — "" when the day produced none. */
    private String yesterdaySignalDigest(UUID userId) {
        LocalDate day = LocalDate.now().minusDays(1);
        Map<String, TextSignalEntity> newest = new LinkedHashMap<>();
        for (TextSignalEntity signal : textSignalRepository
                .findByCreatedByAndOccurredOnBetweenAndDeletedFalseOrderByOccurredOnAscVersionDesc(
                        userId, day, day)) {
            // first seen per source = highest version (the query orders version desc)
            newest.putIfAbsent(signal.getSourceKind() + ':' + signal.getSourceId(), signal);
        }
        return newest.values().stream()
                .map(HypothesisPipelineService::signalLine)
                .collect(Collectors.joining("\n"));
    }

    private static String signalLine(TextSignalEntity signal) {
        return "- " + signal.getSourceKind()
                + ": hangulat " + nullSafe(signal.getMood())
                + ", energia " + nullSafe(signal.getEnergy())
                + ", stressz " + nullSafe(signal.getStress())
                + (signal.getPeople().isEmpty() ? "" : ", emberek: " + String.join(", ", signal.getPeople()))
                + (signal.getTopics().isEmpty() ? "" : ", témák: " + String.join(", ", signal.getTopics()));
    }

    private static String nullSafe(Integer value) {
        return value == null ? "–" : value.toString();
    }

    /** The rows the engine is still testing — title, state and the running tally. */
    private String openHypotheses(UUID userId) {
        return patternRepository
                .findByCreatedByAndStatusInAndDeletedFalse(userId,
                        Set.of(PatternEntity.STATUS_PROPOSED, PatternEntity.STATUS_MONITORING))
                .stream()
                .filter(p -> !PatternEntity.KIND_STATISTICAL.equals(p.getKind()))
                .map(p -> "- " + p.getTitle() + " · " + p.getStatus()
                        + " · " + p.getEvidenceHits() + " bejött / " + p.getEvidenceMisses() + " nem")
                .collect(Collectors.joining("\n"));
    }

    /** One audited REFLECTION retrieval — "" when Reflexió is off or the platform could not answer. */
    private String memoryBlock(UUID userId, String digest) {
        ReflectionMemoryGateway gateway = reflectionMemoryGateway.getIfAvailable();
        if (gateway == null || digest.isBlank()) {
            return "";
        }
        return gateway.contextFor(userId, "tegnap: " + digest, true);
    }

    /** Pure compute: weekly narrative context — null when there is nothing to hypothesize over.
     *  Package-private a gather-kontextus IT-nek (HypothesisGatherContextIT). */
    String gather(UUID userId) {
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
                + (statistical.isBlank() ? "" : "\n\nSTATISZTIKAI MINTÁK:\n" + statistical)
                + "\n\nHETI METRIKA-TÁBLA (sor = metrika, oszlop = nap, – = nincs adat):\n"
                + metricTable(userId)
                + gateDiagnostics(userId);
    }

    /** V3.4 B2: az összes metrika utolsó 7 lezárt napja nyers számokként — a páronkénti Pearson
     *  számára láthatatlan (küszöb / U-alak / interakció) sejtésekhez. */
    private String metricTable(UUID userId) {
        LocalDate to = LocalDate.now().minusDays(1);
        LocalDate from = to.minusDays(6);
        StringBuilder table = new StringBuilder("metrika");
        for (LocalDate day = from; !day.isAfter(to); day = day.plusDays(1)) {
            table.append(" | ").append(day.getMonthValue()).append('.').append(day.getDayOfMonth()).append('.');
        }
        for (MetricKey metric : MetricKey.values()) {
            if (!metric.correlatable()) {
                continue; // bd mezo-dqzm: amit nem korrelálhat, arról ne is sejtsen a modell
            }
            Map<LocalDate, Double> series = metricSeriesService.series(userId, metric, from, to);
            table.append('\n').append(metric.labelHu());
            for (LocalDate day = from; !day.isAfter(to); day = day.plusDays(1)) {
                Double value = series.get(day);
                table.append(" | ").append(value == null ? "–" : compact(value));
            }
        }
        return table.toString();
    }

    private static String compact(double value) {
        return BigDecimal.valueOf(value).setScale(2, RoundingMode.HALF_UP)
                .stripTrailingZeros().toPlainString();
    }

    /** V3.4 B3: a nem-élő (és nem user-judged) párok egysoros kapu-összegzése — a hiányzó adatról
     *  szóló actionable hipotézisek takarmánya. */
    private String gateDiagnostics(UUID userId) {
        PatternMonitorResponse monitor = patternMonitorService.monitor(userId);
        String lines = monitor.getPairs().stream()
                .filter(p -> !PatternMonitorService.VERDICT_LIVE.equals(p.getVerdict())
                        && !PatternMonitorService.VERDICT_FROZEN.equals(p.getVerdict()))
                .map(p -> "- " + p.getTitle() + " (" + p.getKey() + "): " + p.getVerdict()
                        + ", illesztett napok " + p.getAlignedDays() + "/" + monitor.getMinN()
                        + (p.getBottleneckMetricKey() == null
                                ? "" : ", szűk keresztmetszet: " + p.getBottleneckMetricKey()))
                .collect(Collectors.joining("\n"));
        return lines.isBlank() ? "" : "\n\nKAPU-DIAGNOSZTIKA (nem-élő párok):\n" + lines;
    }

    /**
     * The series a test plan may name. With Reflexió on this is the user's own menu (the
     * correlatable metrics PLUS the {@code people:}/{@code topic:} keys their texts carry); with
     * it off, the fixed metric catalog — the prompt then still asks for a plan, and every plan
     * simply fails validation, which is the honest degrade.
     */
    private List<String> availableSeries(UUID userId) {
        TestPlanValidator validator = testPlanValidator.getIfAvailable();
        if (validator != null) {
            return validator.availableSeries(userId);
        }
        return Arrays.stream(MetricKey.values())
                .filter(MetricKey::correlatable)
                .map(MetricKey::wireKey)
                .toList();
    }

    private List<Hypothesis> propose(UUID userId, String context) {
        String raw;
        try {
            String prompt = promptPersona.render(userId, String.format(Locale.ROOT, PROPOSE_PROMPT,
                    reflectionProperties.propose().maxPerNight(),
                    String.join(", ", availableSeries(userId))));
            raw = llmCallContextHolder.runWith(
                    new LlmCallContext("companion_hypothesis", "propose", null, null),
                    () -> companionLlm.completeSmart(prompt, context));
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
        String raw = llmCallContextHolder.runWith(
                new LlmCallContext("companion_hypothesis", "critique", null, null),
                () -> companionLlm.completeSmart(CRITIQUE_PROMPT, payload));
        Critique parsed = parseObject(raw, new TypeReference<Critique>() {});
        // a broken critique is a ZERO critique — an unjudgeable hypothesis never survives
        return parsed != null ? parsed : new Critique(0.0, 0.0, 0.0, 0.0, null);
    }

    private Hypothesis revise(String context, Hypothesis hypothesis, Critique critique) {
        String payload = "HIPOTÉZIS: " + hypothesis.title() + "\nMECHANIZMUS: " + hypothesis.mechanism()
                + "\nKRITIKA: " + (critique.reasoning() == null ? "" : critique.reasoning())
                + "\n\nKONTEXTUS:\n" + context;
        String raw = llmCallContextHolder.runWith(
                new LlmCallContext("companion_hypothesis", "revise", null, null),
                () -> companionLlm.completeSmart(REVISE_PROMPT, payload));
        Hypothesis revised = parseObject(raw, new TypeReference<Hypothesis>() {});
        // A revision is a REWORDING: the test — and therefore the identity — is the original's.
        return revised == null ? null : new Hypothesis(revised.title(), revised.mechanism(),
                revised.category(), hypothesis.testPlan());
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

    /**
     * Persist unless the identity already exists in ANY status (rejected stays rejected).
     *
     * <p>S3 (mezo-eq85.3): a proposal whose test plan SURVIVES validation becomes a falsifiable
     * {@code reflection} row identified by the PLAN ({@code ref-<hash>}) — reword it a hundred
     * times and it is still the same hypothesis. Everything else stays the pre-S3 qualitative
     * {@code ai_hypothesis} row identified by the title hash. Reflection rows raise no
     * {@code HYPOTHESIS_NEW} notification: the observation feed (Task 4) is their surface.
     */
    private boolean persist(UUID userId, Hypothesis hypothesis, Critique critique, double score) {
        String title = hypothesis.title().length() > 200
                ? hypothesis.title().substring(0, 200) : hypothesis.title();
        Optional<TestPlanEnvelope> plan = validatedPlan(userId, hypothesis);
        String pairKey = plan.map(TestPlanEnvelope::key).orElseGet(() -> hypothesisKey(title));
        if (alreadyKnown(userId, plan, pairKey)) {
            log.debug("Hypothesis '{}' already known (any status) — skipping", title);
            return false;
        }
        PatternEntity pattern = new PatternEntity();
        pattern.setCreatedBy(userId);
        pattern.setKind(plan.isPresent() ? PatternEntity.KIND_REFLECTION : PatternEntity.KIND_AI_HYPOTHESIS);
        pattern.setPairKey(pairKey);
        plan.ifPresent(envelope -> {
            pattern.setHypothesisKey(pairKey);
            pattern.setTestPlan(envelope);
            pattern.setOrigin(PatternEntity.ORIGIN_NIGHTLY_REFLECTION);
        });
        pattern.setCategory(hypothesis.category());
        pattern.setCategoryLabel(categoryLabel(hypothesis.category()));
        pattern.setTitle(title);
        pattern.setMechanism(hypothesis.mechanism());
        pattern.setEvidence(new PatternEvidenceEnvelope(List.of(
                String.format(Locale.ROOT, "kritika-pontszám %.2f", score),
                "hipotézis-kör", LocalDate.now().toString())));
        pattern.setConfidence(BigDecimal.valueOf(score).setScale(3, RoundingMode.HALF_UP));
        pattern.setCritique(new PatternCritiqueEnvelope(critique.statistical(), critique.confounders(),
                critique.l3align(), critique.actionability(), critique.reasoning()));
        pattern.setStatus(PatternEntity.STATUS_PROPOSED);
        pattern.setLastDetectedAt(Instant.now().truncatedTo(ChronoUnit.MICROS)); // timestamptz stores micros — truncate so the persisted row equals the in-memory one (mezo-mfmb)
        patternRepository.saveAndFlush(pattern);
        if (plan.isEmpty()) {
            appNotificationEmitter.emit(userId, AppNotificationKind.HYPOTHESIS_NEW,
                    "Új AI-hipotézis készült",
                    "„" + title + "” — a hipotézis-körből. Nézd meg a Minták között.",
                    AppNotificationKind.HYPOTHESIS_NEW.deeplink(), pattern.getId(),
                    "hypothesis_new:" + pairKey);
        }
        return true;
    }

    /** "" when Reflexió is off or the plan is unusable — the proposal then degrades, never fails. */
    private Optional<TestPlanEnvelope> validatedPlan(UUID userId, Hypothesis hypothesis) {
        TestPlanValidator validator = testPlanValidator.getIfAvailable();
        return validator == null
                ? Optional.empty() : validator.validate(userId, hypothesis.testPlan());
    }

    /** Identity probe: the hypothesis key for a planned row, the title hash for a qualitative one. */
    private boolean alreadyKnown(UUID userId, Optional<TestPlanEnvelope> plan, String key) {
        return plan.isPresent()
                ? patternRepository.findByCreatedByAndHypothesisKeyAndDeletedFalse(userId, key).isPresent()
                : patternRepository.findByCreatedByAndKindAndPairKeyAndDeletedFalse(
                        userId, PatternEntity.KIND_AI_HYPOTHESIS, key).isPresent();
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
