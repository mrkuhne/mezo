package io.mrkuhne.mezo.feature.proactive.service;

import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.companion.entity.DailySummaryEntity;
import io.mrkuhne.mezo.feature.companion.repository.DailySummaryRepository;
import io.mrkuhne.mezo.feature.companion.service.ContextSnapshotAssembler;
import io.mrkuhne.mezo.feature.companion.service.KnowledgeFactService;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContext;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContextHolder;
import io.mrkuhne.mezo.feature.proactive.config.ProactiveProperties;
import io.mrkuhne.mezo.feature.proactive.entity.CompanionMessageEntity;
import io.mrkuhne.mezo.feature.proactive.entity.CompanionMessageEnvelope;
import io.mrkuhne.mezo.feature.proactive.repository.CompanionMessageRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

/**
 * Companion-feed morning-kind generator (spec §3): the day's FIRST message, generated before
 * sleep/weight logging — its gather must not carry biometric state at all (a prompt prohibition
 * alone is not enough, so the gather is stripped at the source via {@link
 * ContextSnapshotAssembler#renderWithoutBiometrics}). Mirrors {@link BriefingGenerator}'s idiom
 * (pure-code gather -> ONE cheap-tier LLM call -> defensive parse -> bounds-checked ref
 * resolution -> saveAndFlush); no summaries in the window or a broken answer ⇒ NO row (honest
 * absence). Existing row ⇒ returned untouched (idempotent).
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.PROACTIVE_SWITCH},
        havingValue = "true")
public class CompanionMessageGenerator {

    /** Prompt prefix the fake LLM dispatches on — MIRRORED as a literal in FakeCompanionLlm
     *  (a companion→proactive import would be a new package cycle). Keep the two in sync. */
    public static final String MORNING_MARKER = "REGGELI-ELIGAZITAS-FELADAT";

    private static final String MORNING_PROMPT = MORNING_MARKER + "\n"
            + "Írj rövid magyar reggeli eligazítást Danielnek a mai napra, kizárólag a megadott "
            + "tényadatokból. Ez a nap ELSŐ üzenete, még az alvás és a testsúly rögzítése ELŐTT "
            + "készül: (1) az éjszakai alvásról és a testsúlyról/súlytrendről NE írj — azokról "
            + "külön üzenet szól majd, amint Daniel rögzítette őket; (2) fókusz: a mai terv "
            + "(edzés, kalóriakeret, gyógyszer) és a hét trendje; (3) zárd 2-3 konkrét, apró "
            + "fókuszponttal; (4) számot vagy adatot kitalálni tilos; (5) gyógyszer adagolására "
            + "(pl. retatrutid) vonatkozó változtatást SOHA ne javasolj — az orvosi döntés. "
            + "Válaszolj KIZÁRÓLAG szigorú JSON-nal, markdown nélkül, pontosan ebben a formában: "
            + "{\"eyebrow\": \"egysoros fejléc\", \"body\": [\"bekezdés\", ...], "
            + "\"refIndexes\": [a felhasznált HIVATKOZÁS-JELÖLTEK sorszámai]}";

    /** Morning ref candidates — deliberately NO WeightTrend / Sleep (spec §3). */
    static final List<CompanionMessageEnvelope.Ref> MORNING_CANDIDATES = List.of(
            new CompanionMessageEnvelope.Ref("Goal", "cél"),
            new CompanionMessageEnvelope.Ref("Workout", "edzés"),
            new CompanionMessageEnvelope.Ref("FuelDay", "mai üzemanyag"),
            new CompanionMessageEnvelope.Ref("Medication", "gyógyszer"));

    record ParsedMessage(String eyebrow, List<String> body, List<Integer> refIndexes) {
    }

    private final CompanionMessageRepository companionMessageRepository;
    private final DailySummaryRepository dailySummaryRepository;
    private final ContextSnapshotAssembler contextSnapshotAssembler;
    private final KnowledgeFactService knowledgeFactService;
    private final CompanionLlm companionLlm;
    private final LlmCallContextHolder llmCallContextHolder;
    private final ProactiveProperties properties;
    private final ObjectMapper objectMapper;

    /**
     * Generates (or returns the existing) morning message for one day. Returns null when there
     * is no narrative memory in the window or the answer is unusable — the caller renders honest
     * absence.
     */
    @Transactional
    public CompanionMessageEntity generateMorning(UUID userId, LocalDate date) {
        CompanionMessageEntity existing = companionMessageRepository
                .findByCreatedByAndMessageDateAndKind(userId, date, CompanionMessageEntity.KIND_MORNING)
                .orElse(null);
        if (existing != null) {
            return existing;
        }
        List<DailySummaryEntity> past = dailySummaryRepository
                .findByCreatedByAndSummaryDateGreaterThanEqualOrderBySummaryDateDesc(
                        userId, date.minusDays(properties.briefing().pastDays()));
        if (past.isEmpty()) {
            log.debug("No daily summaries for {} in the {}-day window before {} — no morning message",
                    userId, properties.briefing().pastDays(), date);
            return null;
        }
        List<CompanionMessageEnvelope.Ref> candidates = new ArrayList<>(MORNING_CANDIDATES);
        StringBuilder payload = new StringBuilder();
        payload.append(contextSnapshotAssembler.renderWithoutBiometrics(userId, date));
        payload.append(knowledgeFactService.renderPromptBlock(userId));
        payload.append("\n\nKORÁBBI NAPOK (legfrissebb elöl):\n");
        for (DailySummaryEntity summary : past) {
            payload.append("- ").append(summary.getSummaryDate()).append(": ")
                    .append(summary.getNarrative()).append('\n');
            candidates.add(new CompanionMessageEnvelope.Ref(
                    "Memory", summary.getSummaryDate().toString()));
        }
        payload.append("\nHIVATKOZÁS-JELÖLTEK (a refIndexes ezekre mutat):\n");
        for (int i = 0; i < candidates.size(); i++) {
            CompanionMessageEnvelope.Ref ref = candidates.get(i);
            payload.append(i).append(": [").append(ref.kind()).append("] ")
                    .append(ref.label()).append('\n');
        }

        String answer = llmCallContextHolder.runWith(
                new LlmCallContext("proactive_feed", "morning", null, null),
                () -> companionLlm.complete(MORNING_PROMPT, payload.toString()));
        ParsedMessage parsed = parse(answer);
        if (parsed == null || parsed.eyebrow() == null || parsed.eyebrow().isBlank()
                || parsed.body() == null || parsed.body().isEmpty()) {
            log.warn("Unusable morning-message answer for {} on {} — no row persisted", userId, date);
            return null;
        }
        CompanionMessageEntity message = new CompanionMessageEntity();
        message.setCreatedBy(userId);
        message.setMessageDate(date);
        message.setKind(CompanionMessageEntity.KIND_MORNING);
        message.setContent(new CompanionMessageEnvelope(
                parsed.eyebrow(), parsed.body(), resolveRefs(parsed.refIndexes(), candidates)));
        message.setGeneratedAt(Instant.now().truncatedTo(ChronoUnit.MICROS));
        return companionMessageRepository.saveAndFlush(message);
    }

    /** Today's already-persisted feed messages as a "ne ismételd" block; "" when none. */
    private String earlierMessagesBlock(UUID userId, LocalDate date) {
        List<CompanionMessageEntity> earlier =
                companionMessageRepository.findByCreatedByAndMessageDateOrderByGeneratedAtAsc(userId, date);
        if (earlier.isEmpty()) {
            return "";
        }
        return "\n\nMAI KORÁBBI ÜZENETEK (ne ismételd):\n" + earlier.stream()
                .map(m -> "- [" + m.getKind() + "] " + String.join(" ", m.getContent().body()))
                .collect(Collectors.joining("\n"));
    }

    /** Defensive first-{ to last-} JSON parse (the FactExtractionService idiom); null on any failure. */
    private ParsedMessage parse(String answer) {
        if (answer == null) {
            return null;
        }
        int start = answer.indexOf('{');
        int end = answer.lastIndexOf('}');
        if (start < 0 || end <= start) {
            return null;
        }
        try {
            return objectMapper.readValue(answer.substring(start, end + 1), ParsedMessage.class);
        } catch (Exception e) {
            log.warn("Morning-message answer failed to parse: {}", e.getMessage());
            return null;
        }
    }

    /** Bounds-checked, order-preserving, deduped index→candidate resolution. */
    private List<CompanionMessageEnvelope.Ref> resolveRefs(
            List<Integer> indexes, List<CompanionMessageEnvelope.Ref> candidates) {
        if (indexes == null) {
            return List.of();
        }
        return indexes.stream()
                .filter(i -> i != null && i >= 0 && i < candidates.size())
                .distinct()
                .map(candidates::get)
                .toList();
    }
}
