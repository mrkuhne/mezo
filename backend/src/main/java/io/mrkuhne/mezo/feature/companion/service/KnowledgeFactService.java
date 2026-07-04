package io.mrkuhne.mezo.feature.companion.service;

import io.mrkuhne.mezo.api.dto.CreateFactRequest;
import io.mrkuhne.mezo.api.dto.KnowledgeFactResponse;
import io.mrkuhne.mezo.api.dto.UpdateFactRequest;
import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import io.mrkuhne.mezo.feature.companion.entity.KnowledgeFactEntity;
import io.mrkuhne.mezo.feature.companion.mapper.CompanionMapper;
import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.companion.repository.KnowledgeFactRepository;
import io.mrkuhne.mezo.feature.companion.repository.PatternRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

/** V1.1 knowledge facts — CRUD spine + the top-N prompt-injection block (roadmap §V1.1, spec §3 L3). */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class KnowledgeFactService {

    /** The injection block header — ChatService inserts it between the context snapshot and the history. */
    public static final String FACTS_HEADER = "\n\nMEGERŐSÍTETT TÉNYEK Danielről (legfontosabb elöl):\n";

    /** The V3.3 acknowledgment header — freshly promoted pattern-facts the companion mentions once. */
    public static final String NEW_PATTERN_FACTS_HEADER =
            "\n\nÚJ FELISMERÉSEK (nemrég megerősített minták — említsd meg természetesen, hogy ezt megtanultad):\n";

    /** Deterministic Hungarian labels for the category enum — the snapshot's labelled-block idiom. */
    private static final Map<String, String> CATEGORY_LABELS = Map.of(
            "train", "edzés",
            "fuel", "étkezés",
            "health", "egészség",
            "life", "élet");

    private final KnowledgeFactRepository repository;
    private final PatternRepository patternRepository;
    private final CompanionProperties properties;
    private final CompanionMapper mapper;

    public List<KnowledgeFactResponse> list(UUID userId) {
        // V3.3 evidence link: pattern-sourced facts carry their promoting pattern's title
        Map<UUID, String> patternTitleByFactId = patternRepository
                .findByCreatedByAndPromotedFactIdIsNotNullAndDeletedFalse(userId).stream()
                .collect(Collectors.toMap(PatternEntity::getPromotedFactId, PatternEntity::getTitle,
                        (first, second) -> first));
        return repository.findByCreatedByAndDeletedFalseOrderByReinforcementCountDescCreatedAtDesc(userId)
                .stream()
                .map(fact -> mapper.toKnowledgeFactResponse(fact, patternTitleByFactId.get(fact.getId())))
                .toList();
    }

    @Transactional
    public KnowledgeFactResponse create(UUID userId, CreateFactRequest request) {
        KnowledgeFactEntity fact = new KnowledgeFactEntity();
        fact.setCreatedBy(userId);
        fact.setFactText(request.getFactText());
        fact.setCategory(request.getCategory());
        fact.setSource(KnowledgeFactEntity.SOURCE_MANUAL);
        // saveAndFlush so @CreationTimestamp is populated before mapping
        return mapper.toKnowledgeFactResponse(repository.saveAndFlush(fact));
    }

    /** Partial update — only the provided fields are applied (contract: UpdateFactRequest). */
    @Transactional
    public KnowledgeFactResponse update(UUID userId, UUID factId, UpdateFactRequest request) {
        KnowledgeFactEntity fact = getOwned(userId, factId);
        if (request.getFactText() != null) {
            fact.setFactText(request.getFactText());
        }
        if (request.getCategory() != null) {
            fact.setCategory(request.getCategory());
        }
        if (request.getIncludeInPrompt() != null) {
            fact.setIncludeInPrompt(request.getIncludeInPrompt());
        }
        return mapper.toKnowledgeFactResponse(repository.save(fact));
    }

    /**
     * The V1.1 injection block: top-N prompt-included facts by reinforcement (then newest),
     * one Hungarian-labelled line each; "" when the user has no qualifying facts (no empty header).
     */
    public String renderPromptBlock(UUID userId) {
        List<KnowledgeFactEntity> facts = repository
                .findByCreatedByAndIncludeInPromptTrueAndDeletedFalseOrderByReinforcementCountDescCreatedAtDesc(
                        userId, PageRequest.of(0, properties.facts().topN()));
        if (facts.isEmpty()) {
            return "";
        }
        StringBuilder block = new StringBuilder(FACTS_HEADER);
        for (KnowledgeFactEntity fact : facts) {
            block.append("- (")
                    .append(CATEGORY_LABELS.getOrDefault(fact.getCategory(), fact.getCategory()))
                    .append(") ")
                    .append(fact.getFactText())
                    .append('\n');
        }
        return block.toString();
    }

    /**
     * The V3.3 acknowledgment block: pattern-facts promoted in the last {@code pattern-ack-days},
     * so the companion can say "ezt megtanultam rólad" on the next conversation; "" when none.
     */
    public String renderNewPatternFactsBlock(UUID userId) {
        int ackDays = properties.facts().patternAckDays();
        if (ackDays == 0) {
            return "";
        }
        // include_in_prompt is the user's kill-switch for EVERY injection channel — a toggled-off
        // fact must never be announced either (review finding)
        List<KnowledgeFactEntity> fresh = repository
                .findByCreatedByAndSourceAndIncludeInPromptTrueAndCreatedAtGreaterThanEqualAndDeletedFalseOrderByCreatedAtDesc(
                        userId, KnowledgeFactEntity.SOURCE_PATTERN,
                        Instant.now().minus(ackDays, ChronoUnit.DAYS));
        if (fresh.isEmpty()) {
            return "";
        }
        StringBuilder block = new StringBuilder(NEW_PATTERN_FACTS_HEADER);
        for (KnowledgeFactEntity fact : fresh) {
            block.append("- ").append(fact.getFactText()).append('\n');
        }
        return block.toString();
    }

    private KnowledgeFactEntity getOwned(UUID userId, UUID factId) {
        return repository.findByIdAndCreatedByAndDeletedFalse(factId, userId)
                .orElseThrow(() -> new SystemRuntimeErrorException(
                        SystemMessage.error("RESOURCE_NOT_FOUND").build(), HttpStatus.NOT_FOUND));
    }
}
