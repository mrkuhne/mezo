package io.mrkuhne.mezo.feature.character.service;

import io.mrkuhne.mezo.feature.auth.entity.AppUserEntity;
import io.mrkuhne.mezo.feature.character.entity.CharacterReplyEntity;
import io.mrkuhne.mezo.feature.character.repository.CharacterClaimRepository;
import io.mrkuhne.mezo.feature.character.repository.CharacterDimensionRepository;
import io.mrkuhne.mezo.feature.character.repository.CharacterReplyRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;

import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;

import lombok.RequiredArgsConstructor;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

/**
 * Short persisted lease + atomic lifecycle/portrait/outcome commit; a stale worker cannot apply
 * twice.
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.CHARACTER_SWITCH, havingValue = "true")
public class CharacterReplyProcessing {
    private final CharacterReplyRepository replies;
    private final CharacterFollowupService followups;
    private final io.mrkuhne.mezo.feature.character.config.CharacterCouncilProperties councilProperties;
    private final CharacterMutationLock mutationLock;
    private final EntityManager entityManager;
    private final ApplicationEventPublisher events;
    private final CharacterDimensionRepository dimensions;
    private final CharacterClaimRepository claims;
    private final ObjectProvider<ClaimLifecycle> lifecycle;
    private final ObjectProvider<PortraitWriter> portraits;

    @Transactional
    public CharacterReplyEntity claim(UUID owner, UUID id) {
        mutationLock.lock(owner);
        entityManager.find(AppUserEntity.class, owner, LockModeType.PESSIMISTIC_WRITE);
        var r = replies.lockOwned(id, owner).orElse(null);
        if (r == null || !"SAVED".equals(r.getStatus())) return null;
        var thread =
                replies.findByCreatedByAndSourceTypeAndSourceIdAndSourceIndexOrderByCreatedAtAsc(
                        owner, r.getSourceType(), r.getSourceId(), r.getSourceIndex());
        var earlier = thread.stream().takeWhile(previous -> !previous.getId().equals(id)).toList();
        if (earlier.stream()
                .anyMatch(
                        previous -> List.of("SAVED", "PROCESSING").contains(previous.getStatus())))
            return null;
        if (r.getClaimId() == null) {
            earlier.reversed().stream()
                    .filter(previous -> previous.getClaimId() != null)
                    .findFirst()
                    .ifPresent(previous -> r.setClaimId(previous.getClaimId()));
        }
        r.setStatus("PROCESSING");
        r.setProcessingStartedAt(Instant.now());
        r.setProcessingToken(UUID.randomUUID());
        return r;
    }

    @Transactional
    public void failed(UUID owner, UUID id, UUID token) {
        mutationLock.lock(owner);
        replies.lockOwned(id, owner)
                .filter(
                        r ->
                                token.equals(r.getProcessingToken())
                                        && "PROCESSING".equals(r.getStatus()))
                .ifPresent(
                        r -> {
                            r.setStatus("FAILED");
                            r.setOutcomeText(
                                    "A válaszod elmentettük, de a feldolgozás most nem sikerült."
                                            + " Újrapróbálhatod.");
                            requestNext(r);
                        });
    }

    @Transactional
    public void complete(
            CharacterReplyEntity leased, CharacterReplyEvaluation.Evaluation evaluation) {
        mutationLock.lock(leased.getCreatedBy());
        var r = replies.lockOwned(leased.getId(), leased.getCreatedBy()).orElseThrow();
        entityManager.refresh(r, LockModeType.PESSIMISTIC_WRITE);
        if (!leased.getProcessingToken().equals(r.getProcessingToken())
                || !"PROCESSING".equals(r.getStatus())) return;
        var verdict = evaluation.verdict();
        if (r.getClaimId() != null) {
            var target = claims.lockOwned(r.getClaimId(), r.getCreatedBy()).orElseThrow();
            entityManager.refresh(target, LockModeType.PESSIMISTIC_WRITE);
            if (!Objects.equals(target.getText(), evaluation.expectedClaimText())
                    || !Objects.equals(target.getStatus(), evaluation.expectedClaimStatus())
                    || !Objects.equals(target.getUpdatedAt(), evaluation.expectedClaimUpdatedAt()))
                throw new SystemRuntimeErrorException(
                        SystemMessage.error("CHARACTER_REPLY_SOURCE_CHANGED").build());
        }
        if ("UPDATED".equals(verdict.outcome()) || "WITHDRAWN".equals(verdict.outcome())) {
            lifecycle.getObject().applyReply(r, verdict);
            var dim =
                    dimensions
                            .findByCreatedByAndKey(r.getCreatedBy(), r.getDimensionKey())
                            .orElseThrow();
            var active =
                    claims.findByCreatedByAndDimensionIdAndStatusOrderByConfidenceDesc(
                            r.getCreatedBy(), dim.getId(), "ACTIVE");
            if (!portraits.getObject().rewriteForReply(r.getCreatedBy(), dim, active, r.getId()))
                throw new SystemRuntimeErrorException(
                        SystemMessage.error("CHARACTER_REPLY_PORTRAIT_UNAVAILABLE").build());
        }
        if ("CONFERENCE_ITEM".equals(r.getSourceType()) && !"NEEDS_CLARIFICATION".equals(verdict.outcome())) {
            followups.closeAnswered(r.getCreatedBy(), r.getSourceId(), r.getSourceIndex(),
                    java.time.LocalDate.now(java.time.ZoneId.of(councilProperties.zone())));
        }
        r.setOutcome(verdict.outcome());
        r.setDiscussion(evaluation.discussion());
        r.setOutcomeText(verdict.reason());
        r.setStatus(
                "NEEDS_CLARIFICATION".equals(verdict.outcome())
                        ? "NEEDS_CLARIFICATION"
                        : "COMPLETED");
        requestNext(r);
    }

    private void requestNext(CharacterReplyEntity finished) {
        replies
                .findByCreatedByAndSourceTypeAndSourceIdAndSourceIndexOrderByCreatedAtAsc(
                        finished.getCreatedBy(),
                        finished.getSourceType(),
                        finished.getSourceId(),
                        finished.getSourceIndex())
                .stream()
                .filter(next -> "SAVED".equals(next.getStatus()))
                .findFirst()
                .ifPresent(
                        next ->
                                events.publishEvent(
                                        new CharacterReplyService.Requested(
                                                next.getCreatedBy(), next.getId())));
    }
}
