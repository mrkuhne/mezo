package io.mrkuhne.mezo.feature.companion.profile.service;

import static io.mrkuhne.mezo.support.populator.MemoryEmbeddingPopulator.axisVector;
import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.feedback.service.FeedbackLearningService;
import io.mrkuhne.mezo.feature.companion.llm.FakeCompanionLlm;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryItemEntity;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryProvenanceEnvelope;
import io.mrkuhne.mezo.feature.companion.memory.repository.MemoryItemRepository;
import io.mrkuhne.mezo.feature.companion.memory.repository.MemoryRetrievalRunRepository;
import io.mrkuhne.mezo.feature.companion.quarterly.service.Quarters;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.FeedbackPopulator;
import io.mrkuhne.mezo.support.populator.JournalPopulator;
import io.mrkuhne.mezo.support.populator.MemoryItemPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

/**
 * Memória mindenhol S10 part 2 (mezo-eq85.10): {@code CHARACTER_EVIDENCE} disabled by config ⇒
 * the profile rebuild ships with no {@code [Hosszú távú memória]} block and writes no {@code
 * memory_retrieval_run} row — separate class ({@code @TestPropertySource} is class-level), the
 * {@code MemoirGeneratorMemoryDisabledIT} precedent.
 */
@ActiveProfiles("companion-fake")
@TestPropertySource(properties = "mezo.companion.memory-platform.policies.character-evidence.enabled=false")
class ProfileAssemblerMemoryDisabledIT extends AbstractIntegrationTest {

    private static final String VERSION = "gemini-embedding-001-768-v1";

    @Autowired private ProfileAssembler assembler;
    @Autowired private FeedbackPopulator feedbackPopulator;
    @Autowired private JournalPopulator journalPopulator;
    @Autowired private UserPopulator userPopulator;
    @Autowired private FeedbackLearningService feedbackLearningService;
    @Autowired private FakeCompanionLlm fakeCompanionLlm;
    @Autowired private MemoryItemPopulator memoryPopulator;
    @Autowired private MemoryItemRepository itemRepository;
    @Autowired private MemoryRetrievalRunRepository runRepository;

    private static LocalDate currentQuarter() {
        return Quarters.startOf(LocalDate.now());
    }

    @Test
    void testRebuild_shouldShipWithNoMemoryBlockAndWriteNoRun_whenThePolicyIsDisabled() {
        UUID owner = userPopulator.createUser("profile-memory-disabled@test.local").getId();
        feedbackPopulator.createVerdict(owner, "chat_message", UUID.randomUUID(), "up", null);
        feedbackPopulator.createVerdict(owner, "chat_message", UUID.randomUUID(), "down", "too_much");
        journalPopulator.createReviewedDecision(
                owner, LocalDate.of(2026, 6, 1), "Heti 3 edzés", 4, "Bevált.");
        feedbackLearningService.computeRollups(owner);
        MemoryItemEntity item = memoryPopulator.item(owner, "journal_entry", UUID.randomUUID(),
                "Napló", "Régen is jól reagált a rövid üzenetekre.", LocalDate.now().minusDays(3),
                new String[0], new String[0], MemoryProvenanceEnvelope.empty());
        item.setSalience(new BigDecimal("0.900"));
        itemRepository.saveAndFlush(item);
        memoryPopulator.vector(item, VERSION, axisVector(0));
        long before = runRepository.count();

        Optional<UUID> nodeId = assembler.rebuild(owner, currentQuarter());

        assertThat(nodeId).isPresent();
        assertThat(fakeCompanionLlm.lastUserMessage()).doesNotContain("[Hosszú távú memória]");
        assertThat(runRepository.count()).isEqualTo(before);
    }
}
