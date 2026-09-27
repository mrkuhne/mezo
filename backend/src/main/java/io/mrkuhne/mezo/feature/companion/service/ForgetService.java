package io.mrkuhne.mezo.feature.companion.service;

import io.mrkuhne.mezo.feature.companion.entity.KnowledgeFactEntity;
import io.mrkuhne.mezo.feature.companion.entity.MemoryForgetVetoEntity;
import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.companion.repository.KnowledgeFactRepository;
import io.mrkuhne.mezo.feature.companion.repository.MemoryForgetVetoRepository;
import io.mrkuhne.mezo.feature.companion.repository.PatternRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * S6 (mezo-d6ivw.6): the ONE place "Elfelejtem" happens. A forget is permanent — there is no
 * restore endpoint; the FE's ~5 s undo toast sends the request only when it expires.
 *
 * <p>A fact forget soft-deletes the row and vetoes its normalized text, so no text-minting writer
 * re-proposes it. A pattern-sourced fact is the same knowledge as its observation, so both go:
 * the pattern moves to {@code forgotten} (the publisher keeps it closed for good) and its id is
 * vetoed (promotion never re-mints it). Every consumer re-derives from the rows through the
 * already-wired events — graph archives the node, prompt channels simply stop seeing it.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class ForgetService {

    private final KnowledgeFactRepository factRepository;
    private final PatternRepository patternRepository;
    private final MemoryForgetVetoRepository vetoRepository;
    private final ApplicationEventPublisher eventPublisher;

    @Transactional
    public void forgetFact(UUID userId, UUID factId) {
        KnowledgeFactEntity fact = factRepository.findByIdAndCreatedByAndDeletedFalse(factId, userId)
                .orElseThrow(() -> new SystemRuntimeErrorException(
                        SystemMessage.error("RESOURCE_NOT_FOUND").build(), HttpStatus.NOT_FOUND));
        Optional<PatternEntity> source = sourcePattern(userId, fact);
        deleteAndVeto(userId, fact);
        source.ifPresent(pattern -> forgetPatternRow(userId, pattern));
    }

    /** "Elfelejtem" on an observation row: its learned fact (if any) goes with its text vetoed,
     *  and the row itself becomes {@code forgotten} + pattern-vetoed, so it is never shown or
     *  promoted again. Only reflection-owned rows are the user's to forget — statistical rows
     *  are recomputed nightly and have no Tudástár presence. */
    @Transactional
    public void forgetObservation(UUID userId, UUID patternId) {
        PatternEntity pattern = patternRepository.findByIdAndCreatedByAndDeletedFalse(patternId, userId)
                .filter(PatternEntity::isReflectionOwned)
                .filter(p -> !p.isForgotten())
                .orElseThrow(() -> new SystemRuntimeErrorException(
                        SystemMessage.error("COMPANION_PATTERN_NOT_FOUND").build(), HttpStatus.NOT_FOUND));
        if (pattern.getPromotedFactId() != null) {
            factRepository.findByIdAndCreatedByAndDeletedFalse(pattern.getPromotedFactId(), userId)
                    .ifPresent(fact -> deleteAndVeto(userId, fact));
        }
        forgetPatternRow(userId, pattern);
    }

    private Optional<PatternEntity> sourcePattern(UUID userId, KnowledgeFactEntity fact) {
        UUID viaEnvelope = fact.getProvenance() == null ? null : fact.getProvenance().patternId();
        if (viaEnvelope != null) {
            Optional<PatternEntity> row = patternRepository.findByIdAndCreatedByAndDeletedFalse(viaEnvelope, userId);
            if (row.isPresent()) return row;
        }
        // pre-S2 promotions carry no envelope — the loose back-reference still finds them
        return patternRepository.findByCreatedByAndPromotedFactIdIsNotNullAndDeletedFalse(userId).stream()
                .filter(p -> fact.getId().equals(p.getPromotedFactId()))
                .findFirst();
    }

    void deleteAndVeto(UUID userId, KnowledgeFactEntity fact) {
        veto(userId, MemoryForgetVetoEntity.DOMAIN_FACT_TEXT,
                MemoryForgetVetoEntity.normalizeFactText(fact.getFactText()));
        factRepository.delete(fact); // @SQLDelete → soft delete
        eventPublisher.publishEvent(new KnowledgeFactChangedEvent(userId, fact.getId()));
    }

    void forgetPatternRow(UUID userId, PatternEntity pattern) {
        veto(userId, MemoryForgetVetoEntity.DOMAIN_PATTERN, pattern.getId().toString());
        pattern.setStatus(PatternEntity.STATUS_FORGOTTEN);
        patternRepository.save(pattern);
        // an open drift card about a forgotten claim must not ask about it any more
        patternRepository.findByCreatedByAndKindAndPairKeyAndDeletedFalse(userId, PatternEntity.KIND_REFLECTION,
                        PatternEntity.PAIR_KEY_DRIFT_PREFIX + pattern.getId())
                .filter(drift -> !drift.isUserFrozen())
                .ifPresent(drift -> {
                    drift.setStatus(PatternEntity.STATUS_FORGOTTEN);
                    patternRepository.save(drift);
                });
        eventPublisher.publishEvent(new PatternRetractedEvent(userId, pattern.getId()));
    }

    private void veto(UUID userId, String domain, String key) {
        if (vetoRepository.existsByCreatedByAndDomainAndVetoKeyAndDeletedFalse(userId, domain, key)) return;
        MemoryForgetVetoEntity veto = new MemoryForgetVetoEntity();
        veto.setCreatedBy(userId);
        veto.setDomain(domain);
        veto.setVetoKey(key.length() > 500 ? key.substring(0, 500) : key);
        vetoRepository.save(veto);
    }
}
