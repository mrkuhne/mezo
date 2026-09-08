package io.mrkuhne.mezo.feature.companion.memory;

import static io.mrkuhne.mezo.support.populator.MemoryEmbeddingPopulator.axisVector;
import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.llm.FakeEmbeddingAdapter;
import io.mrkuhne.mezo.feature.companion.memory.config.MemoryPlatformProperties;
import io.mrkuhne.mezo.feature.companion.memory.dto.ConsumerPolicy;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryItemEntity;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryProvenanceEnvelope;
import io.mrkuhne.mezo.feature.companion.memory.repository.MemoryItemRepository;
import io.mrkuhne.mezo.feature.companion.memory.repository.MemoryRetrievalRunRepository;
import io.mrkuhne.mezo.feature.companion.memory.service.MemoryContextBlock;
import io.mrkuhne.mezo.feature.companion.memory.service.MemoryContextService;
import io.mrkuhne.mezo.feature.llmlog.context.LlmCallContextHolder;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.MemoryItemPopulator;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

/**
 * Memória mindenhol S7 (bd mezo-eq85.7): {@link MemoryContextBlock} — the shared seam every
 * non-chat companion surface (proactive feed today, tasks 8-12 later) uses to reach the unified
 * memory platform. No test transaction — the parallel retriever connections must see committed
 * fixtures, the {@code MemoryContextServiceIT}/{@code ReflectionMemoryGatewayIT} rule.
 */
@ActiveProfiles("companion-fake")
@TestPropertySource(properties = "mezo.feature.companion.enabled=true")
class MemoryContextBlockIT extends AbstractIntegrationTest {

    private static final String VERSION = "gemini-embedding-001-768-v1";

    @Autowired private MemoryContextBlock memoryContextBlock;
    @Autowired private MemoryContextService memoryContextService;
    @Autowired private MemoryPlatformProperties properties;
    @Autowired private LlmCallContextHolder llmCallContextHolder;
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private MemoryItemPopulator memoryPopulator;
    @Autowired private MemoryItemRepository itemRepository;
    @Autowired private MemoryRetrievalRunRepository runRepository;

    @Test
    void testRender_shouldReturnBlockAndAuditRun_whenASeededItemMatchesTheQuery() {
        UUID owner = databasePopulator.populateUser("memory-context-block-hit@test.local");
        item(owner, "Anna után nyugodtabban aludtam. [fake-embed:1]");

        MemoryContextBlock.Rendered rendered = memoryContextBlock.render(owner,
                ConsumerPolicy.MORNING_BRIEFING, "Anna és az alvás [fake-embed:1]",
                LocalDate.now(), false, "proactive_feed", "morning", null);

        assertThat(rendered.block()).isNotBlank();
        assertThat(rendered.retrievalRunId()).isNotNull();
        assertThat(runRepository.findAll()).anySatisfy(run -> {
            assertThat(run.getCreatedBy()).isEqualTo(owner);
            assertThat(run.getConsumerPolicy()).isEqualTo("MORNING_BRIEFING");
        });
    }

    /**
     * A failed embed only kills the DENSE retriever — lexical/facts/graph still run and the
     * shared word "Anna" is enough for the lexical retriever to still surface the item, so the
     * surface still gets a block AND a run row (spec: "the surface still produces its row").
     * {@code MemoryContextServiceIT#testRetrieve_shouldStillProduceItems_whenDenseEmbeddingFails}
     * pins the underlying dense-only degrade this reuses.
     */
    @Test
    void testRender_shouldStillProduceARunAndNotThrow_whenEmbeddingFails() {
        UUID owner = databasePopulator.populateUser("memory-context-block-fail-embed@test.local");
        item(owner, "Anna után nyugodtabban aludtam. [fake-embed:1]");

        MemoryContextBlock.Rendered rendered = memoryContextBlock.render(owner,
                ConsumerPolicy.MORNING_BRIEFING, "Anna és az alvás " + FakeEmbeddingAdapter.FAIL_EMBED,
                LocalDate.now(), false, "proactive_feed", "morning", null);

        assertThat(rendered.retrievalRunId()).isNotNull();
        assertThat(runRepository.findAll()).anySatisfy(run -> {
            assertThat(run.getCreatedBy()).isEqualTo(owner);
            @SuppressWarnings("unchecked")
            var denseTrace = (java.util.Map<String, Object>) run.getRetrieverTrace().get("dense");
            assertThat(denseTrace.get("error")).isNotNull();
        });
    }

    @Test
    void testRender_shouldReturnEmptyAndWriteNoRun_whenThePolicyIsDisabled() {
        UUID owner = databasePopulator.populateUser("memory-context-block-disabled@test.local");
        item(owner, "Anna után nyugodtabban aludtam. [fake-embed:1]");
        MemoryContextBlock disabled = new MemoryContextBlock(
                memoryContextService, withMorningBriefingDisabled(properties), llmCallContextHolder);
        long before = runRepository.count();

        MemoryContextBlock.Rendered rendered = disabled.render(owner,
                ConsumerPolicy.MORNING_BRIEFING, "Anna és az alvás [fake-embed:1]",
                LocalDate.now(), false, "proactive_feed", "morning", null);

        assertThat(rendered).isEqualTo(MemoryContextBlock.Rendered.EMPTY);
        assertThat(runRepository.count()).isEqualTo(before);
    }

    private void item(UUID owner, String content) {
        MemoryItemEntity item = memoryPopulator.item(owner, "journal_entry", UUID.randomUUID(),
                "Anna napló", content, LocalDate.now().minusDays(3), new String[]{"alvas"},
                new String[]{"Anna"}, MemoryProvenanceEnvelope.empty());
        item.setSalience(new BigDecimal("0.900"));
        itemRepository.saveAndFlush(item);
        memoryPopulator.vector(item, VERSION, axisVector(0));
    }

    private static MemoryPlatformProperties withMorningBriefingDisabled(MemoryPlatformProperties base) {
        MemoryPlatformProperties.Policies policies = base.policies();
        return new MemoryPlatformProperties(
                base.servingEmbeddingVersion(), base.embeddingProvider(), base.embeddingModel(),
                base.schemaVersion(), base.servingMode(), base.serving(), base.reembedding(),
                base.audit(), base.fusion(), base.execution(), base.reranker(), base.indicators(),
                new MemoryPlatformProperties.Policies(policies.reflection(),
                        new MemoryPlatformProperties.PolicyLimits(false,
                                policies.morningBriefing().candidateLimit(),
                                policies.morningBriefing().maxTokens(),
                                policies.morningBriefing().rerank(),
                                policies.morningBriefing().deep()),
                        policies.weeklyMemoir(), policies.predictionEvidence(), policies.similarDays(),
                        policies.characterEvidence(), policies.extraction(), policies.personalContext()));
    }
}
