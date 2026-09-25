package io.mrkuhne.mezo.feature.companion.reflection;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.entity.KnowledgeFactEntity;
import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.companion.llm.FakeCompanionLlm;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryProvenanceEnvelope;
import io.mrkuhne.mezo.feature.companion.reflection.service.KnowledgeRecheckService;
import io.mrkuhne.mezo.feature.companion.repository.KnowledgeFactRepository;
import io.mrkuhne.mezo.feature.companion.repository.PatternRepository;
import io.mrkuhne.mezo.feature.companion.service.PatternService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.PatternPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

/**
 * S2 (mezo-d6ivw.2) Task 5, the budget's veto — a review finding (CRITICAL 1): the LLM verdict
 * must never be the thing that costs money when the daily observation budget is already spent.
 * {@code notice.max-per-day=0} means {@code ObservationBudget.allows} refuses unconditionally
 * (the {@code QuickNoticeBudgetOffIT} idiom — a second {@code @TestPropertySource} context
 * because the cap is bound config), and {@link KnowledgeRecheckService} checks that budget
 * BEFORE asking the LLM anything, so a spent day must cost ZERO smart-tier calls, not just zero
 * rows.
 */
@ActiveProfiles("companion-fake")
@TestPropertySource(properties = {"mezo.companion.reflection.notice.max-per-day=0"})
class KnowledgeRecheckServiceBudgetOffIT extends AbstractIntegrationTest {

    @Autowired private KnowledgeRecheckService recheckService;
    @Autowired private PatternRepository patternRepository;
    @Autowired private KnowledgeFactRepository knowledgeFactRepository;
    @Autowired private PatternPopulator patternPopulator;
    @Autowired private UserPopulator userPopulator;
    @Autowired private FakeCompanionLlm fakeCompanionLlm;

    @Test
    void testRunFor_shouldCreateNothingAndCallNoLlm_whenTheDailyBudgetIsSpent() {
        UUID owner = userPopulator.createUser().getId();
        String claim = "Reggelente fél liter vizet iszol.";
        PatternEntity row = patternPopulator.reflectionNoPlan(owner, PatternEntity.STATUS_CONFIRMED);
        row.setMechanism(claim);
        row = patternPopulator.save(row);
        KnowledgeFactEntity fact = new KnowledgeFactEntity();
        fact.setCreatedBy(owner);
        fact.setFactText(claim);
        fact.setCategory("life");
        fact.setSource(KnowledgeFactEntity.SOURCE_PATTERN);
        fact.setIncludeInPrompt(true);
        fact.setProvenance(MemoryProvenanceEnvelope.patternPromotion(row.getId(), PatternService.CONFIRM_SOURCE_USER));
        fact = knowledgeFactRepository.saveAndFlush(fact);
        row.setPromotedFactId(fact.getId());
        patternPopulator.save(row);
        int callsBefore = fakeCompanionLlm.completeCallCount();

        int created = recheckService.runFor(owner);

        assertThat(created).isEqualTo(0);
        assertThat(fakeCompanionLlm.completeCallCount()).isEqualTo(callsBefore);
        assertThat(patternRepository.findByCreatedByAndDeletedFalseOrderByLastDetectedAtDesc(owner))
                .hasSize(1); // the confirmed row only — no drift row was created
    }
}
