package io.mrkuhne.mezo.feature.companion.service;

import io.mrkuhne.mezo.api.dto.PatternDecisionRequest;
import io.mrkuhne.mezo.api.dto.PatternResponse;
import io.mrkuhne.mezo.feature.companion.HighlightCitationSource;
import io.mrkuhne.mezo.feature.companion.entity.KnowledgeFactEntity;
import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.companion.entity.PatternEventEntity;
import io.mrkuhne.mezo.feature.companion.entity.PatternEventPayloadEnvelope;
import io.mrkuhne.mezo.feature.companion.repository.KnowledgeFactRepository;
import io.mrkuhne.mezo.feature.companion.mapper.CompanionMapper;
import io.mrkuhne.mezo.feature.companion.repository.PatternEventRepository;
import io.mrkuhne.mezo.feature.companion.repository.PatternRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * V3.1 pattern inbox: the list read + the Confirm/Monitor/Reject L2 decision. Unlike fact
 * candidates a pattern is a STANDING judgement — transitions between the three user states are
 * repeatable (a rejected pattern can be re-opened to monitoring, etc.); the nightly job only
 * refreshes {@code proposed}/{@code monitoring} rows.
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class PatternService {

    private static final Map<String, String> DECISION_TO_STATUS = Map.of(
            "confirm", PatternEntity.STATUS_CONFIRMED,
            "monitor", PatternEntity.STATUS_MONITORING,
            "reject", PatternEntity.STATUS_REJECTED);

    private final PatternRepository patternRepository;
    private final KnowledgeFactRepository knowledgeFactRepository;
    private final PatternEventRepository patternEventRepository;
    private final CompanionMapper mapper;
    private final ApplicationEventPublisher eventPublisher;
    /** mezo-d20.7.7 — absent when the proactive switch is off; then the signal is null, not 0. */
    private final ObjectProvider<HighlightCitationSource> citationSource;

    public List<PatternResponse> list(UUID userId) {
        Map<UUID, Integer> cited = citedWeeks(userId);
        return patternRepository.findByCreatedByAndDeletedFalseOrderByLastDetectedAtDesc(userId)
                .stream()
                .map(pattern -> mapper.toPatternResponse(pattern, citedWeeksOf(cited, pattern.getId())))
                .toList();
    }

    /**
     * mezo-d20.7.7 — the weekly review's highlight feedback, read as a SEPARATE signal.
     *
     * <p>A highlight is the companion selecting its own material, not a measurement, so it is
     * deliberately kept out of {@code confidence}: that number is a statistic (Pearson r/n/p, or
     * the V3.2 four-factor critique) and stays NULL for statistical rows on purpose — honest
     * small-n, the FE renders "tanulom". Letting a citation tally fill or raise it would let
     * prose overwrite a statistic, and would make one number mean two incomparable things. A
     * citation likewise never touches {@code status}: promotion is Daniel's judgement (and the
     * one thing the loop must never do on its own).
     *
     * <p>{@code null} when the port is absent (weekly reviews off) — not measurable is not zero.
     */
    private Map<UUID, Integer> citedWeeks(UUID userId) {
        HighlightCitationSource source = citationSource.getIfAvailable();
        return source == null ? null : source.citedWeeks(userId, HighlightCitationSource.KIND_PATTERN);
    }

    private static Integer citedWeeksOf(Map<UUID, Integer> cited, UUID patternId) {
        return cited == null ? null : cited.getOrDefault(patternId, 0);
    }

    @Transactional
    public PatternResponse decide(UUID userId, UUID patternId, PatternDecisionRequest request) {
        PatternEntity pattern = patternRepository.findByIdAndCreatedByAndDeletedFalse(patternId, userId)
                .orElseThrow(() -> new SystemRuntimeErrorException(
                        SystemMessage.error("COMPANION_PATTERN_NOT_FOUND").build(), HttpStatus.NOT_FOUND));
        String status = DECISION_TO_STATUS.get(request.getDecision());
        if (status == null) {
            // unreachable while the contract pattern holds — honest 400 if it ever drifts
            throw new SystemRuntimeErrorException(
                    SystemMessage.field("VALIDATION_INVALID_VALUE", "decision").build());
        }
        pattern.setStatus(status);
        // S1 (mezo-tk88.1): every transition is part of the pattern's durable story — the
        // decision-status event fires on EVERY decide(), not just the first confirm.
        recordEvent(pattern, status, PatternEventPayloadEnvelope.empty());
        // V3.3: the learning loop closes — a FIRST confirm promotes the pattern into a durable
        // knowledge fact (source=pattern, linked back); later un-confirms leave the fact alone
        // (it is Daniel's knowledge now — the Knowledge tab owns its lifecycle). The `promoted`
        // event fires AFTER the decision event — the promotion happens BECAUSE of the decision.
        if (PatternEntity.STATUS_CONFIRMED.equals(status) && pattern.getPromotedFactId() == null) {
            pattern.setPromotedFactId(promote(userId, pattern));
            recordEvent(pattern, PatternEventEntity.KIND_PROMOTED,
                    PatternEventPayloadEnvelope.promoted(pattern.getPromotedFactId()));
        }
        if (PatternEntity.STATUS_CONFIRMED.equals(status)) {
            // W2.2 (mezo-b3pp.7): every confirm re-syncs the graph node; the promotion itself is
            // an idempotent UPSERT, so a re-confirm costs nothing and never duplicates.
            eventPublisher.publishEvent(new PatternConfirmedEvent(userId, pattern.getId()));
        } else {
            // mezo-b3pp.31: the mirror. An un-confirmed pattern must stop asserting itself in the
            // graph — the consumer re-reads the status, so publishing on every non-confirm branch
            // (including a reject that was never confirmed) is safe and keeps the rule simple.
            eventPublisher.publishEvent(new PatternRetractedEvent(userId, pattern.getId()));
        }
        PatternEntity saved = patternRepository.saveAndFlush(pattern);
        return mapper.toPatternResponse(saved, citedWeeksOf(citedWeeks(userId), saved.getId()));
    }

    /** v1 category heuristic: physiology/trigger → health, response → train (documented). */
    private UUID promote(UUID userId, PatternEntity pattern) {
        KnowledgeFactEntity fact = new KnowledgeFactEntity();
        fact.setCreatedBy(userId);
        fact.setFactText(pattern.getTitle());
        fact.setCategory("response".equals(pattern.getCategory()) ? "train" : "health");
        fact.setSource(KnowledgeFactEntity.SOURCE_PATTERN);
        return knowledgeFactRepository.saveAndFlush(fact).getId();
    }

    /** S1 (mezo-tk88.1): the L2 decisions are part of the pattern's durable story. */
    private void recordEvent(PatternEntity pattern, String kind, PatternEventPayloadEnvelope payload) {
        PatternEventEntity event = new PatternEventEntity();
        event.setCreatedBy(pattern.getCreatedBy());
        event.setPatternId(pattern.getId());
        event.setKind(kind);
        event.setOccurredAt(Instant.now());
        event.setPayload(payload);
        patternEventRepository.saveAndFlush(event);
    }
}
