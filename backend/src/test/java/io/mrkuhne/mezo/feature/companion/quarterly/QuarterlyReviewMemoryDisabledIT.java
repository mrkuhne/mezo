package io.mrkuhne.mezo.feature.companion.quarterly;

import static io.mrkuhne.mezo.support.populator.MemoryEmbeddingPopulator.axisVector;
import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.entity.PeriodSummaryEntity;
import io.mrkuhne.mezo.feature.companion.llm.FakeCompanionLlm;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryItemEntity;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryProvenanceEnvelope;
import io.mrkuhne.mezo.feature.companion.memory.repository.MemoryItemRepository;
import io.mrkuhne.mezo.feature.companion.memory.repository.MemoryRetrievalRunRepository;
import io.mrkuhne.mezo.feature.companion.quarterly.service.QuarterlyReviewService;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.MemoryItemPopulator;
import io.mrkuhne.mezo.support.populator.PeriodSummaryPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

/**
 * Memória mindenhol S10 part 2 (mezo-eq85.10): {@code CHARACTER_EVIDENCE} disabled by config ⇒
 * the quarterly pass ships with no {@code [Hosszú távú memória]} block and writes no {@code
 * memory_retrieval_run} row — separate class (not a case inside {@code QuarterlyReviewMemoryIT}),
 * the {@code MemoirGeneratorMemoryDisabledIT} precedent: {@code @TestPropertySource} is
 * class-level.
 */
@ActiveProfiles("companion-fake")
@TestPropertySource(properties = "mezo.companion.memory-platform.policies.character-evidence.enabled=false")
class QuarterlyReviewMemoryDisabledIT extends AbstractIntegrationTest {

    private static final LocalDate Q3 = LocalDate.of(2026, 7, 1);
    private static final String VERSION = "gemini-embedding-001-768-v1";

    @Autowired private QuarterlyReviewService quarterlyReviewService;
    @Autowired private PeriodSummaryPopulator periodSummaryPopulator;
    @Autowired private UserPopulator userPopulator;
    @Autowired private MemoryItemPopulator memoryPopulator;
    @Autowired private MemoryItemRepository itemRepository;
    @Autowired private MemoryRetrievalRunRepository runRepository;
    @Autowired private FakeCompanionLlm fakeLlm;

    @Test
    void testRunFor_shouldShipWithNoMemoryBlockAndWriteNoRun_whenThePolicyIsDisabled() {
        UUID owner = userPopulator.createUser("quarterly-memory-disabled@test.local").getId();
        periodSummaryPopulator.periodSummary(owner, PeriodSummaryEntity.GRANULARITY_MONTH, Q3,
                "Júliusi hónap. [fake-season:[{\"title\":\"Nyári alapozás\",\"summary\":\"A nyár a volumenről szólt.\"}]]");
        MemoryItemEntity item = memoryPopulator.item(owner, "journal_entry", UUID.randomUUID(),
                "Napló", "Tavaly nyáron is hasonló volt a lendület.", Q3.minusDays(3),
                new String[0], new String[0], MemoryProvenanceEnvelope.empty());
        item.setSalience(new BigDecimal("0.900"));
        itemRepository.saveAndFlush(item);
        memoryPopulator.vector(item, VERSION, axisVector(0));
        long before = runRepository.count();

        int created = quarterlyReviewService.runFor(owner, Q3);

        assertThat(created).isEqualTo(1);
        assertThat(fakeLlm.lastUserMessage()).doesNotContain("[Hosszú távú memória]");
        assertThat(fakeLlm.lastUserMessage()).doesNotContain("source=journal_entry");
        assertThat(runRepository.count()).isEqualTo(before);
    }
}
