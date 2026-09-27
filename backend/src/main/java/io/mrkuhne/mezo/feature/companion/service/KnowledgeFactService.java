package io.mrkuhne.mezo.feature.companion.service;

import io.mrkuhne.mezo.api.dto.CreateFactRequest;
import io.mrkuhne.mezo.api.dto.KnowledgeFactResponse;
import io.mrkuhne.mezo.api.dto.UpdateFactRequest;
import io.mrkuhne.mezo.feature.auth.service.PromptPersona;
import io.mrkuhne.mezo.feature.companion.HighlightCitationSource;
import io.mrkuhne.mezo.feature.companion.config.CompanionProperties;
import io.mrkuhne.mezo.feature.companion.entity.FactOwner;
import io.mrkuhne.mezo.feature.companion.entity.KnowledgeFactEntity;
import io.mrkuhne.mezo.feature.companion.mapper.CompanionMapper;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryProvenanceEnvelope;
import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.companion.repository.KnowledgeFactRepository;
import io.mrkuhne.mezo.feature.companion.repository.PatternRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
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
import java.util.Collection;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/** V1.1 knowledge facts — CRUD spine + the top-N prompt-injection block (roadmap §V1.1, spec §3 L3). */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class KnowledgeFactService {

    /** The injection block header — appended as a sibling block on every channel (facts-always,
     *  mezo-d6ivw.8). The second line is the passive-use rule (Claude-memory pattern, spec delta
     *  2026-09-27): use naturally when relevant, never enumerate, never cite the remembering. */
    public static final String FACTS_HEADER =
            "\n\nMEGERŐSÍTETT TÉNYEK {{NÉV}} személyéről (legfontosabb elöl):\n"
            + "Ezeket tudod róla korábbról. Használd természetesen, amikor releváns — "
            + "ne sorold fel, és ne hivatkozz arra, hogy \"megjegyezted\".\n";

    /** The V3.3 acknowledgment header — freshly promoted pattern-facts the companion mentions once. */
    public static final String NEW_PATTERN_FACTS_HEADER =
            "\n\nÚJ FELISMERÉSEK (nemrég megerősített minták — említsd meg természetesen, hogy ezt megtanultad):\n";

    /** Deterministic Hungarian labels for the category enum — the snapshot's labelled-block idiom. */
    private static final Map<String, String> CATEGORY_LABELS = Map.of(
            "train", "edzés",
            "fuel", "étkezés",
            "health", "egészség",
            "life", "élet");

    /** Owner → category: the inverse of {@link FactOwner}'s category fallback (szunya is sleep,
     *  which falls back to health). */
    private static final Map<String, String> CATEGORY_BY_OWNER =
            Map.of("mocor", "train", "falat", "fuel", "deru", "health", "szunya", "health", "mezo", "life");

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
            // mezo-plbev item 3: re-derive the owner ONLY when it still carries the OLD
            // category's default (nobody named it explicitly) — an owner the team gave by name
            // (e.g. szunya on a health fact, via the sleep-lexicon backfill or a live producer)
            // must survive a category edit untouched.
            if (fact.getOwner().equals(FactOwner.forCategory(fact.getCategory()))) {
                fact.setOwner(FactOwner.forCategory(request.getCategory()));
            }
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
     * The facts-always injection block (mezo-d6ivw.8): EVERY prompt-included fact, strongest by
     * reinforcement (then newest) first, one Hungarian-labelled line each; "" when the user has
     * no qualifying facts (no empty header).
     *
     * <p>mezo-d20.7.7 — the ONE place the weekly citation signal actually acts, and it acts as a
     * TIE-BREAKER ONLY: {@code reinforcementCount} still decides, citations only order facts the
     * user has confirmed EQUALLY often, and newest-first still breaks the remaining ties. A fact
     * the companion leaned on for four weeks can therefore edge out an equally-confirmed fact
     * nobody has used since it was created — and can never overtake a fact the user actually
     * re-stated more often. That ceiling is the point: a highlight is the model's own selection,
     * so it may only sort what the real signal has already made indistinguishable.
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
     * Facts-always (mezo-d6ivw.8): every enabled fact, strongest first; {@code promptCap} is a
     * safety brake, not a working limit — a trim is WARN-logged so the day the list outgrows the
     * cap is visible (the answer then is consolidation, tracked separately, not rank-and-drop).
     * The citation tie-breaker still orders equal-reinforcement groups when it is measurable.
     */
    private List<KnowledgeFactEntity> topFactsForPrompt(UUID userId) {
        Map<UUID, Integer> cited = citedWeeks(userId);
        Comparator<KnowledgeFactEntity> order = Comparator
                .comparingInt(KnowledgeFactEntity::getReinforcementCount).reversed()
                .thenComparing(Comparator.comparingInt(
                        (KnowledgeFactEntity fact) -> cited == null ? 0 : cited.getOrDefault(fact.getId(), 0)).reversed())
                .thenComparing(Comparator.comparing(
                        KnowledgeFactEntity::getCreatedAt, Comparator.reverseOrder()));
        List<KnowledgeFactEntity> all = repository
                .findByCreatedByAndIncludeInPromptTrueAndDeletedFalseOrderByReinforcementCountDescCreatedAtDesc(
                        userId, Pageable.unpaged())
                .stream()
                .sorted(order)
                .toList();
        int cap = properties.facts().promptCap();
        if (all.size() > cap) {
            log.warn("knowledge_fact prompt-cap trimmed the block: {} enabled facts, cap {} — "
                    + "consolidation is due (facts-always delta, mezo-d6ivw.8)", all.size(), cap);
            return all.subList(0, cap);
        }
        return all;
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

    /**
     * S2 delta (mezo-d6ivw.2, final-review adjudications 2026-09-25): a refuted pattern's
     * promoted fact loses its prompt seat — muted, never deleted, so the Tudástár keeps it
     * visible and re-enableable. Fires the same {@link KnowledgeFactChangedEvent} the manual
     * toggle does, so the graph re-syncs through the one consumer that already reacts to it.
     * Also the S7 team-chat undo ({@link #muteFromTeamChat}).
     *
     * <p>Fail-open: called from {@code companion.reflection.service} (the ArchUnit direction lets
     * reflection import companion.service, never the reverse), where a missing/already-gone fact
     * must never abort the caller's refute transaction — it is logged and the call returns.
     */
    @Transactional
    public void muteFromRefutedPattern(UUID userId, UUID factId) {
        KnowledgeFactEntity fact = repository.findByIdAndCreatedByAndDeletedFalse(factId, userId).orElse(null);
        if (fact == null) {
            log.info("Refute-mutes-fact skipped — fact {} of user {} is already gone", factId, userId);
            return;
        }
        fact.setIncludeInPrompt(false);
        repository.save(fact);
        eventPublisher.publishEvent(new KnowledgeFactChangedEvent(userId, factId));
    }

    /**
     * S7 (mezo-d6ivw.7): the user's own explanation on a csapatfal ügy, remembered as a fact
     * owned by the ügy's character — in every prompt (chat, proactive, csapatfal) from now on.
     * Same precedent as {@code QuestionAnswerService}: the user said it, so no Tudástár accept
     * step. Publishes {@link KnowledgeFactChangedEvent} so the graph syncs through its one
     * consumer.
     */
    @Transactional
    public UUID captureFromTeamChat(UUID userId, String text, String owner, UUID lineId, UUID threadId) {
        KnowledgeFactEntity fact = new KnowledgeFactEntity();
        fact.setCreatedBy(userId);
        fact.setFactText(text);
        fact.setOwner(FactOwner.OWNERS.contains(owner) ? owner : "mezo");
        fact.setCategory(CATEGORY_BY_OWNER.getOrDefault(fact.getOwner(), "life"));
        fact.setSource(KnowledgeFactEntity.SOURCE_TEAM_CHAT);
        fact.setLastReinforcedAt(Instant.now());
        fact.setProvenance(MemoryProvenanceEnvelope.teamChat(lineId, threadId));
        KnowledgeFactEntity saved = repository.saveAndFlush(fact);
        eventPublisher.publishEvent(new KnowledgeFactChangedEvent(userId, saved.getId()));
        return saved.getId();
    }

    /** S7 (mezo-d6ivw.7): undo / "Nem, figyelj rá" on a captured csapatfal fact — the S2
     *  mute-not-delete idiom, fail-open on an unknown id. */
    @Transactional
    public void muteFromTeamChat(UUID userId, UUID factId) {
        muteFromRefutedPattern(userId, factId);
    }

    /**
     * S7 (mezo-d6ivw.7): the csapatfal knowledge block — active, in-prompt, non-superseded facts
     * of the given owners, strongest first, rendered as plain sentences (no category label —
     * the character voice supplies its own framing).
     */
    @Transactional(readOnly = true)
    public List<String> promptFactsForOwners(UUID userId, List<String> owners, int limit) {
        return repository
                .findByCreatedByAndOwnerInAndIncludeInPromptTrueAndSupersededByIsNullAndDeletedFalseOrderByReinforcementCountDescCreatedAtDesc(
                        userId, owners, PageRequest.of(0, limit))
                .stream()
                .map(KnowledgeFactEntity::getFactText)
                .toList();
    }

    /**
     * S7 (mezo-d6ivw.7): the subset of {@code factIds} that still exist and are still in the
     * prompt (not deleted, not muted in the Tudástár) — a remembered csapatfal exception is only
     * live while its fact is. Read-only; unknown or foreign ids are simply absent.
     */
    @Transactional(readOnly = true)
    public Set<UUID> liveInPrompt(UUID userId, Collection<UUID> factIds) {
        if (factIds == null || factIds.isEmpty()) {
            return Set.of();
        }
        return repository.findByIdInAndCreatedByAndIncludeInPromptTrueAndDeletedFalse(factIds, userId).stream()
                .map(KnowledgeFactEntity::getId)
                .collect(Collectors.toUnmodifiableSet());
    }

    private KnowledgeFactEntity getOwned(UUID userId, UUID factId) {
        return repository.findByIdAndCreatedByAndDeletedFalse(factId, userId)
                .orElseThrow(() -> new SystemRuntimeErrorException(
                        SystemMessage.error("RESOURCE_NOT_FOUND").build(), HttpStatus.NOT_FOUND));
    }
}
