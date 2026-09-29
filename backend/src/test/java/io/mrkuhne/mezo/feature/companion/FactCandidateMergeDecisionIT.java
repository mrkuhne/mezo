package io.mrkuhne.mezo.feature.companion;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.FactCandidateResponse;
import io.mrkuhne.mezo.api.dto.FactDecisionRequest;
import io.mrkuhne.mezo.feature.appnotification.repository.AppNotificationRepository;
import io.mrkuhne.mezo.feature.companion.entity.KnowledgeFactEntity;
import io.mrkuhne.mezo.feature.companion.entity.LearnedFactEntity;
import io.mrkuhne.mezo.feature.companion.entity.MemoryForgetVetoEntity;
import io.mrkuhne.mezo.feature.companion.repository.KnowledgeFactRepository;
import io.mrkuhne.mezo.feature.companion.repository.LearnedFactRepository;
import io.mrkuhne.mezo.feature.companion.repository.MemoryForgetVetoRepository;
import io.mrkuhne.mezo.feature.companion.service.FactCandidateService;
import io.mrkuhne.mezo.feature.companion.service.FactExtractionService;
import io.mrkuhne.mezo.feature.companion.service.KnowledgeFactPromotedEvent;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.KnowledgeFactPopulator;
import io.mrkuhne.mezo.support.populator.LearnedFactPopulator;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.event.ApplicationEvents;
import org.springframework.test.context.event.RecordApplicationEvents;

/**
 * S9 Task 5 (mezo-d6ivw.10): the decision branch for a {@code source='merge'} candidate — accept
 * and refine mint the folded sentence regardless of what happened to the member facts meanwhile,
 * reject is not a forget, and the chat extractor's dedupe must reinforce whichever fact now
 * carries a merged-away loser's exact text.
 *
 * <p>No class-level {@code @Transactional} — {@link FactExtractionService#extractFromTurn}'s
 * reinforcement path is emit-reachable, and {@code AppNotificationEmitter}'s {@code REQUIRES_NEW}
 * deadlocks against an uncommitted test-user row (bd mezo-gzhp.1 precedent, see
 * {@code FactExtractionServiceIT}'s class javadoc). Isolation comes from {@code ResetDatabase}
 * via {@link AbstractIntegrationTest}.
 */
@RecordApplicationEvents
@ActiveProfiles("companion-fake")
class FactCandidateMergeDecisionIT extends AbstractIntegrationTest {

    @Autowired private FactCandidateService factCandidateService;
    @Autowired private FactExtractionService factExtractionService;
    @Autowired private KnowledgeFactRepository knowledgeFactRepository;
    @Autowired private LearnedFactRepository learnedFactRepository;
    @Autowired private MemoryForgetVetoRepository vetoRepository;
    @Autowired private AppNotificationRepository appNotificationRepository;
    @Autowired private KnowledgeFactPopulator knowledgeFactPopulator;
    @Autowired private LearnedFactPopulator learnedFactPopulator;
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private ApplicationEvents events;

    private FactDecisionRequest decision(String decision, String refinedText) {
        return FactDecisionRequest.builder()
                .decision(FactDecisionRequest.DecisionEnum.fromValue(decision))
                .refinedText(refinedText).build();
    }

    @Test
    void testDecide_shouldPromoteFoldedSentenceAndMuteMembers_whenMergeAccepted() {
        UUID userId = databasePopulator.populateUser("merge-accept@test.local");
        KnowledgeFactEntity a = knowledgeFactPopulator.fact(userId, "Szereti a teát", "fuel", 2);
        KnowledgeFactEntity b = knowledgeFactPopulator.fact(userId, "Szereti a kávét", "fuel", 3);
        LearnedFactEntity candidate = learnedFactPopulator.mergeCandidate(
                userId, "Szereti a forró italokat", "fuel", List.of(a.getId(), b.getId()));

        FactCandidateResponse decided = factCandidateService.decide(userId, candidate.getId(), decision("accept", null));

        assertThat(decided.getUserDecision()).isEqualTo("accept");
        UUID newFactId = decided.getPromotedFactId();
        assertThat(newFactId).isNotNull();
        KnowledgeFactEntity merged = knowledgeFactRepository.findById(newFactId).orElseThrow();
        assertThat(merged.getFactText()).isEqualTo("Szereti a forró italokat");
        assertThat(merged.getCategory()).isEqualTo("fuel");
        assertThat(merged.getSource()).isEqualTo(KnowledgeFactEntity.SOURCE_MERGE);
        assertThat(merged.getReinforcementCount()).isEqualTo(5); // 2 + 3, the members' counts

        KnowledgeFactEntity reloadedA = knowledgeFactRepository.findById(a.getId()).orElseThrow();
        KnowledgeFactEntity reloadedB = knowledgeFactRepository.findById(b.getId()).orElseThrow();
        assertThat(reloadedA.getMutedReason()).isEqualTo(KnowledgeFactEntity.MUTED_MERGED);
        assertThat(reloadedA.getSupersededBy()).isEqualTo(newFactId);
        assertThat(reloadedA.isIncludeInPrompt()).isFalse();
        assertThat(reloadedB.getMutedReason()).isEqualTo(KnowledgeFactEntity.MUTED_MERGED);
        assertThat(reloadedB.getSupersededBy()).isEqualTo(newFactId);

        assertThat(events.stream(KnowledgeFactPromotedEvent.class).filter(e -> e.factId().equals(newFactId)))
                .hasSize(1);
    }

    @Test
    void testDecide_shouldPromoteRefinedText_whenMergeRefined() {
        UUID userId = databasePopulator.populateUser("merge-refine@test.local");
        KnowledgeFactEntity a = knowledgeFactPopulator.fact(userId, "Szereti a teát", "fuel", 1);
        KnowledgeFactEntity b = knowledgeFactPopulator.fact(userId, "Szereti a kávét", "fuel", 4);
        LearnedFactEntity candidate = learnedFactPopulator.mergeCandidate(
                userId, "Szereti a forró italokat", "fuel", List.of(a.getId(), b.getId()));

        FactCandidateResponse decided = factCandidateService.decide(
                userId, candidate.getId(), decision("refine", "Reggelente forró italt kortyolgat"));

        assertThat(decided.getUserDecision()).isEqualTo("refine");
        assertThat(decided.getRefinedText()).isEqualTo("Reggelente forró italt kortyolgat");
        UUID newFactId = decided.getPromotedFactId();
        KnowledgeFactEntity merged = knowledgeFactRepository.findById(newFactId).orElseThrow();
        assertThat(merged.getFactText()).isEqualTo("Reggelente forró italt kortyolgat");
        assertThat(merged.getReinforcementCount()).isEqualTo(5);
        assertThat(knowledgeFactRepository.findById(a.getId()).orElseThrow().getSupersededBy()).isEqualTo(newFactId);
        assertThat(knowledgeFactRepository.findById(b.getId()).orElseThrow().getSupersededBy()).isEqualTo(newFactId);
    }

    @Test
    void testDecide_shouldLeaveMembersUntouchedAndSkipVeto_whenMergeRejected() {
        UUID userId = databasePopulator.populateUser("merge-reject@test.local");
        KnowledgeFactEntity a = knowledgeFactPopulator.fact(userId, "Szereti a teát", "fuel", 1);
        LearnedFactEntity candidate = learnedFactPopulator.mergeCandidate(
                userId, "Összevont mondat", "fuel", List.of(a.getId()));

        FactCandidateResponse decided = factCandidateService.decide(userId, candidate.getId(), decision("reject", null));

        assertThat(decided.getUserDecision()).isEqualTo("reject");
        assertThat(decided.getPromotedFactId()).isNull();
        KnowledgeFactEntity reloadedA = knowledgeFactRepository.findById(a.getId()).orElseThrow();
        assertThat(reloadedA.getMutedReason()).isNull();
        assertThat(reloadedA.getSupersededBy()).isNull();
        assertThat(reloadedA.isIncludeInPrompt()).isTrue();
        assertThat(vetoRepository.findByCreatedByAndDomainAndDeletedFalse(userId, MemoryForgetVetoEntity.DOMAIN_FACT_TEXT))
                .isEmpty();
    }

    @Test
    void testDecide_shouldSnoozeMergeCandidate_unchangedBehaviour() {
        UUID userId = databasePopulator.populateUser("merge-snooze@test.local");
        KnowledgeFactEntity a = knowledgeFactPopulator.fact(userId, "Szereti a teát", "fuel", 1);
        LearnedFactEntity candidate = learnedFactPopulator.mergeCandidate(
                userId, "Összevont mondat", "fuel", List.of(a.getId()));
        Instant before = Instant.now();

        FactCandidateResponse decided = factCandidateService.decide(userId, candidate.getId(), decision("snooze", null));

        assertThat(decided.getUserDecision()).isNull();
        LearnedFactEntity reloaded = learnedFactRepository.findById(candidate.getId()).orElseThrow();
        assertThat(reloaded.getUserDecision()).isNull();
        assertThat(reloaded.getSnoozedUntil()).isAfter(before.plusSeconds(13 * 24 * 3600));
        assertThat(factCandidateService.listPending(userId)).isEmpty();
    }

    @Test
    void testDecide_shouldMergeOnlyLiveMembers_whenOneWasMutedMeanwhile() {
        UUID userId = databasePopulator.populateUser("merge-partial@test.local");
        KnowledgeFactEntity a = knowledgeFactPopulator.fact(userId, "Szereti a teát", "fuel", 2);
        KnowledgeFactEntity b = knowledgeFactPopulator.fact(userId, "Szereti a kávét", "fuel", 3);
        LearnedFactEntity candidate = learnedFactPopulator.mergeCandidate(
                userId, "Szereti a forró italokat", "fuel", List.of(a.getId(), b.getId()));
        b.mute(KnowledgeFactEntity.MUTED_USER, Instant.now()); // muted meanwhile, e.g. the user muted it directly
        knowledgeFactRepository.saveAndFlush(b);

        FactCandidateResponse decided = factCandidateService.decide(userId, candidate.getId(), decision("accept", null));

        UUID newFactId = decided.getPromotedFactId();
        assertThat(newFactId).isNotNull();
        KnowledgeFactEntity merged = knowledgeFactRepository.findById(newFactId).orElseThrow();
        assertThat(merged.getReinforcementCount()).isEqualTo(2); // only A's count folded in

        KnowledgeFactEntity reloadedA = knowledgeFactRepository.findById(a.getId()).orElseThrow();
        assertThat(reloadedA.getMutedReason()).isEqualTo(KnowledgeFactEntity.MUTED_MERGED);
        assertThat(reloadedA.getSupersededBy()).isEqualTo(newFactId);

        KnowledgeFactEntity reloadedB = knowledgeFactRepository.findById(b.getId()).orElseThrow();
        assertThat(reloadedB.getMutedReason()).isEqualTo(KnowledgeFactEntity.MUTED_USER); // left alone
        assertThat(reloadedB.getSupersededBy()).isNull();
    }

    @Test
    void testDecide_shouldStillMintNewFact_whenNoMemberIsLiveAnymore() {
        UUID userId = databasePopulator.populateUser("merge-none-live@test.local");
        KnowledgeFactEntity a = knowledgeFactPopulator.fact(userId, "Szereti a teát", "fuel", 2);
        LearnedFactEntity candidate = learnedFactPopulator.mergeCandidate(
                userId, "Szereti a forró italokat", "fuel", List.of(a.getId()));
        a.mute(KnowledgeFactEntity.MUTED_USER, Instant.now());
        knowledgeFactRepository.saveAndFlush(a);

        FactCandidateResponse decided = factCandidateService.decide(userId, candidate.getId(), decision("accept", null));

        UUID newFactId = decided.getPromotedFactId();
        assertThat(newFactId).isNotNull(); // the user asked for this sentence — it is minted regardless
        KnowledgeFactEntity merged = knowledgeFactRepository.findById(newFactId).orElseThrow();
        assertThat(merged.getFactText()).isEqualTo("Szereti a forró italokat");
        assertThat(merged.getReinforcementCount()).isZero();
        assertThat(knowledgeFactRepository.findById(a.getId()).orElseThrow().getMutedReason())
                .isEqualTo(KnowledgeFactEntity.MUTED_USER); // left exactly as it was
    }

    @Test
    void testListPending_shouldReturnMergeSourcesInMemberOrder() {
        UUID userId = databasePopulator.populateUser("merge-list@test.local");
        KnowledgeFactEntity a = knowledgeFactPopulator.fact(userId, "Szereti a teát", "fuel", 1);
        KnowledgeFactEntity b = knowledgeFactPopulator.fact(userId, "Szereti a kávét", "fuel", 1);
        learnedFactPopulator.mergeCandidate(userId, "Szereti a forró italokat", "fuel", List.of(b.getId(), a.getId()));

        List<FactCandidateResponse> pending = factCandidateService.listPending(userId);

        assertThat(pending).hasSize(1);
        assertThat(pending.getFirst().getMergeSources()).containsExactly("Szereti a kávét", "Szereti a teát");
    }

    @Test
    void testExtractFromTurn_shouldReinforceSurvivor_whenExtractedTextMatchesMergedLoser() {
        UUID userId = databasePopulator.populateUser("merge-extract@test.local");
        KnowledgeFactEntity a = knowledgeFactPopulator.fact(userId, "Szereti a teát", "fuel", 2);
        KnowledgeFactEntity b = knowledgeFactPopulator.fact(userId, "Szereti a kávét", "fuel", 3);
        LearnedFactEntity candidate = learnedFactPopulator.mergeCandidate(
                userId, "Szereti a forró italokat", "fuel", List.of(a.getId(), b.getId()));
        UUID survivorId = factCandidateService.decide(userId, candidate.getId(), decision("accept", null))
                .getPromotedFactId();
        String content = "megint mondom [fake-facts:[{\"fact\":\"Szereti a teát\",\"category\":\"fuel\"}]]";

        int persisted = factExtractionService.extractFromTurn(userId, null, content, "tudom");

        assertThat(persisted).isZero(); // never creates a candidate
        KnowledgeFactEntity survivor = knowledgeFactRepository.findById(survivorId).orElseThrow();
        assertThat(survivor.getReinforcementCount()).isEqualTo(6); // 5 folded-in + 1 from the reinforcement
        assertThat(survivor.getLastReinforcedAt()).isNotNull();
        assertThat(appNotificationRepository.findByCreatedByAndReadAtIsNullAndDeletedFalse(userId))
                .anySatisfy(n -> {
                    assertThat(n.getKind()).isEqualTo("fact_reinforced");
                    assertThat(n.getRefId()).isEqualTo(survivorId);
                });
        assertThat(learnedFactRepository.findByCreatedByAndUserDecisionIsNullAndDeletedFalseOrderByCreatedAtDesc(userId))
                .isEmpty();
    }
}
