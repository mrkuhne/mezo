package io.mrkuhne.mezo.feature.companion.service;

import io.mrkuhne.mezo.api.dto.CreateFactRequest;
import io.mrkuhne.mezo.api.dto.KnowledgeFactResponse;
import io.mrkuhne.mezo.api.dto.UpdateFactRequest;
import io.mrkuhne.mezo.feature.auth.service.PromptPersona;
import io.mrkuhne.mezo.feature.companion.HighlightCitationSource;
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
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Comparator;
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
    public static final String FACTS_HEADER = "\n\nMEGERŐSÍTETT TÉNYEK {{NÉV}} személyéről (legfontosabb elöl):\n";

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
    private final ApplicationEventPublisher eventPublisher;
    /** mezo-d20.7.7 — absent when the proactive switch is off; then the signal is null, not 0. */
    private final ObjectProvider<HighlightCitationSource> citationSource;
    private final PromptPersona promptPersona;

    public List<KnowledgeFactResponse> list(UUID userId) {
        // V3.3 evidence link: pattern-sourced facts carry their promoting pattern's title
        Map<UUID, String> patternTitleByFactId = patternRepository
                .findByCreatedByAndPromotedFactIdIsNotNullAndDeletedFalse(userId).stream()
                .collect(Collectors.toMap(PatternEntity::getPromotedFactId, PatternEntity::getTitle,
                        (first, second) -> first));
        Map<UUID, Integer> cited = citedWeeks(userId);
        return repository.findByCreatedByAndDeletedFalseOrderByReinforcementCountDescCreatedAtDesc(userId)
                .stream()
                .map(fact -> mapper.toKnowledgeFactResponse(
                        fact, patternTitleByFactId.get(fact.getId()), citedWeeksOf(cited, fact.getId())))
                .toList();
    }

    /**
     * mezo-d20.7.7 — the weekly review's highlight feedback for facts, read as a SEPARATE signal.
     *
     * <p>{@code reinforcementCount} is deliberately NOT widened to cover it. That field means "the
     * user re-stated/re-confirmed this fact"; the companion citing its own knowledge in its own
     * weekly write-up is not a re-confirmation, it is the same claim coming back around. Folding
     * one into the other would let the model inflate its own evidence — the same call
     * {@code WeeklyLessonService} made when it refused to reinforce on a weekly duplicate
     * (mezo-d20.7.6). {@code null} when the port is absent — not measurable is not zero.
     */
    private Map<UUID, Integer> citedWeeks(UUID userId) {
        HighlightCitationSource source = citationSource.getIfAvailable();
        return source == null ? null : source.citedWeeks(userId, HighlightCitationSource.KIND_FACT);
    }

    private static Integer citedWeeksOf(Map<UUID, Integer> cited, UUID factId) {
        return cited == null ? null : cited.getOrDefault(factId, 0);
    }

    @Transactional
    public KnowledgeFactResponse create(UUID userId, CreateFactRequest request) {
        KnowledgeFactEntity fact = new KnowledgeFactEntity();
        fact.setCreatedBy(userId);
        fact.setFactText(request.getFactText());
        fact.setCategory(request.getCategory());
        fact.setSource(KnowledgeFactEntity.SOURCE_MANUAL);
        // saveAndFlush so @CreationTimestamp is populated before mapping
        KnowledgeFactEntity saved = repository.saveAndFlush(fact);
        // a just-created fact has no citations yet — but 0 and "not measurable" are still
        // different answers, so the port decides which one this is
        return mapper.toKnowledgeFactResponse(saved, null, citedWeeksOf(citedWeeks(userId), saved.getId()));
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
        // mezo-b3pp.30: include_in_prompt is the user's kill-switch for EVERY injection channel,
        // and the knowledge graph is one of them — GraphPromptAssembler renders traversed nodes
        // into the same system prompt this fact's own block writes into. Published on every
        // update, unconditionally: the consumer re-derives whether the fact still qualifies, and
        // this service must not learn about the graph switch (with the graph off, no bean
        // consumes this).
        eventPublisher.publishEvent(new KnowledgeFactChangedEvent(userId, factId));
        return mapper.toKnowledgeFactResponse(
                repository.save(fact), null, citedWeeksOf(citedWeeks(userId), factId));
    }

    /**
     * The V1.1 injection block: top-N prompt-included facts by reinforcement (then newest),
     * one Hungarian-labelled line each; "" when the user has no qualifying facts (no empty header).
     *
     * <p>mezo-d20.7.7 — the ONE place the weekly citation signal actually acts, and it acts as a
     * TIE-BREAKER ONLY: {@code reinforcementCount} still decides, citations only order facts the
     * user has confirmed EQUALLY often, and newest-first still breaks the remaining ties. A fact
     * the companion leaned on for four weeks can therefore edge out an equally-confirmed fact
     * nobody has used since it was created — and can never overtake a fact the user actually
     * re-stated more often. That ceiling is the point: a highlight is the model's own selection,
     * so it may only sort what the real signal has already made indistinguishable.
     *
     * <p>When the citation port is absent the ORIGINAL paged query runs untouched — no behaviour
     * change and no extra cost with the weekly feature off.
     */
    public String renderPromptBlock(UUID userId) {
        List<KnowledgeFactEntity> facts = topFactsForPrompt(userId);
        if (facts.isEmpty()) {
            return "";
        }
        StringBuilder block = new StringBuilder(promptPersona.render(userId, FACTS_HEADER));
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
     * The prompt's top-N, with the citation tie-breaker applied when it is measurable.
     *
     * <p>The tie-break cannot be pushed into the paged query, and re-sorting a page would be
     * wrong: an equal-reinforcement group routinely STRADDLES the top-N cut, so a cited fact just
     * below the line has to be able to rise across it. Hence the unpaged read + in-memory sort —
     * L3 facts are a curated, small set (the list endpoint already reads all of them unpaged), and
     * {@code includeInPrompt} narrows it further.
     */
    private List<KnowledgeFactEntity> topFactsForPrompt(UUID userId) {
        Map<UUID, Integer> cited = citedWeeks(userId);
        if (cited == null) {
            return repository
                    .findByCreatedByAndIncludeInPromptTrueAndDeletedFalseOrderByReinforcementCountDescCreatedAtDesc(
                            userId, PageRequest.of(0, properties.facts().topN()));
        }
        return repository
                .findByCreatedByAndIncludeInPromptTrueAndDeletedFalseOrderByReinforcementCountDescCreatedAtDesc(
                        userId, Pageable.unpaged())
                .stream()
                .sorted(Comparator
                        .comparingInt(KnowledgeFactEntity::getReinforcementCount).reversed()
                        .thenComparing(Comparator.comparingInt(
                                (KnowledgeFactEntity fact) -> cited.getOrDefault(fact.getId(), 0)).reversed())
                        .thenComparing(Comparator.comparing(
                                KnowledgeFactEntity::getCreatedAt, Comparator.reverseOrder())))
                .limit(properties.facts().topN())
                .toList();
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
