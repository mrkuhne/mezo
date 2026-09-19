package io.mrkuhne.mezo.feature.companion.graph;

import static io.mrkuhne.mezo.support.populator.MemoryEmbeddingPopulator.axisVector;
import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.graph.service.LifeEventExtractionService;
import io.mrkuhne.mezo.feature.companion.llm.FakeCompanionLlm;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryItemEntity;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryProvenanceEnvelope;
import io.mrkuhne.mezo.feature.companion.memory.repository.MemoryItemRepository;
import io.mrkuhne.mezo.feature.companion.memory.repository.MemoryRetrievalRunRepository;
import io.mrkuhne.mezo.feature.journal.entity.JournalEntryEntity;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.JournalPopulator;
import io.mrkuhne.mezo.support.populator.MemoryItemPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

/**
 * Memória mindenhol S10 part 2 (mezo-eq85.10): {@code EXTRACTION} disabled by config ⇒ the
 * nightly life-event extractor ships with no {@code KORÁBBI KAPCSOLÓDÓ EMLÉKEK} section and
 * writes no {@code memory_retrieval_run} row — separate class ({@code @TestPropertySource} is
 * class-level), the {@code MemoirGeneratorMemoryDisabledIT} precedent.
 */
@ActiveProfiles("companion-fake")
@TestPropertySource(properties = "mezo.companion.memory-platform.policies.extraction.enabled=false")
class LifeEventExtractionMemoryDisabledIT extends AbstractIntegrationTest {

    private static final LocalDate DAY = LocalDate.of(2026, 8, 21);
    private static final String VERSION = "gemini-embedding-001-768-v1";

    @Autowired private LifeEventExtractionService extractionService;
    @Autowired private JournalPopulator journalPopulator;
    @Autowired private UserPopulator userPopulator;
    @Autowired private MemoryItemPopulator memoryPopulator;
    @Autowired private MemoryItemRepository itemRepository;
    @Autowired private MemoryRetrievalRunRepository runRepository;
    @Autowired private FakeCompanionLlm fakeLlm;

    @Test
    void testExtractFor_shouldShipWithNoMemorySectionAndWriteNoRun_whenThePolicyIsDisabled() {
        UUID owner = userPopulator.createUser("life-event-memory-disabled@test.local").getId();
        journalPopulator.createEntry(owner, DAY,
                "Ma elkezdtem az új munkahelyemen. [fake-life-events:"
                        + "[{\"title\":\"Új munkahely első napja\",\"summary\":\"Elkezdtem az új helyen.\",\"edges\":[]}]]",
                JournalEntryEntity.SOURCE_QUICKINPUT);
        MemoryItemEntity item = memoryPopulator.item(owner, "journal_entry", UUID.randomUUID(),
                "Napló", "Tavaly is munkahelyet váltott ilyenkor.", DAY.minusDays(3),
                new String[0], new String[0], MemoryProvenanceEnvelope.empty());
        item.setSalience(new BigDecimal("0.900"));
        itemRepository.saveAndFlush(item);
        memoryPopulator.vector(item, VERSION, axisVector(0));
        long before = runRepository.count();

        int created = extractionService.extractFor(owner, DAY);

        assertThat(created).isEqualTo(1);
        assertThat(fakeLlm.lastUserMessage()).doesNotContain("KORÁBBI KAPCSOLÓDÓ EMLÉKEK");
        assertThat(fakeLlm.lastUserMessage()).doesNotContain("[Hosszú távú memória]");
        assertThat(runRepository.count()).isEqualTo(before);
    }
}
