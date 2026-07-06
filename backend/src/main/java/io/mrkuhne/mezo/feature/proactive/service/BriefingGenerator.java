package io.mrkuhne.mezo.feature.proactive.service;

import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.companion.entity.DailySummaryEntity;
import io.mrkuhne.mezo.feature.companion.repository.DailySummaryRepository;
import io.mrkuhne.mezo.feature.companion.service.ContextSnapshotAssembler;
import io.mrkuhne.mezo.feature.companion.service.KnowledgeFactService;
import io.mrkuhne.mezo.feature.proactive.config.ProactiveProperties;
import io.mrkuhne.mezo.feature.proactive.entity.BriefingContentEnvelope;
import io.mrkuhne.mezo.feature.proactive.entity.BriefingEntity;
import io.mrkuhne.mezo.feature.proactive.repository.BriefingRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.ObjectMapper;

/**
 * B1.1 morning-briefing generator (spec §4): a PURE-CODE gather composes the shipped companion
 * reads (V0.3 snapshot + V1.1 facts block + V2.2 daily summaries) plus numbered, code-collected
 * ref candidates; ONE cheap-tier CompanionLlm call answers a strict-JSON contract
 * ({eyebrow, body[], refIndexes[]}); the model SELECTS refs by index and can never invent one.
 * Gather = pure code, prose = pure LLM (NFR-M-4). No summaries in the window or a broken answer
 * ⇒ NO row (honest absence, never a fabricated briefing). Existing row ⇒ returned untouched
 * (idempotent; B1.2 owns staleness/regeneration).
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.PROACTIVE_SWITCH},
        havingValue = "true")
public class BriefingGenerator {

    /** Prompt prefix the fake LLM dispatches on — MIRRORED as a literal in FakeCompanionLlm
     *  (a companion→proactive import would be a new package cycle). Keep the two in sync. */
    public static final String BRIEFING_MARKER = "REGGELI-BRIEFING-FELADAT";

    private static final String PROMPT = BRIEFING_MARKER + "\n"
            + "Írj rövid magyar reggeli briefinget Danielnek a mai napra, kizárólag a megadott "
            + "tényadatokból. Szabályok: (1) ha az éjszakai alvás gyenge volt, azzal kezdd — az a "
            + "nap elsődleges tényezője; (2) többhorizontú: a mai terv mellett utalj a hét "
            + "trendjére; (3) zárd 2-3 konkrét, apró fókuszponttal; (4) számot vagy adatot "
            + "kitalálni tilos; (5) gyógyszer adagolására (pl. retatrutid) vonatkozó változtatást "
            + "SOHA ne javasolj — az orvosi döntés. Válaszolj KIZÁRÓLAG szigorú JSON-nal, "
            + "markdown nélkül, pontosan ebben a formában: "
            + "{\"eyebrow\": \"egysoros fejléc\", \"body\": [\"bekezdés\", ...], "
            + "\"refIndexes\": [a felhasznált HIVATKOZÁS-JELÖLTEK sorszámai]}";

    /** The six V0.3 snapshot blocks as static ref candidates (kind = the FE RefTag vocabulary). */
    static final List<BriefingContentEnvelope.Ref> SNAPSHOT_CANDIDATES = List.of(
            new BriefingContentEnvelope.Ref("WeightTrend", "profil"),
            new BriefingContentEnvelope.Ref("Goal", "cél"),
            new BriefingContentEnvelope.Ref("Workout", "edzés"),
            new BriefingContentEnvelope.Ref("FuelDay", "mai üzemanyag"),
            new BriefingContentEnvelope.Ref("Medication", "gyógyszer"),
            new BriefingContentEnvelope.Ref("Sleep", "regeneráció"));

    private final BriefingRepository briefingRepository;
    private final DailySummaryRepository dailySummaryRepository;
    private final ContextSnapshotAssembler contextSnapshotAssembler;
    private final KnowledgeFactService knowledgeFactService;
    private final CompanionLlm companionLlm;
    private final ProactiveProperties properties;
    private final ObjectMapper objectMapper;

    /** The gather's output: the prompt payload + the numbered ref candidates it offered. */
    public record BriefingGather(String payload, List<BriefingContentEnvelope.Ref> candidates) {
    }

    /** The model's strict-JSON answer shape. */
    record ParsedBriefing(String eyebrow, List<String> body, List<Integer> refIndexes) {
    }

    /**
     * Generates (or returns the existing) briefing for one day. Returns null when there is no
     * narrative memory in the window or the answer is unusable — the caller renders honest 404.
     */
    @Transactional
    public BriefingEntity generate(UUID userId, LocalDate date) {
        BriefingEntity existing = briefingRepository
                .findByCreatedByAndBriefingDate(userId, date).orElse(null);
        if (existing != null) {
            return existing;
        }
        BriefingGather gather = gather(userId, date);
        if (gather == null) {
            log.debug("No daily summaries for {} in the {}-day window before {} — no briefing",
                    userId, properties.briefing().pastDays(), date);
            return null;
        }
        String answer = companionLlm.complete(PROMPT, gather.payload());
        ParsedBriefing parsed = parse(answer);
        if (parsed == null || parsed.eyebrow() == null || parsed.eyebrow().isBlank()
                || parsed.body() == null || parsed.body().isEmpty()) {
            log.warn("Unusable briefing answer for {} on {} — no row persisted", userId, date);
            return null;
        }
        BriefingEntity briefing = new BriefingEntity();
        briefing.setCreatedBy(userId);
        briefing.setBriefingDate(date);
        briefing.setContent(new BriefingContentEnvelope(
                parsed.eyebrow(), parsed.body(), resolveRefs(parsed.refIndexes(), gather.candidates())));
        briefing.setGeneratedAt(Instant.now().truncatedTo(ChronoUnit.MICROS));
        return briefingRepository.saveAndFlush(briefing);
    }

    /**
     * PURE-CODE composition of the prompt payload (LLM-free, IT-asserted): snapshot + facts +
     * past narratives + the numbered candidate list. Null when the summary window is empty —
     * the v1 emptiness gate (spec §7, decided at B1.1; B1.2 may loosen it).
     */
    public BriefingGather gather(UUID userId, LocalDate date) {
        List<DailySummaryEntity> past = dailySummaryRepository
                .findByCreatedByAndSummaryDateGreaterThanEqualOrderBySummaryDateDesc(
                        userId, date.minusDays(properties.briefing().pastDays()));
        if (past.isEmpty()) {
            return null;
        }
        List<BriefingContentEnvelope.Ref> candidates = new ArrayList<>(SNAPSHOT_CANDIDATES);
        StringBuilder payload = new StringBuilder();
        payload.append(contextSnapshotAssembler.render(userId, date));
        payload.append(knowledgeFactService.renderPromptBlock(userId));
        payload.append("\n\nKORÁBBI NAPOK (legfrissebb elöl):\n");
        for (DailySummaryEntity summary : past) {
            payload.append("- ").append(summary.getSummaryDate()).append(": ")
                    .append(summary.getNarrative()).append('\n');
            candidates.add(new BriefingContentEnvelope.Ref(
                    "Memory", summary.getSummaryDate().toString()));
        }
        payload.append("\nHIVATKOZÁS-JELÖLTEK (a refIndexes ezekre mutat):\n");
        for (int i = 0; i < candidates.size(); i++) {
            BriefingContentEnvelope.Ref ref = candidates.get(i);
            payload.append(i).append(": [").append(ref.kind()).append("] ")
                    .append(ref.label()).append('\n');
        }
        return new BriefingGather(payload.toString(), candidates);
    }

    /** Defensive first-{ to last-} JSON parse (the FactExtractionService idiom); null on any failure. */
    private ParsedBriefing parse(String answer) {
        if (answer == null) {
            return null;
        }
        int start = answer.indexOf('{');
        int end = answer.lastIndexOf('}');
        if (start < 0 || end <= start) {
            return null;
        }
        try {
            return objectMapper.readValue(answer.substring(start, end + 1), ParsedBriefing.class);
        } catch (Exception e) {
            log.warn("Briefing answer failed to parse: {}", e.getMessage());
            return null;
        }
    }

    /** Bounds-checked, order-preserving, deduped index→candidate resolution. */
    private List<BriefingContentEnvelope.Ref> resolveRefs(
            List<Integer> indexes, List<BriefingContentEnvelope.Ref> candidates) {
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
