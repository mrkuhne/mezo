package io.mrkuhne.mezo.feature.character;

import static io.mrkuhne.mezo.support.populator.MemoryEmbeddingPopulator.axisVector;
import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.character.entity.CharacterConferenceEntity;
import io.mrkuhne.mezo.feature.character.service.CharacterBootstrapService;
import io.mrkuhne.mezo.feature.companion.llm.FakeCompanionLlm;
import io.mrkuhne.mezo.feature.companion.llm.FakeEmbeddingAdapter;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryItemEntity;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryProvenanceEnvelope;
import io.mrkuhne.mezo.feature.companion.memory.repository.MemoryItemRepository;
import io.mrkuhne.mezo.feature.companion.memory.repository.MemoryRetrievalRunRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.DailySummaryPopulator;
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
 * Memória mindenhol S10 part 2 (bd mezo-eq85.10, task-10-codebase-notes.md §4): the one-time
 * bootstrap konzílium appends a {@code [Hosszú távú memória]} block, via {@link
 * io.mrkuhne.mezo.feature.companion.memory.service.MemoryContextBlock} under {@code
 * CHARACTER_EVIDENCE}, to every expert's evidence — the {@code MemoirGeneratorMemoryIT} idiom
 * applied to {@code CharacterBootstrapService}.
 *
 * <p>The HAZARD (notes §4): {@code CharacterBootstrapService.run} used to be {@code
 * @Transactional} and called {@code CharacterHistoryReads.gatherHistory} (also {@code
 * @Transactional}) — a memory retrieval fired inside either would need 1 (outer) + 4 (retrievers)
 * + the audit writer against the test pool's 5, and the symptom is a HANG, not a failure. Both
 * classes were restructured so the retrieval happens with no transaction open; only the
 * persisting work (proposal/verdict rounds + conference write) is transactional, reached through
 * a self-proxy.
 */
@ActiveProfiles("companion-fake")
class CharacterBootstrapMemoryIT extends AbstractIntegrationTest {

    private static final String VERSION = "gemini-embedding-001-768-v1";

    @Autowired private CharacterBootstrapService bootstrapService;
    @Autowired private DailySummaryPopulator dailySummaryPopulator;
    @Autowired private UserPopulator userPopulator;
    @Autowired private MemoryItemPopulator memoryPopulator;
    @Autowired private MemoryItemRepository itemRepository;
    @Autowired private MemoryRetrievalRunRepository runRepository;
    @Autowired private FakeCompanionLlm fakeLlm;

    @Test
    void testRun_shouldAppendMemoryBlockAndAuditRun_whenAMemorySeededItemMatches() {
        UUID owner = userPopulator.createUser("bootstrap-memory-hit@test.local").getId();
        dailySummaryPopulator.summary(owner, LocalDate.of(2026, 8, 1), "Nyugodt hónap volt.");
        item(owner, "Régen is hasonló hónapban pihentél.");

        CharacterConferenceEntity conference = bootstrapService.run(owner);

        assertThat(conference).isNotNull();
        assertThat(fakeLlm.userMessages()).anySatisfy(m -> assertThat(m).contains("[Hosszú távú memória]"));
        assertThat(fakeLlm.userMessages()).anySatisfy(m -> assertThat(m).contains("source=journal_entry"));
        assertThat(runRepository.findAll()).filteredOn(run -> owner.equals(run.getCreatedBy()))
                .anySatisfy(run -> assertThat(run.getConsumerPolicy()).isEqualTo("CHARACTER_EVIDENCE"));
    }

    @Test
    void testRun_shouldStillPersist_whenMemoryEmbeddingFails() {
        UUID owner = userPopulator.createUser("bootstrap-memory-fail-embed@test.local").getId();
        dailySummaryPopulator.summary(owner, LocalDate.of(2026, 8, 1),
                "Nyugodt hónap volt. " + FakeEmbeddingAdapter.FAIL_EMBED);
        item(owner, "Régen is hasonló hónapban pihentél.");

        CharacterConferenceEntity conference = bootstrapService.run(owner);

        assertThat(conference).isNotNull();
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
                "Napló", content, LocalDate.of(2026, 7, 29), new String[0], new String[0],
                MemoryProvenanceEnvelope.empty());
        item.setSalience(new BigDecimal("0.900"));
        itemRepository.saveAndFlush(item);
        memoryPopulator.vector(item, VERSION, axisVector(0));
    }
}
