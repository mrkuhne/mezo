package io.mrkuhne.mezo.feature.companion.service;

import io.mrkuhne.mezo.api.dto.FactCandidateResponse;
import io.mrkuhne.mezo.api.dto.FactDecisionRequest;
import io.mrkuhne.mezo.feature.companion.entity.KnowledgeFactEntity;
import io.mrkuhne.mezo.feature.companion.entity.LearnedFactEntity;
import io.mrkuhne.mezo.feature.companion.mapper.CompanionMapper;
import io.mrkuhne.mezo.feature.companion.repository.KnowledgeFactRepository;
import io.mrkuhne.mezo.feature.companion.repository.LearnedFactRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * The V1.2 pending inbox + the accept/refine/reject decision. Confirm is an explicit L2 action
 * (IDENT-6) — accept/refine promote the candidate into a {@code knowledge_fact} whose source is
 * INHERITED from the candidate (chat extraction ⇒ 'chat', weekly review ⇒ 'weekly_review'),
 * which the V1.1 top-N injection then carries into every prompt. One decision per candidate.
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.COMPANION_SWITCH, havingValue = "true")
public class FactCandidateService {

    private final LearnedFactRepository learnedFactRepository;
    private final KnowledgeFactRepository knowledgeFactRepository;
    private final CompanionMapper mapper;
    private final ApplicationEventPublisher eventPublisher;
    private final ForgetService forgetService;

    public List<FactCandidateResponse> listPending(UUID userId) {
        return learnedFactRepository
                .findPendingVisible(userId, Instant.now())
                .stream()
                .map(candidate -> toResponse(userId, candidate))
                .toList();
    }

    @Transactional
    public FactCandidateResponse decide(UUID userId, UUID candidateId, FactDecisionRequest request) {
        LearnedFactEntity candidate = getOwned(userId, candidateId);
        if (candidate.getUserDecision() != null) {
            throw new SystemRuntimeErrorException(
                    SystemMessage.error("COMPANION_CANDIDATE_ALREADY_DECIDED").build());
        }
        String decision = request.getDecision().getValue();
        if (LearnedFactEntity.DECISION_SNOOZE.equals(decision)) {
            // „Most ne” (U9b): not a decision — the candidate stays open and returns in 14 days.
            candidate.setSnoozedUntil(Instant.now().plus(CandidateSnooze.DURATION));
            return mapper.toFactCandidateResponse(learnedFactRepository.saveAndFlush(candidate));
        }
        boolean isMerge = LearnedFactEntity.SOURCE_MERGE.equals(candidate.getSource());
        switch (decision) {
            case LearnedFactEntity.DECISION_ACCEPT ->
                    candidate.setPromotedFactId(promoteDecision(userId, candidate.getCandidateText(), candidate));
            case LearnedFactEntity.DECISION_REFINE -> {
                if (request.getRefinedText() == null || request.getRefinedText().isBlank()) {
                    throw new SystemRuntimeErrorException(
                            SystemMessage.field("VALIDATION_REQUIRED_FIELD", "refinedText").build());
                }
                candidate.setRefinedText(request.getRefinedText());
                candidate.setPromotedFactId(promoteDecision(userId, request.getRefinedText(), candidate));
            }
            // S8 (mezo-d6ivw.12): "Ne" is permanent — chat chip AND inbox. The extractor's veto
            // check (FactExtractionService) then never re-proposes the same text. S9: a merge
            // proposal's „Maradjon külön" is not a forget — the member facts stand exactly as
            // they were, so no veto row and the members are left untouched.
            case LearnedFactEntity.DECISION_REJECT -> {
                if (!isMerge) {
                    forgetService.vetoFactText(userId, candidate.getCandidateText());
                }
            }
            default -> throw new SystemRuntimeErrorException(
                    SystemMessage.field("VALIDATION_INVALID_VALUE", "decision").build());
        }
        candidate.setUserDecision(decision);
        if (candidate.getPromotedFactId() != null) {
            // W2.2 (mezo-b3pp.7): accept/refine just minted (or re-confirmed) a knowledge_fact —
            // promote it into a PREFERENCE node. Reject never sets promotedFactId, so no event fires.
            eventPublisher.publishEvent(new KnowledgeFactPromotedEvent(userId, candidate.getPromotedFactId()));
        }
        return toResponse(userId, learnedFactRepository.saveAndFlush(candidate));
    }

    /** S9 (mezo-d6ivw.10): a merge candidate's {@code mergeSources} are the member facts' CURRENT
     *  texts, resolved live (never cached on the candidate) — owner-checked, order preserved by
     *  {@code mergeMemberIds}, a member the owner since deleted is simply skipped. */
    private FactCandidateResponse toResponse(UUID userId, LearnedFactEntity candidate) {
        if (!LearnedFactEntity.SOURCE_MERGE.equals(candidate.getSource()) || candidate.getMergeMemberIds() == null) {
            return mapper.toFactCandidateResponse(candidate);
        }
        List<KnowledgeFactEntity> members = knowledgeFactRepository.findAllById(candidate.getMergeMemberIds());
        List<String> mergeSources = candidate.getMergeMemberIds().stream()
                .flatMap(id -> members.stream()
                        .filter(m -> m.getId().equals(id) && userId.equals(m.getCreatedBy())))
                .map(KnowledgeFactEntity::getFactText)
                .toList();
        return mapper.toFactCandidateResponse(candidate, mergeSources);
    }

    /** Accept/refine on an ordinary candidate just mints the fact. On a merge candidate (S9,
     *  mezo-d6ivw.10) it mints the fact REGARDLESS — the user asked for this sentence — with the
     *  live members' reinforcement folded in, then mutes those still-live members onto it. A
     *  member muted meanwhile (e.g. by the auto-merge sweep) is left exactly as it is. */
    private UUID promoteDecision(UUID userId, String factText, LearnedFactEntity candidate) {
        if (!LearnedFactEntity.SOURCE_MERGE.equals(candidate.getSource())) {
            return promote(userId, factText, candidate, 0);
        }
        List<KnowledgeFactEntity> liveMembers = liveMergeMembers(userId, candidate);
        int reinforcement = liveMembers.stream().mapToInt(KnowledgeFactEntity::getReinforcementCount).sum();
        UUID newFactId = promote(userId, factText, candidate, reinforcement);
        Instant now = Instant.now();
        for (KnowledgeFactEntity member : liveMembers) {
            member.mute(KnowledgeFactEntity.MUTED_MERGED, now);
            member.setSupersededBy(newFactId);
            knowledgeFactRepository.save(member);
            eventPublisher.publishEvent(new KnowledgeFactChangedEvent(userId, member.getId()));
        }
        return newFactId;
    }

    /** The still-live merge members (still in the prompt, not already superseded) — owner-checked,
     *  a member the user or another merge already touched since is simply skipped. */
    private List<KnowledgeFactEntity> liveMergeMembers(UUID userId, LearnedFactEntity candidate) {
        if (candidate.getMergeMemberIds() == null) {
            return List.of();
        }
        return knowledgeFactRepository.findAllById(candidate.getMergeMemberIds()).stream()
                .filter(m -> userId.equals(m.getCreatedBy()))
                .filter(m -> m.isIncludeInPrompt() && m.getSupersededBy() == null)
                .toList();
    }

    private UUID promote(UUID userId, String factText, LearnedFactEntity candidate, int reinforcementCount) {
        KnowledgeFactEntity fact = new KnowledgeFactEntity();
        fact.setCreatedBy(userId);
        fact.setFactText(factText);
        fact.setCategory(candidate.getCategory());
        fact.setSource(sourceOf(candidate));
        fact.setOwner(candidate.getOwner());
        fact.setReinforcementCount(reinforcementCount);
        return knowledgeFactRepository.saveAndFlush(fact).getId();
    }

    /** The promoted fact inherits the CANDIDATE's provenance (mezo-d20.7.6) — hardcoding 'chat'
     *  would make an accepted weekly lesson lie about where it came from. S9: a merge proposal
     *  promotes as 'merge', never 'chat'. */
    private static String sourceOf(LearnedFactEntity candidate) {
        if (LearnedFactEntity.SOURCE_MERGE.equals(candidate.getSource())) {
            return KnowledgeFactEntity.SOURCE_MERGE;
        }
        return LearnedFactEntity.SOURCE_WEEKLY_REVIEW.equals(candidate.getSource())
                ? KnowledgeFactEntity.SOURCE_WEEKLY_REVIEW
                : KnowledgeFactEntity.SOURCE_CHAT;
    }

    private LearnedFactEntity getOwned(UUID userId, UUID candidateId) {
        return learnedFactRepository.findByIdAndCreatedByAndDeletedFalse(candidateId, userId)
                .orElseThrow(() -> new SystemRuntimeErrorException(
                        SystemMessage.error("RESOURCE_NOT_FOUND").build(), HttpStatus.NOT_FOUND));
    }
}
