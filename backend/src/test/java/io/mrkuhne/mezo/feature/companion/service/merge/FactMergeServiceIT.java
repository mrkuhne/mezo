package io.mrkuhne.mezo.feature.companion.service.merge;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.api.dto.FactDecisionRequest;
import io.mrkuhne.mezo.api.dto.UpdateFactRequest;
import io.mrkuhne.mezo.feature.appnotification.domain.AppNotificationKind;
import io.mrkuhne.mezo.feature.appnotification.entity.AppNotificationEntity;
import io.mrkuhne.mezo.feature.appnotification.repository.AppNotificationRepository;
import io.mrkuhne.mezo.feature.companion.entity.FactMergeLedgerEntity;
import io.mrkuhne.mezo.feature.companion.entity.KnowledgeFactEntity;
import io.mrkuhne.mezo.feature.companion.entity.LearnedFactEntity;
import io.mrkuhne.mezo.feature.companion.llm.FakeCompanionLlm;
import io.mrkuhne.mezo.feature.companion.repository.FactMergeLedgerRepository;
import io.mrkuhne.mezo.feature.companion.repository.KnowledgeFactRepository;
import io.mrkuhne.mezo.feature.companion.repository.LearnedFactRepository;
import io.mrkuhne.mezo.feature.companion.service.FactCandidateService;
import io.mrkuhne.mezo.feature.companion.service.KnowledgeFactService;
import io.mrkuhne.mezo.feature.companion.service.merge.FactMergeService.Outcome;
import io.mrkuhne.mezo.support.populator.LearnedFactPopulator;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

/**
 * S9 (mezo-d6ivw.10) Task 4: the weekly fact-merge sweep end to end — a {@code same} pair is
 * auto-merged with no user involved, a {@code combine} pair becomes a pending proposal, both are
 * once-ever (a second run does nothing), and a single "Rendet raktam" notification tells the user
 * what happened. The fake LLM (deterministic {@code FactMergeJudge} twin, see {@code
 * FakeFactMerge}) groups facts whose text is equal after lowercasing and stripping trailing
 * {@code .!?} as {@code same}, and the first two facts whose text contains {@code #comb} as
 * {@code combine} with the canned sentence "Összevont mondat a teszthez.".
 */
@ActiveProfiles("companion-fake")
class FactMergeServiceIT extends AbstractIntegrationTest {

    private static final String CATEGORY = "fuel";

    @Autowired private FactMergeService factMergeService;
    @Autowired private KnowledgeFactRepository knowledgeFactRepository;
    @Autowired private LearnedFactRepository learnedFactRepository;
    @Autowired private FactMergeLedgerRepository ledgerRepository;
    @Autowired private AppNotificationRepository appNotificationRepository;
    @Autowired private UserPopulator userPopulator;
    @Autowired private FakeCompanionLlm fakeCompanionLlm;
    @Autowired private KnowledgeFactService knowledgeFactService;
    @Autowired private FactCandidateService factCandidateService;
    @Autowired private LearnedFactPopulator learnedFactPopulator;

    private KnowledgeFactEntity fact(UUID owner, String text, String source, int reinforcementCount,
                                      Instant lastReinforcedAt) {
        KnowledgeFactEntity fact = new KnowledgeFactEntity();
        fact.setCreatedBy(owner);
        fact.setFactText(text);
        fact.setCategory(CATEGORY);
        fact.setSource(source);
        fact.setReinforcementCount(reinforcementCount);
        fact.setIncludeInPrompt(true);
        fact.setLastReinforcedAt(lastReinforcedAt);
        return knowledgeFactRepository.saveAndFlush(fact);
    }

    private List<AppNotificationEntity> notifications(UUID owner) {
        return appNotificationRepository.findByCreatedByAndReadAtIsNullAndDeletedFalse(owner);
    }

    @Test
    void testRunFor_shouldAutoMergeDuplicateFacts_survivorAbsorbsReinforcementAndLatestTimestamp() {
        UUID owner = userPopulator.createUser().getId();
        Instant earlier = Instant.now().minus(2, ChronoUnit.DAYS).truncatedTo(ChronoUnit.MICROS);
        Instant later = Instant.now().minus(1, ChronoUnit.DAYS).truncatedTo(ChronoUnit.MICROS);
        KnowledgeFactEntity first = fact(owner, "Hétvégén később kezdődik az első étkezés.",
                KnowledgeFactEntity.SOURCE_CHAT, 2, earlier);
        KnowledgeFactEntity second = fact(owner, "hétvégén később kezdődik az első étkezés",
                KnowledgeFactEntity.SOURCE_CHAT, 0, later);

        Outcome outcome = factMergeService.runFor(owner);

        assertThat(outcome).isEqualTo(new Outcome(1, 0));
        KnowledgeFactEntity survivor = knowledgeFactRepository.findById(first.getId()).orElseThrow();
        assertThat(survivor.getFactText()).isEqualTo("Hétvégén később kezdődik az első étkezés.");
        assertThat(survivor.getReinforcementCount()).isEqualTo(2);
        assertThat(survivor.getLastReinforcedAt()).isEqualTo(later);
        assertThat(survivor.isIncludeInPrompt()).isTrue();
        assertThat(survivor.getSupersededBy()).isNull();

        KnowledgeFactEntity loser = knowledgeFactRepository.findById(second.getId()).orElseThrow();
        assertThat(loser.isIncludeInPrompt()).isFalse();
        assertThat(loser.getMutedReason()).isEqualTo(KnowledgeFactEntity.MUTED_MERGED);
        assertThat(loser.getMutedAt()).isNotNull();
        assertThat(loser.getSupersededBy()).isEqualTo(first.getId());

        List<FactMergeLedgerEntity> ledger = ledgerRepository.findByCreatedByAndDeletedFalse(owner);
        assertThat(ledger).hasSize(1);
        assertThat(ledger.get(0).getKind()).isEqualTo(FactMergeLedgerEntity.KIND_AUTO);

        List<AppNotificationEntity> sent = notifications(owner);
        assertThat(sent).hasSize(1);
        // a merge-only run (no proposal) rides FACT_REINFORCED, not FACT_CANDIDATE — nothing is
        // waiting for a decision, so the inbox deeplink would be misleading.
        assertThat(sent.get(0).getKind()).isEqualTo(AppNotificationKind.FACT_REINFORCED.key());
        assertThat(sent.get(0).getDeeplink()).isEqualTo(AppNotificationKind.FACT_REINFORCED.deeplink());
        assertThat(sent.get(0).getTitle()).isEqualTo("Rendet raktam");
        assertThat(sent.get(0).getBody()).isEqualTo("1 ismétlést összevontam");

        // a second run finds the pair already in the ledger — nothing happens, nothing new
        Outcome second2 = factMergeService.runFor(owner);
        assertThat(second2).isEqualTo(new Outcome(0, 0));
        assertThat(ledgerRepository.findByCreatedByAndDeletedFalse(owner)).hasSize(1);
        assertThat(notifications(owner)).hasSize(1);
    }

    @Test
    void testRunFor_shouldRepointAcceptedCandidate_fromLoserOntoSurvivor() {
        UUID owner = userPopulator.createUser().getId();
        KnowledgeFactEntity survivor = fact(owner, "Hétvégén később kezdődik az első étkezés.",
                KnowledgeFactEntity.SOURCE_CHAT, 2, null);
        KnowledgeFactEntity loser = fact(owner, "hétvégén később kezdődik az első étkezés",
                KnowledgeFactEntity.SOURCE_CHAT, 0, null);
        LearnedFactEntity accepted = new LearnedFactEntity();
        accepted.setCreatedBy(owner);
        accepted.setCandidateText(loser.getFactText());
        accepted.setCategory(CATEGORY);
        accepted.setSource(LearnedFactEntity.SOURCE_CHAT);
        accepted.setUserDecision(LearnedFactEntity.DECISION_ACCEPT);
        accepted.setPromotedFactId(loser.getId());
        accepted = learnedFactRepository.saveAndFlush(accepted);

        Outcome outcome = factMergeService.runFor(owner);

        assertThat(outcome).isEqualTo(new Outcome(1, 0));
        LearnedFactEntity reread = learnedFactRepository.findById(accepted.getId()).orElseThrow();
        assertThat(reread.getPromotedFactId()).isEqualTo(survivor.getId());
    }

    @Test
    void testRunFor_shouldProposeCombineCandidate_membersUntouched() {
        UUID owner = userPopulator.createUser().getId();
        KnowledgeFactEntity a = fact(owner, "Sok csokit ettél ma este. #comb",
                KnowledgeFactEntity.SOURCE_CHAT, 1, null);
        KnowledgeFactEntity b = fact(owner, "Későn ettél édességet ma este. #comb",
                KnowledgeFactEntity.SOURCE_CHAT, 1, null);

        Outcome outcome = factMergeService.runFor(owner);

        assertThat(outcome).isEqualTo(new Outcome(0, 1));
        List<LearnedFactEntity> candidates = learnedFactRepository.findByCreatedByAndDeletedFalse(owner);
        assertThat(candidates).hasSize(1);
        LearnedFactEntity candidate = candidates.get(0);
        assertThat(candidate.getSource()).isEqualTo(LearnedFactEntity.SOURCE_MERGE);
        assertThat(candidate.getCandidateText()).isEqualTo("Összevont mondat a teszthez.");
        assertThat(candidate.getCategory()).isEqualTo(CATEGORY);
        assertThat(candidate.getOwner()).isEqualTo("falat");
        assertThat(candidate.getMergeMemberIds()).containsExactlyInAnyOrder(a.getId(), b.getId());
        assertThat(candidate.getUserDecision()).isNull();

        KnowledgeFactEntity rereadA = knowledgeFactRepository.findById(a.getId()).orElseThrow();
        KnowledgeFactEntity rereadB = knowledgeFactRepository.findById(b.getId()).orElseThrow();
        assertThat(rereadA.isIncludeInPrompt()).isTrue();
        assertThat(rereadA.getSupersededBy()).isNull();
        assertThat(rereadA.getReinforcementCount()).isEqualTo(1);
        assertThat(rereadB.isIncludeInPrompt()).isTrue();
        assertThat(rereadB.getSupersededBy()).isNull();
        assertThat(rereadB.getReinforcementCount()).isEqualTo(1);

        List<FactMergeLedgerEntity> ledger = ledgerRepository.findByCreatedByAndDeletedFalse(owner);
        assertThat(ledger).hasSize(1);
        assertThat(ledger.get(0).getKind()).isEqualTo(FactMergeLedgerEntity.KIND_PROPOSAL);
        assertThat(ledger.get(0).getLearnedFactId()).isEqualTo(candidate.getId());

        List<AppNotificationEntity> sent = notifications(owner);
        assertThat(sent).hasSize(1);
        // a run with a proposal rides FACT_CANDIDATE — something is now waiting for a decision.
        assertThat(sent.get(0).getKind()).isEqualTo(AppNotificationKind.FACT_CANDIDATE.key());
        assertThat(sent.get(0).getDeeplink()).isEqualTo(AppNotificationKind.FACT_CANDIDATE.deeplink());
        assertThat(sent.get(0).getBody()).isEqualTo("1 javaslat vár rád");
    }

    @Test
    void testRunFor_shouldMergeChatFactIntoItsPatternTwin() {
        UUID owner = userPopulator.createUser().getId();
        KnowledgeFactEntity patternFact = fact(owner, "Kávét kedvelsz reggelente.",
                KnowledgeFactEntity.SOURCE_PATTERN, 3, null);
        KnowledgeFactEntity chatFact = fact(owner, "kávét kedvelsz reggelente",
                KnowledgeFactEntity.SOURCE_CHAT, 1, null);

        Outcome outcome = factMergeService.runFor(owner);

        assertThat(outcome).isEqualTo(new Outcome(1, 0));
        KnowledgeFactEntity survivor = knowledgeFactRepository.findById(patternFact.getId()).orElseThrow();
        assertThat(survivor.getSource()).isEqualTo(KnowledgeFactEntity.SOURCE_PATTERN);
        assertThat(survivor.getReinforcementCount()).isEqualTo(4);
        assertThat(survivor.isIncludeInPrompt()).isTrue();

        KnowledgeFactEntity loser = knowledgeFactRepository.findById(chatFact.getId()).orElseThrow();
        assertThat(loser.isIncludeInPrompt()).isFalse();
        assertThat(loser.getSupersededBy()).isEqualTo(patternFact.getId());
    }

    @Test
    void testRunFor_shouldSendOneNotification_withBothHalvesWhenBothHappen() {
        UUID owner = userPopulator.createUser().getId();
        fact(owner, "Hétvégén később kezdődik az első étkezés.", KnowledgeFactEntity.SOURCE_CHAT, 2, null);
        fact(owner, "hétvégén később kezdődik az első étkezés", KnowledgeFactEntity.SOURCE_CHAT, 0, null);
        fact(owner, "Sok csokit ettél ma este. #comb", KnowledgeFactEntity.SOURCE_CHAT, 1, null);
        fact(owner, "Későn ettél édességet ma este. #comb", KnowledgeFactEntity.SOURCE_CHAT, 1, null);

        Outcome outcome = factMergeService.runFor(owner);

        assertThat(outcome).isEqualTo(new Outcome(1, 1));
        List<AppNotificationEntity> sent = notifications(owner);
        assertThat(sent).hasSize(1);
        // any proposal at all tips the kind to FACT_CANDIDATE, even alongside a merge.
        assertThat(sent.get(0).getKind()).isEqualTo(AppNotificationKind.FACT_CANDIDATE.key());
        assertThat(sent.get(0).getTitle()).isEqualTo("Rendet raktam");
        assertThat(sent.get(0).getBody()).isEqualTo("1 ismétlést összevontam, 1 javaslat vár rád");

        // a run that does nothing emits no notification at all
        Outcome again = factMergeService.runFor(owner);
        assertThat(again).isEqualTo(new Outcome(0, 0));
        assertThat(notifications(owner)).hasSize(1);
    }

    @Test
    void testRunFor_shouldSkipLlmCall_whenFewerThanTwoLiveFacts() {
        UUID owner = userPopulator.createUser().getId();
        fact(owner, "Egyetlen tény.", KnowledgeFactEntity.SOURCE_CHAT, 1, null);
        int callsBefore = fakeCompanionLlm.completeCallCount();

        Outcome outcome = factMergeService.runFor(owner);

        assertThat(outcome).isEqualTo(new Outcome(0, 0));
        assertThat(fakeCompanionLlm.completeCallCount()).isEqualTo(callsBefore);
        assertThat(notifications(owner)).isEmpty();
    }

    private void revive(UUID owner, UUID factId) {
        knowledgeFactService.update(owner, factId, UpdateFactRequest.builder().includeInPrompt(true).build());
    }

    /** Final-review I1: „Visszakapcsolom” on an auto-merged loser is an undo — the next sweep must
     *  never fold it back into the same survivor. */
    @Test
    void testRunFor_shouldNotRemerge_whenUserUndidOneLoserOfAnAutoMergedTriple() {
        UUID owner = userPopulator.createUser().getId();
        KnowledgeFactEntity a = fact(owner, "Hétvégén később kezdődik az első étkezés.", KnowledgeFactEntity.SOURCE_CHAT, 3, null);
        KnowledgeFactEntity b = fact(owner, "hétvégén később kezdődik az első étkezés", KnowledgeFactEntity.SOURCE_CHAT, 1, null);
        KnowledgeFactEntity c = fact(owner, "Hétvégén később kezdődik az első étkezés!", KnowledgeFactEntity.SOURCE_CHAT, 0, null);
        assertThat(factMergeService.runFor(owner)).isEqualTo(new Outcome(1, 0));
        assertThat(knowledgeFactRepository.findById(b.getId()).orElseThrow().getSupersededBy()).isEqualTo(a.getId());
        assertThat(knowledgeFactRepository.findById(c.getId()).orElseThrow().getSupersededBy()).isEqualTo(a.getId());

        revive(owner, b.getId());

        assertThat(ledgerRepository.existsByCreatedByAndMemberKeyAndDeletedFalse(
                owner, FactMergeLedgerEntity.keyOf(List.of(a.getId(), b.getId())))).isTrue();
        assertThat(factMergeService.runFor(owner)).isEqualTo(new Outcome(0, 0));
        KnowledgeFactEntity revived = knowledgeFactRepository.findById(b.getId()).orElseThrow();
        assertThat(revived.isIncludeInPrompt()).isTrue();
        assertThat(revived.getSupersededBy()).isNull();
    }

    /** Final-review I1: reviving a member of an ACCEPTED proposal is an undo too — it must never
     *  be auto-merged into the fact the proposal minted. */
    @Test
    void testRunFor_shouldNotMergeRevivedProposalMember_intoTheMintedFact() {
        UUID owner = userPopulator.createUser().getId();
        KnowledgeFactEntity a = fact(owner, "Szereti a teát.", KnowledgeFactEntity.SOURCE_CHAT, 1, null);
        KnowledgeFactEntity b = fact(owner, "Szereti a kávét.", KnowledgeFactEntity.SOURCE_CHAT, 1, null);
        // the accepted sentence normalizes equal to A's, so the fake judge WOULD call them "same"
        LearnedFactEntity proposal = learnedFactPopulator.mergeCandidate(
                owner, "szereti a teát", CATEGORY, List.of(a.getId(), b.getId()));
        UUID minted = factCandidateService.decide(owner, proposal.getId(), FactDecisionRequest.builder()
                .decision(FactDecisionRequest.DecisionEnum.fromValue("accept")).build()).getPromotedFactId();
        assertThat(knowledgeFactRepository.findById(a.getId()).orElseThrow().getSupersededBy()).isEqualTo(minted);

        revive(owner, a.getId());

        assertThat(factMergeService.runFor(owner)).isEqualTo(new Outcome(0, 0));
        KnowledgeFactEntity revived = knowledgeFactRepository.findById(a.getId()).orElseThrow();
        assertThat(revived.isIncludeInPrompt()).isTrue();
        assertThat(revived.getSupersededBy()).isNull();
    }

    /** Final-review I2a: a fact riding an UNDECIDED merge proposal (snoozed ones included) stays
     *  out of the sweep — otherwise accepting the proposal later would fold in a stale member. */
    @Test
    void testRunFor_shouldSkipMembersOfPendingMergeProposal_evenWhenSnoozed() {
        UUID owner = userPopulator.createUser().getId();
        KnowledgeFactEntity a = fact(owner, "Hétvégén később kezdődik az első étkezés.", KnowledgeFactEntity.SOURCE_CHAT, 2, null);
        KnowledgeFactEntity b = fact(owner, "hétvégén később kezdődik az első étkezés", KnowledgeFactEntity.SOURCE_CHAT, 0, null);
        KnowledgeFactEntity c = fact(owner, "Szereti a kávét.", KnowledgeFactEntity.SOURCE_CHAT, 1, null);
        LearnedFactEntity proposal = learnedFactPopulator.mergeCandidate(
                owner, "Egy korábbi javaslat", CATEGORY, List.of(a.getId(), c.getId()));
        proposal.setSnoozedUntil(Instant.now().plus(3, ChronoUnit.DAYS));
        learnedFactRepository.saveAndFlush(proposal);

        assertThat(factMergeService.runFor(owner)).isEqualTo(new Outcome(0, 0));
        assertThat(knowledgeFactRepository.findById(a.getId()).orElseThrow().isIncludeInPrompt()).isTrue();
        assertThat(knowledgeFactRepository.findById(b.getId()).orElseThrow().isIncludeInPrompt()).isTrue();
    }
}
