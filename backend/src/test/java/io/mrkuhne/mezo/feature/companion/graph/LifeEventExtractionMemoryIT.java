package io.mrkuhne.mezo.feature.companion.graph;

import static io.mrkuhne.mezo.support.populator.MemoryEmbeddingPopulator.axisVector;
import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.graph.service.LifeEventExtractionService;
import io.mrkuhne.mezo.feature.companion.llm.FakeCompanionLlm;
import io.mrkuhne.mezo.feature.companion.llm.FakeEmbeddingAdapter;
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
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

/**
 * Memória mindenhol S10 part 2 (bd mezo-eq85.10, task-10-codebase-notes.md §4): the nightly
 * life-event extractor appends a {@code KORÁBBI KAPCSOLÓDÓ EMLÉKEK} section wrapping a {@code
 * [Hosszú távú memória]} block, built from the day's own narrative, via {@link
 * io.mrkuhne.mezo.feature.companion.memory.service.MemoryContextBlock} under {@code EXTRACTION} —
 * the {@code MemoirGeneratorMemoryIT} idiom applied to {@code LifeEventExtractionService}. No
 * {@code @Transactional} hazard: {@code extractFor} carries none (class javadoc).
 */
@ActiveProfiles("companion-fake")
class LifeEventExtractionMemoryIT extends AbstractIntegrationTest {

    private static final LocalDate DAY = LocalDate.of(2026, 8, 21);
    private static final String VERSION = "gemini-embedding-001-768-v1";

    @Autowired private LifeEventExtractionService extractionService;
    @Autowired private JournalPopulator journalPopulator;
    @Autowired private UserPopulator userPopulator;
    @Autowired private MemoryItemPopulator memoryPopulator;
    @Autowired private MemoryItemRepository itemRepository;
    @Autowired private MemoryRetrievalRunRepository runRepository;
    @Autowired private FakeCompanionLlm fakeLlm;

    private static String scripted(String json) {
        return "Ma elkezdtem az új munkahelyemen. [fake-life-events:" + json + "]";
    }

    @Test
    void testExtractFor_shouldAppendMemoryBlockAndAuditRun_whenAMemorySeededItemMatches() {
        UUID owner = userPopulator.createUser("life-event-memory-hit@test.local").getId();
        journalPopulator.createEntry(owner, DAY, scripted(
                "[{\"title\":\"Új munkahely első napja\",\"summary\":\"Elkezdtem az új helyen.\",\"edges\":[]}]"),
                JournalEntryEntity.SOURCE_QUICKINPUT);
        item(owner, "Tavaly is munkahelyet váltott ilyenkor.");

        int created = extractionService.extractFor(owner, DAY);

        assertThat(created).isEqualTo(1);
        assertThat(fakeLlm.lastUserMessage()).contains("KORÁBBI KAPCSOLÓDÓ EMLÉKEK:");
        assertThat(fakeLlm.lastUserMessage()).contains("[Hosszú távú memória]");
        assertThat(fakeLlm.lastUserMessage()).contains("source=journal_entry");
        assertThat(runRepository.findAll()).filteredOn(run -> owner.equals(run.getCreatedBy()))
                .anySatisfy(run -> assertThat(run.getConsumerPolicy()).isEqualTo("EXTRACTION"));
    }

    @Test
    void testExtractFor_shouldStillPersist_whenMemoryEmbeddingFails() {
        UUID owner = userPopulator.createUser("life-event-memory-fail-embed@test.local").getId();
        journalPopulator.createEntry(owner, DAY, scripted(
                "[{\"title\":\"Új munkahely első napja\",\"summary\":\"Elkezdtem az új helyen.\",\"edges\":[]}]")
                + " " + FakeEmbeddingAdapter.FAIL_EMBED,
                JournalEntryEntity.SOURCE_QUICKINPUT);
        item(owner, "Tavaly is munkahelyet váltott ilyenkor.");

        int created = extractionService.extractFor(owner, DAY);

        assertThat(created).isEqualTo(1);
        assertThat(runRepository.findAll()).filteredOn(run -> owner.equals(run.getCreatedBy()))
                .anySatisfy(run -> {
                    assertThat(run.getConsumerPolicy()).isEqualTo("EXTRACTION");
                    Object denseTraceRaw = run.getRetrieverTrace().get("dense");
                    assertThat(denseTraceRaw).isNotNull();
                    Map<?, ?> denseTrace = (Map<?, ?>) denseTraceRaw;
                    assertThat(denseTrace.get("error")).isNotNull();
                });
    }

    private void item(UUID owner, String content) {
        MemoryItemEntity item = memoryPopulator.item(owner, "journal_entry", UUID.randomUUID(),
                "Napló", content, DAY.minusDays(3), new String[0], new String[0],
                MemoryProvenanceEnvelope.empty());
        item.setSalience(new BigDecimal("0.900"));
        itemRepository.saveAndFlush(item);
        memoryPopulator.vector(item, VERSION, axisVector(0));
    }
}
