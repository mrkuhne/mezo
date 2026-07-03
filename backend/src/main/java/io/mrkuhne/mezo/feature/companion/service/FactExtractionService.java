package io.mrkuhne.mezo.feature.companion.service;

import io.mrkuhne.mezo.feature.companion.CompanionLlm;
import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import io.mrkuhne.mezo.feature.companion.entity.LearnedFactEntity;
import io.mrkuhne.mezo.feature.companion.repository.KnowledgeFactRepository;
import io.mrkuhne.mezo.feature.companion.repository.LearnedFactRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * V1.2 post-turn fact extraction: one cheap-tier LLM call over the turn transcript (via the
 * {@link CompanionLlm} port), strict-JSON answer parsed defensively, string-level dedupe against
 * the user's confirmed facts AND pending candidates, per-turn cap — survivors persist as
 * undecided {@code learned_fact} rows for the L2 confirm inbox. Never throws domain data
 * problems outward: a broken answer means zero candidates, not a broken turn.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class FactExtractionService {

    /** The extraction prompt's first word — the fake LLM keys its deterministic answer on it. */
    public static final String EXTRACTION_MARKER = "TÉNYKINYERÉS";

    static final String EXTRACTION_PROMPT = """
            TÉNYKINYERÉS. A következő beszélgetés-fordulóból gyűjtsd ki a Danielre vonatkozó ÚJ, tartós tényeket
            (preferencia, szokás, egészségi jellemző, cél) — kizárólag azt, amit Daniel maga állított vagy megerősített.
            Ne vegyél fel egyszeri eseményt, kérdést, feltételezést, sem a Mezo saját javaslatait.
            Válaszolj KIZÁRÓLAG egy JSON tömbbel, magyarázat nélkül, pontosan ebben a formában:
            [{"fact":"...","category":"train|fuel|health|life"}]
            Ha nincs új tartós tény: []""";

    private static final Set<String> CATEGORIES = Set.of("train", "fuel", "health", "life");

    private final CompanionLlm companionLlm;
    private final KnowledgeFactRepository knowledgeFactRepository;
    private final LearnedFactRepository learnedFactRepository;
    private final CompanionProperties properties;
    private final ObjectMapper objectMapper;

    /** One extracted item as the LLM returns it. */
    record ExtractedFact(String fact, String category) {}

    /** Runs the whole extraction for one committed turn; returns the number of persisted candidates. */
    @Transactional
    public int extractFromTurn(UUID userId, UUID userMessageId, String userContent, String assistantContent) {
        String transcript = "Daniel: " + userContent + "\nMezo: " + assistantContent;
        String raw;
        try {
            raw = companionLlm.complete(EXTRACTION_PROMPT, transcript);
        } catch (Exception e) {
            log.warn("Fact extraction LLM call failed for user {}", userId, e);
            return 0;
        }

        List<ExtractedFact> extracted = parse(raw).stream()
                .filter(f -> f.fact() != null && !f.fact().isBlank())
                .filter(f -> CATEGORIES.contains(f.category()))
                .toList();
        if (extracted.isEmpty()) {
            return 0;
        }

        Set<String> known = knownNormalizedTexts(userId);
        int persisted = 0;
        for (ExtractedFact fact : extracted) {
            if (persisted >= properties.extraction().maxCandidatesPerTurn()) {
                break;
            }
            if (!known.add(normalize(fact.fact()))) {
                continue; // duplicate of a confirmed fact, a pending candidate, or this batch
            }
            LearnedFactEntity candidate = new LearnedFactEntity();
            candidate.setCreatedBy(userId);
            candidate.setCandidateText(fact.fact().trim());
            candidate.setCategory(fact.category());
            candidate.setDerivedFromMessageId(userMessageId);
            learnedFactRepository.saveAndFlush(candidate);
            persisted++;
        }
        return persisted;
    }

    /** Defensive parse: first '['..last ']' substring, tolerant of fences/prose around the array. */
    private List<ExtractedFact> parse(String raw) {
        int start = raw.indexOf('[');
        int end = raw.lastIndexOf(']');
        if (start < 0 || end <= start) {
            return List.of();
        }
        try {
            return objectMapper.readValue(raw.substring(start, end + 1), new TypeReference<>() {});
        } catch (Exception e) {
            log.warn("Fact extraction answer was not parseable JSON — dropping: {}", raw, e);
            return List.of();
        }
    }

    private Set<String> knownNormalizedTexts(UUID userId) {
        Set<String> known = knowledgeFactRepository
                .findByCreatedByAndDeletedFalseOrderByReinforcementCountDescCreatedAtDesc(userId)
                .stream()
                .map(f -> normalize(f.getFactText()))
                .collect(Collectors.toCollection(HashSet::new));
        learnedFactRepository
                .findByCreatedByAndUserDecisionIsNullAndDeletedFalseOrderByCreatedAtDesc(userId)
                .forEach(c -> known.add(normalize(c.getCandidateText())));
        return known;
    }

    private String normalize(String text) {
        return text.trim().toLowerCase().replaceAll("\\s+", " ");
    }
}
