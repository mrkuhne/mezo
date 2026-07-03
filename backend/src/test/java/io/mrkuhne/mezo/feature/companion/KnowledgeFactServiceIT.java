package io.mrkuhne.mezo.feature.companion;

import io.mrkuhne.mezo.api.dto.CreateFactRequest;
import io.mrkuhne.mezo.api.dto.KnowledgeFactResponse;
import io.mrkuhne.mezo.api.dto.UpdateFactRequest;
import io.mrkuhne.mezo.feature.companion.entity.KnowledgeFactEntity;
import io.mrkuhne.mezo.feature.companion.service.KnowledgeFactService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.KnowledgeFactPopulator;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** KnowledgeFactService — CRUD spine + the V1.1 top-N prompt-injection block (LLM-free). */
@Transactional
class KnowledgeFactServiceIT extends AbstractIntegrationTest {

    @Autowired private KnowledgeFactService knowledgeFactService;
    @Autowired private KnowledgeFactPopulator factPopulator;
    @Autowired private DatabasePopulator databasePopulator;

    private CreateFactRequest createRequest(String factText, String category) {
        return CreateFactRequest.builder().factText(factText).category(category).build();
    }

    @Test
    void testCreate_shouldDefaultToManualIncludedNotReinforced_whenCreated() {
        UUID userId = databasePopulator.populateUser("fact-create@test.local");

        KnowledgeFactResponse fact = knowledgeFactService.create(userId, createRequest("Laktózérzékeny", "health"));

        assertThat(fact.getId()).isNotNull();
        assertThat(fact.getFactText()).isEqualTo("Laktózérzékeny");
        assertThat(fact.getCategory()).isEqualTo("health");
        assertThat(fact.getSource()).isEqualTo(KnowledgeFactEntity.SOURCE_MANUAL);
        assertThat(fact.getReinforcementCount()).isZero();
        assertThat(fact.getIncludeInPrompt()).isTrue();
        assertThat(fact.getLastReinforcedAt()).isNull();
        assertThat(fact.getCreatedAt()).isNotNull();
    }

    @Test
    void testList_shouldOrderByReinforcementDescThenNewestFirst_whenListing() {
        UUID userId = databasePopulator.populateUser("fact-list@test.local");
        factPopulator.fact(userId, "gyenge tény", "life", 1);
        factPopulator.fact(userId, "erős tény", "train", 5);
        factPopulator.fact(userId, "közepes tény", "fuel", 3);

        List<KnowledgeFactResponse> facts = knowledgeFactService.list(userId);

        assertThat(facts).extracting(KnowledgeFactResponse::getFactText)
                .containsExactly("erős tény", "közepes tény", "gyenge tény");
    }

    @Test
    void testList_shouldNotLeakForeignFacts_whenAnotherUserHasFacts() {
        UUID owner = databasePopulator.populateUser("fact-owner@test.local");
        UUID stranger = databasePopulator.populateUser("fact-stranger@test.local");
        factPopulator.fact(stranger, "idegen tény", "life", 4);

        assertThat(knowledgeFactService.list(owner)).isEmpty();
    }

    @Test
    void testUpdate_shouldToggleIncludeInPromptOnly_whenOnlyToggleSent() {
        UUID userId = databasePopulator.populateUser("fact-toggle@test.local");
        KnowledgeFactEntity fact = factPopulator.fact(userId, "Reggel edz", "train", 2);

        KnowledgeFactResponse updated = knowledgeFactService.update(userId, fact.getId(),
                UpdateFactRequest.builder().includeInPrompt(false).build());

        assertThat(updated.getIncludeInPrompt()).isFalse();
        assertThat(updated.getFactText()).isEqualTo("Reggel edz");
        assertThat(updated.getCategory()).isEqualTo("train");
        assertThat(updated.getReinforcementCount()).isEqualTo(2);
    }

    @Test
    void testUpdate_shouldApplyTextAndCategory_whenProvided() {
        UUID userId = databasePopulator.populateUser("fact-edit@test.local");
        KnowledgeFactEntity fact = factPopulator.fact(userId, "Pontatlan tény", "life", 0);

        KnowledgeFactResponse updated = knowledgeFactService.update(userId, fact.getId(),
                UpdateFactRequest.builder().factText("Pontosított tény").category("health").build());

        assertThat(updated.getFactText()).isEqualTo("Pontosított tény");
        assertThat(updated.getCategory()).isEqualTo("health");
        assertThat(updated.getIncludeInPrompt()).isTrue();
    }

    @Test
    void testUpdate_shouldThrowNotFound_whenFactOwnedBySomeoneElse() {
        UUID owner = databasePopulator.populateUser("fact-upd-owner@test.local");
        UUID stranger = databasePopulator.populateUser("fact-upd-stranger@test.local");
        KnowledgeFactEntity foreign = factPopulator.fact(stranger, "idegen tény", "life", 0);

        assertThatThrownBy(() -> knowledgeFactService.update(owner, foreign.getId(),
                UpdateFactRequest.builder().includeInPrompt(false).build()))
                .isInstanceOf(SystemRuntimeErrorException.class);
    }

    @Test
    void testRenderPromptBlock_shouldReturnEmptyString_whenNoFacts() {
        UUID userId = databasePopulator.populateUser("fact-empty@test.local");

        assertThat(knowledgeFactService.renderPromptBlock(userId)).isEmpty();
    }

    @Test
    void testRenderPromptBlock_shouldKeepTopNByReinforcement_whenMoreFactsThanBudget() {
        UUID userId = databasePopulator.populateUser("fact-topn@test.local");
        // 12 facts, reinforcement 1..12 — the top-10 budget (mezo.companion.facts.top-n) keeps 03..12
        for (int i = 1; i <= 12; i++) {
            factPopulator.fact(userId, "tény-%02d".formatted(i), "train", i);
        }

        String block = knowledgeFactService.renderPromptBlock(userId);

        assertThat(block).startsWith(KnowledgeFactService.FACTS_HEADER);
        assertThat(block).contains("tény-12").contains("tény-03");
        assertThat(block).doesNotContain("tény-02").doesNotContain("tény-01");
        // strongest reinforcement renders first — deterministic ordering
        assertThat(block.indexOf("tény-12")).isLessThan(block.indexOf("tény-11"));
    }

    @Test
    void testRenderPromptBlock_shouldExcludeToggledOffFacts_whenIncludeInPromptFalse() {
        UUID userId = databasePopulator.populateUser("fact-excluded@test.local");
        factPopulator.fact(userId, "látható tény", "fuel", 1);
        factPopulator.fact(userId, "kikapcsolt tény", "fuel", 9, false, KnowledgeFactEntity.SOURCE_MANUAL);

        String block = knowledgeFactService.renderPromptBlock(userId);

        assertThat(block).contains("látható tény").doesNotContain("kikapcsolt tény");
    }

    @Test
    void testRenderPromptBlock_shouldLabelCategoriesInHungarian_whenRendering() {
        UUID userId = databasePopulator.populateUser("fact-labels@test.local");
        factPopulator.fact(userId, "edzés tény", "train", 4);
        factPopulator.fact(userId, "étkezés tény", "fuel", 3);
        factPopulator.fact(userId, "egészség tény", "health", 2);
        factPopulator.fact(userId, "élet tény", "life", 1);

        String block = knowledgeFactService.renderPromptBlock(userId);

        assertThat(block)
                .contains("- (edzés) edzés tény")
                .contains("- (étkezés) étkezés tény")
                .contains("- (egészség) egészség tény")
                .contains("- (élet) élet tény");
    }
}
