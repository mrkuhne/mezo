package io.mrkuhne.mezo.feature.companion;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.entity.KnowledgeFactEntity;
import io.mrkuhne.mezo.feature.companion.entity.MemoryForgetVetoEntity;
import io.mrkuhne.mezo.feature.companion.entity.PatternEntity;
import io.mrkuhne.mezo.feature.companion.repository.LearnedFactRepository;
import io.mrkuhne.mezo.feature.companion.repository.MemoryForgetVetoRepository;
import io.mrkuhne.mezo.feature.companion.repository.PatternRepository;
import io.mrkuhne.mezo.feature.companion.service.FactExtractionService;
import io.mrkuhne.mezo.feature.companion.service.ForgetService;
import io.mrkuhne.mezo.feature.companion.service.PatternService;
import io.mrkuhne.mezo.feature.proactive.service.WeeklyLessonService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.KnowledgeFactPopulator;
import io.mrkuhne.mezo.support.populator.PatternPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

/** S6 (mezo-d6ivw.6) Task A5: a forgotten thing is never re-learned from the same source. */
@ActiveProfiles("companion-fake")
class ForgetVetoWritersIT extends AbstractIntegrationTest {

    @Autowired private FactExtractionService extraction;
    @Autowired private WeeklyLessonService weeklyLessons;
    @Autowired private ForgetService forgetService;
    @Autowired private PatternService patternService;
    @Autowired private LearnedFactRepository candidates;
    @Autowired private PatternRepository patterns;
    @Autowired private MemoryForgetVetoRepository vetoes;
    @Autowired private KnowledgeFactPopulator factPopulator;
    @Autowired private PatternPopulator patternPopulator;
    @Autowired private UserPopulator userPopulator;

    @Test
    void chatExtraction_shouldNotProposeAForgottenText() {
        UUID owner = userPopulator.createUser().getId();
        KnowledgeFactEntity fact = factPopulator.fact(owner, "Laktózérzékeny vagy.", "fuel", 1, true,
                KnowledgeFactEntity.SOURCE_CHAT);
        forgetService.forgetFact(owner, fact.getId());

        // FakeCompanionLlm's extraction branch echoes a scripted fact list — see the
        // FactExtractionServiceIT idiom for the marker; script the SAME text, different case/spacing.
        int persisted = extraction.extractFromTurn(owner, UUID.randomUUID(),
                "[fake-facts:[{\"fact\":\"laktózérzékeny  vagy.\",\"category\":\"fuel\"}]]", "Rendben.");

        assertThat(persisted).isZero();
        assertThat(candidates.findByCreatedByAndUserDecisionIsNullAndDeletedFalseOrderByCreatedAtDesc(owner)).isEmpty();
    }

    @Test
    void weeklyLessons_shouldSkipAForgottenText() {
        UUID owner = userPopulator.createUser().getId();
        KnowledgeFactEntity fact = factPopulator.fact(owner, "Hétvégén kevesebb a fehérje.", "fuel", 0);
        forgetService.forgetFact(owner, fact.getId());

        int written = weeklyLessons.propose(owner, LocalDate.of(2026, 9, 21), List.of(
                new WeeklyLessonService.LessonProposal("Hétvégén kevesebb a fehérje.", "fuel", null, null)));

        assertThat(written).isZero();
    }

    @Test
    void promotion_shouldNotRemintAVetoedPattern() {
        UUID owner = userPopulator.createUser().getId();
        PatternEntity row = patternPopulator.reflectionNoPlan(owner, PatternEntity.STATUS_PROPOSED);
        MemoryForgetVetoEntity veto = new MemoryForgetVetoEntity();
        veto.setCreatedBy(owner);
        veto.setDomain(MemoryForgetVetoEntity.DOMAIN_PATTERN);
        veto.setVetoKey(row.getId().toString());
        vetoes.saveAndFlush(veto);

        patternService.applyUserConfirm(owner, row);
        patterns.saveAndFlush(row);

        assertThat(patterns.findById(row.getId()).orElseThrow().getPromotedFactId()).isNull();
    }
}
