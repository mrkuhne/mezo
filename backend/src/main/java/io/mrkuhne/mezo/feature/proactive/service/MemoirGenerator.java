package io.mrkuhne.mezo.feature.proactive.service;

import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.companion.entity.DailySummaryEntity;
import io.mrkuhne.mezo.feature.companion.repository.DailySummaryRepository;
import io.mrkuhne.mezo.feature.companion.repository.PatternRepository;
import io.mrkuhne.mezo.feature.companion.service.KnowledgeFactService;
import io.mrkuhne.mezo.feature.proactive.entity.MemoirAnchorsEnvelope;
import io.mrkuhne.mezo.feature.proactive.entity.MemoirEntity;
import io.mrkuhne.mezo.feature.proactive.repository.MemoirRepository;
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
 * W2 memoir generator (spec §5, old journey 5.8): PURE-CODE gather (the week's daily summaries
 * [weekStart, weekStart+6] + facts + patterns + numbered anchor candidates) → ONE SMART-tier
 * call with a strict-JSON contract {title, body, anchorIndexes} — anchors are model-SELECTED
 * from code-collected candidates (the briefing ref rule), never invented. Empty week or
 * unusable answer ⇒ NO row. Existing row ⇒ returned untouched.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(
        name = {FeaturesConfiguration.COMPANION_SWITCH, FeaturesConfiguration.PROACTIVE_SWITCH},
        havingValue = "true")
public class MemoirGenerator {

    /** Prompt prefix the fake dispatches on — MIRRORED as a literal in FakeCompanionLlm. */
    public static final String MEMOIR_MARKER = "HETI-MEMOIR-FELADAT";

    private static final String PROMPT = MEMOIR_MARKER + "\n"
            + "Írj rövid, irodalmi hangvételű magyar heti memoárt Danielről, társ-szemszögből, "
            + "kizárólag a megadott hét tényadataiból. Legyen benne konkrét megfigyelés és egy "
            + "gyengéd észrevétel; számot vagy adatot kitalálni tilos; gyógyszer adagolására "
            + "vonatkozó változtatást SOHA ne javasolj. Válaszolj KIZÁRÓLAG szigorú JSON-nal: "
            + "{\"title\": \"rövid cím\", \"body\": \"a memoár szövege\", "
            + "\"anchorIndexes\": [a felhasznált HORGONY-JELÖLTEK sorszámai]}";

    private final MemoirRepository memoirRepository;
    private final DailySummaryRepository dailySummaryRepository;
    private final PatternRepository patternRepository;
    private final KnowledgeFactService knowledgeFactService;
    private final CompanionLlm companionLlm;
    private final ObjectMapper objectMapper;

    public record MemoirGather(String payload, List<MemoirAnchorsEnvelope.Anchor> candidates) {
    }

    record ParsedMemoir(String title, String body, List<Integer> anchorIndexes) {
    }

    @Transactional
    public MemoirEntity generate(UUID userId, LocalDate weekStart) {
        MemoirEntity existing = memoirRepository
                .findByCreatedByAndWeekStart(userId, weekStart).orElse(null);
        if (existing != null) {
            return existing;
        }
        MemoirGather gather = gather(userId, weekStart);
        if (gather == null) {
            log.debug("No summaries in week {} for {} — no memoir", weekStart, userId);
            return null;
        }
        String answer = companionLlm.completeSmart(PROMPT, gather.payload());
        ParsedMemoir parsed = parse(answer);
        if (parsed == null || parsed.title() == null || parsed.title().isBlank()
                || parsed.body() == null || parsed.body().isBlank()) {
            log.warn("Unusable memoir answer for {} week {} — no row", userId, weekStart);
            return null;
        }
        MemoirEntity memoir = new MemoirEntity();
        memoir.setCreatedBy(userId);
        memoir.setWeekStart(weekStart);
        memoir.setTitle(parsed.title().strip());
        memoir.setBody(parsed.body().strip());
        memoir.setAnchors(new MemoirAnchorsEnvelope(
                resolveAnchors(parsed.anchorIndexes(), gather.candidates())));
        memoir.setGeneratedAt(Instant.now().truncatedTo(ChronoUnit.MICROS));
        return memoirRepository.saveAndFlush(memoir);
    }

    /** PURE-CODE payload; null when the week [weekStart, weekStart+6] has no summaries. */
    public MemoirGather gather(UUID userId, LocalDate weekStart) {
        LocalDate weekEnd = weekStart.plusDays(6);
        List<DailySummaryEntity> week = dailySummaryRepository
                .findByCreatedByAndSummaryDateGreaterThanEqualOrderBySummaryDateDesc(userId, weekStart)
                .stream()
                .filter(s -> !s.getSummaryDate().isAfter(weekEnd))
                .toList();
        if (week.isEmpty()) {
            return null;
        }
        List<MemoirAnchorsEnvelope.Anchor> candidates = new ArrayList<>();
        StringBuilder payload = new StringBuilder("A HÉT NAPJAI (" + weekStart + " – " + weekEnd + "):\n");
        for (DailySummaryEntity s : week) {
            payload.append("- ").append(s.getSummaryDate()).append(": ")
                    .append(s.getNarrative()).append('\n');
            candidates.add(new MemoirAnchorsEnvelope.Anchor("Memory", s.getSummaryDate().toString()));
        }
        payload.append(knowledgeFactService.renderPromptBlock(userId));
        var patterns = patternRepository
                .findByCreatedByAndDeletedFalseOrderByLastDetectedAtDesc(userId);
        if (!patterns.isEmpty()) {
            payload.append("\n\nMINTÁK:\n");
            for (var p : patterns) {
                payload.append("- ").append(p.getTitle()).append(" (státusz: ")
                        .append(p.getStatus()).append(")\n");
                candidates.add(new MemoirAnchorsEnvelope.Anchor("Pattern", p.getTitle()));
            }
        }
        payload.append("\nHORGONY-JELÖLTEK (az anchorIndexes ezekre mutat):\n");
        for (int i = 0; i < candidates.size(); i++) {
            payload.append(i).append(": [").append(candidates.get(i).kind()).append("] ")
                    .append(candidates.get(i).label()).append('\n');
        }
        return new MemoirGather(payload.toString(), candidates);
    }

    private ParsedMemoir parse(String answer) {
        if (answer == null) {
            return null;
        }
        int start = answer.indexOf('{');
        int end = answer.lastIndexOf('}');
        if (start < 0 || end <= start) {
            return null;
        }
        try {
            return objectMapper.readValue(answer.substring(start, end + 1), ParsedMemoir.class);
        } catch (Exception e) {
            log.warn("Memoir answer failed to parse: {}", e.getMessage());
            return null;
        }
    }

    private List<MemoirAnchorsEnvelope.Anchor> resolveAnchors(
            List<Integer> indexes, List<MemoirAnchorsEnvelope.Anchor> candidates) {
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
