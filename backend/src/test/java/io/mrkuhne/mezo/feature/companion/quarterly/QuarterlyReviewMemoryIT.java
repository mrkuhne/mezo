package io.mrkuhne.mezo.feature.companion.quarterly;

import static io.mrkuhne.mezo.support.populator.MemoryEmbeddingPopulator.axisVector;
import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.entity.PeriodSummaryEntity;
import io.mrkuhne.mezo.feature.companion.llm.FakeCompanionLlm;
import io.mrkuhne.mezo.feature.companion.llm.FakeEmbeddingAdapter;
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
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

/**
 * Memória mindenhol S10 part 2 (bd mezo-eq85.10, task-10-codebase-notes.md §4): the quarterly
 * season pass appends a {@code [Hosszú távú memória]} block, built from the quarter's own
 * period-summary text, via {@link io.mrkuhne.mezo.feature.companion.memory.service.MemoryContextBlock}
 * under {@code CHARACTER_EVIDENCE} — the {@code MemoirGeneratorMemoryIT} idiom applied to
 * {@code QuarterlyReviewService}. No {@code @Transactional} hazard here: {@code runFor} carries
 * none (class javadoc — persistence is pulled into {@code persistCandidates} via the self-proxy).
 */
@ActiveProfiles("companion-fake")
class QuarterlyReviewMemoryIT extends AbstractIntegrationTest {

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
    void testRunFor_shouldAppendMemoryBlockAndAuditRun_whenAMemorySeededItemMatches() {
        UUID owner = userPopulator.createUser("quarterly-memory-hit@test.local").getId();
        periodSummaryPopulator.periodSummary(owner, PeriodSummaryEntity.GRANULARITY_MONTH, Q3,
                "Júliusi hónap. [fake-season:[{\"title\":\"Nyári alapozás\",\"summary\":\"A nyár a volumenről szólt.\"}]]");
        item(owner, "Tavaly nyáron is hasonló volt a lendület.");

        int created = quarterlyReviewService.runFor(owner, Q3);

        assertThat(created).isEqualTo(1);
        assertThat(fakeLlm.lastUserMessage()).contains("[Hosszú távú memória]");
        assertThat(fakeLlm.lastUserMessage()).contains("source=journal_entry");
        assertThat(runRepository.findAll()).filteredOn(run -> owner.equals(run.getCreatedBy()))
                .anySatisfy(run -> assertThat(run.getConsumerPolicy()).isEqualTo("CHARACTER_EVIDENCE"));
    }

    @Test
    void testRunFor_shouldStillProduceCandidate_whenMemoryEmbeddingFails() {
        UUID owner = userPopulator.createUser("quarterly-memory-fail-embed@test.local").getId();
        periodSummaryPopulator.periodSummary(owner, PeriodSummaryEntity.GRANULARITY_MONTH, Q3,
                "Júliusi hónap. " + FakeEmbeddingAdapter.FAIL_EMBED
                        + " [fake-season:[{\"title\":\"Nyári alapozás\",\"summary\":\"A nyár a volumenről szólt.\"}]]");
        item(owner, "Tavaly nyáron is hasonló volt a lendület.");

        int created = quarterlyReviewService.runFor(owner, Q3);

        assertThat(created).isEqualTo(1);
        assertThat(runRepository.findAll()).filteredOn(run -> owner.equals(run.getCreatedBy()))
                .anySatisfy(run -> {
                    assertThat(run.getConsumerPolicy()).isEqualTo("CHARACTER_EVIDENCE");
                    Object denseTraceRaw = run.getRetrieverTrace().get("dense");
                    assertThat(denseTraceRaw).isNotNull();
                    Map<?, ?> denseTrace = (Map<?, ?>) denseTraceRaw;
                    assertThat(denseTrace.get("error")).isNotNull();
                });
    }

    private void item(UUID owner, String content) {
        MemoryItemEntity item = memoryPopulator.item(owner, "journal_entry", UUID.randomUUID(),
                "Napló", content, Q3.minusDays(3), new String[0], new String[0],
                MemoryProvenanceEnvelope.empty());
        item.setSalience(new BigDecimal("0.900"));
        itemRepository.saveAndFlush(item);
        memoryPopulator.vector(item, VERSION, axisVector(0));
    }
}
