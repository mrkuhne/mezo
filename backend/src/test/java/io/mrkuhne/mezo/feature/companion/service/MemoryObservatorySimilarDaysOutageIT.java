package io.mrkuhne.mezo.feature.companion.service;

import static io.mrkuhne.mezo.support.populator.MemoryEmbeddingPopulator.axisVector;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryItemEntity;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryProvenanceEnvelope;
import io.mrkuhne.mezo.feature.companion.memory.repository.MemoryRetrievalRunRepository;
import io.mrkuhne.mezo.feature.companion.tools.MemoryTools;
import io.mrkuhne.mezo.feature.companion.tools.ToolCallAudit;
import io.mrkuhne.mezo.feature.companion.tools.ToolContexts;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.MemoryItemPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.model.ToolContext;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

/**
 * mezo-eq85.10 fix round 2, FIX A — the test the epic was missing, driving the REAL retriever set.
 *
 * <p>Fix round 1 shipped two changes that cancelled each other out. The fact and graph retrievers
 * started returning empty on a kind-scoped ({@code SIMILAR_DAYS}) run — correct, neither can hold a
 * {@code daily_summary} — but {@code MemoryContextService} counted "returned an empty list" as a
 * SUCCESS. Two permanent free successes out of four meant {@code successCount == 0} was unreachable
 * on every similar-days run, so {@code retrieveOrFail} could never raise: pgvector down and the
 * lexical index down, and the endpoint still answered 200 with an empty list, which the FE renders
 * as "Nincs elég hasonló nap a memóriában" — the exact fabricated "nincs ilyen napod" fix round 1
 * existed to remove.
 *
 * <p>The two pre-existing failure-path tests could not see this. {@code
 * MemoryContextServiceIT.testRetrieveOrFail_…} hand-assembles a service out of four throwing
 * retrievers under a NON-scoped policy — it proves the seam, never the surface; {@code
 * MemoryToolsSimilarDaysIT.…whenRetrievalBlowsUp} stubs {@code retrieveOrFail} itself. Only a run
 * through the real, Spring-wired four-retriever set under {@code SIMILAR_DAYS} can observe the
 * counting bug, which is what this class does: a 1 ms retriever deadline takes down dense and
 * lexical — the only two that can answer "hasonló napok" — while facts and graph are skipped.
 *
 * <p>Deliberately NOT class-level {@code @Transactional}, for the same reason as its siblings: the
 * retrieval fans out across pooled JDBC connections.
 */
@ActiveProfiles("companion-fake")
@TestPropertySource(properties = {
    "mezo.companion.memory-platform.execution.retriever-timeout-ms=1"
})
class MemoryObservatorySimilarDaysOutageIT extends AbstractIntegrationTest {

    private static final String VERSION = "gemini-embedding-001-768-v1";
    private static final String QUERY = "[fake-embed:1] rossz alvás edzés után";

    @Autowired private MemoryObservatoryService observatoryService;
    @Autowired private MemoryTools memoryTools;
    @Autowired private MemoryItemPopulator memoryItemPopulator;
    @Autowired private MemoryRetrievalRunRepository runRepository;
    @Autowired private UserPopulator userPopulator;

    /**
     * The endpoint must RAISE, not answer an empty list. The seeded day makes the empty answer a
     * provable lie: the memory really does hold a matching day, and only the outage hides it.
     */
    @Test
    void testSimilarDays_shouldRaise_whenEveryRetrieverThatCouldAnswerIsDown() {
        UUID owner = userPopulator.createUser("similar-days-outage-api@test.local").getId();
        LocalDate day = LocalDate.now().minusDays(4);
        item(owner, "Kemény leg-day volt, utána rossz alvás.", day);

        assertThatThrownBy(() -> observatoryService.similarDays(owner, QUERY, 3))
                .isInstanceOfSatisfying(SystemRuntimeErrorException.class, exception -> {
                    assertThat(exception.getStatus().value()).isEqualTo(500);
                    assertThat(exception.getMessages().getFirst().getCode())
                            .isEqualTo("MEMORY_RETRIEVAL_UNAVAILABLE");
                });

        assertThat(runRepository.findAll()).filteredOn(run -> owner.equals(run.getCreatedBy()))
                .singleElement()
                .satisfies(run -> {
                    // The whole point of FIX A: the two retrievers that were never asked are marked
                    // skipped and excluded from the ratio, so the run is a TOTAL failure, not the
                    // "partial" it used to audit as.
                    assertThat(run.getErrorCode()).isEqualTo("MEMORY_RETRIEVAL_ALL_FAILED");
                    assertThat(((Map<?, ?>) run.getRetrieverTrace().get("dense")).get("error"))
                            .isNotNull();
                    assertThat(((Map<?, ?>) run.getRetrieverTrace().get("lexical")).get("error"))
                            .isNotNull();
                    assertThat(((Map<?, ?>) run.getRetrieverTrace().get("facts")).get("skipped"))
                            .isEqualTo(true);
                    assertThat(((Map<?, ?>) run.getRetrieverTrace().get("graph")).get("skipped"))
                            .isEqualTo(true);
                });
    }

    /**
     * The chat tool's half of the same outage: an honest "nem sikerült elérni", never {@code
     * ToolText.NO_DATA} ("nincs adat" = "nincs ilyen napod"), and never a failed turn.
     */
    @Test
    void testFindSimilarPastDays_shouldSayItCouldNotRecall_whenEveryRetrieverThatCouldAnswerIsDown() {
        UUID owner = userPopulator.createUser("similar-days-outage-tool@test.local").getId();
        item(owner, "Kemény leg-day volt, utána rossz alvás.", LocalDate.now().minusDays(4));
        ToolContext context = new ToolContext(Map.of(
                ToolContexts.USER_ID, owner, ToolContexts.AUDIT, new ToolCallAudit(6, 10)));

        String out = memoryTools.findSimilarPastDays(QUERY, 2, context);

        assertThat(out).doesNotContain("nincs adat").contains("nem sikerült elérni");
    }

    private MemoryItemEntity item(UUID owner, String content, LocalDate occurredOn) {
        MemoryItemEntity entity = memoryItemPopulator.item(owner, "daily_summary", UUID.randomUUID(),
                null, content, occurredOn, new String[0], new String[0], MemoryProvenanceEnvelope.empty());
        memoryItemPopulator.vector(entity, VERSION, axisVector(0));
        return entity;
    }
}
