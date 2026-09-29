package io.mrkuhne.mezo.feature.companion.service.merge;

import static org.assertj.core.api.Assertions.assertThat;

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
import io.mrkuhne.mezo.feature.companion.service.merge.FactMergeService.Outcome;
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
        assertThat(sent.get(0).getKind()).isEqualTo(AppNotificationKind.FACT_CANDIDATE.key());
        assertThat(sent.get(0).getTitle()).isEqualTo("Rendet raktam");
        assertThat(sent.get(0).getBody()).isEqualTo("1 ismétlést összevontam");

        // a second run finds the pair already in the ledger — nothing happens, nothing new
        Outcome second2 = factMergeService.runFor(owner);
        assertThat(second2).isEqualTo(new Outcome(0, 0));
        assertThat(ledgerRepository.findByCreatedByAndDeletedFalse(owner)).hasSize(1);
        assertThat(notifications(owner)).hasSize(1);
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
}
