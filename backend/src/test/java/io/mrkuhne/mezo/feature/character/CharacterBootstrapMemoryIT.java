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

    /**
     * mezo-eq85.10 fix round 2, FIX B — the bootstrap's retrieval query must be BOUNDED. It shipped
     * joining up to 60 FULL {@code daily_summary.narrative} values (an unbounded {@code text}
     * column) with no cap at all, and deliberately without the 300-char truncation its own sibling
     * {@code addNarratives} applies. For a real user with 30-60 days of history that is 20k-90k
     * characters handed verbatim to the embedding provider — over its input limit, so the embed
     * fails, {@code MemoryQueryEmbedder} fails open, the dense retriever throws, and the konzílium's
     * memory block is silently and permanently built from lexical/fact/graph only.
     *
     * <p>The pre-existing IT above seeds ONE SHORT summary, which is exactly why it could not see
     * this. Here: five days, each narrative far past the 300-char per-day cap, asserted on the
     * audited {@code raw_query} — the query the retrieval actually ran, not an internal.
     */
    @Test
    void testRun_shouldBoundTheRetrievalQuery_whenTheUserHasManyLongNarratives() {
        UUID owner = userPopulator.createUser("bootstrap-memory-long-history@test.local").getId();
        for (int day = 0; day < 5; day++) {
            dailySummaryPopulator.summary(owner, LocalDate.of(2026, 8, 1).plusDays(day),
                    longNarrative("nap" + day));
        }
        item(owner, "Régen is hasonló hónapban pihentél.");

        assertThat(bootstrapService.run(owner)).isNotNull();

        assertThat(runRepository.findAll()).filteredOn(run -> owner.equals(run.getCreatedBy()))
                .isNotEmpty()
                .allSatisfy(run -> assertThat(run.getRawQuery())
                        // CharacterHistoryReads.MEMORY_QUERY_MAX_CHARS, the bound every sibling
                        // Part-B memory call site uses. Uncapped this would be ~2500 chars here and
                        // tens of thousands for a real user.
                        .hasSizeLessThanOrEqualTo(800));
    }

    /** ~500 chars of words unique to {@code stem} — comfortably past the 300-char per-day cap. */
    private static String longNarrative(String stem) {
        StringBuilder text = new StringBuilder();
        for (int word = 0; word < 60; word++) {
            text.append(stem).append('x').append(word).append(' ');
        }
        return text.toString();
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
