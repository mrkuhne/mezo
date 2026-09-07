package io.mrkuhne.mezo.feature.companion.reflection;

import static io.mrkuhne.mezo.support.populator.MemoryEmbeddingPopulator.axisVector;
import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.memory.config.MemoryPlatformProperties;
import io.mrkuhne.mezo.feature.companion.memory.dto.MemoryContext;
import io.mrkuhne.mezo.feature.companion.memory.dto.MemoryRequest;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryItemEntity;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryProvenanceEnvelope;
import io.mrkuhne.mezo.feature.companion.memory.repository.MemoryItemRepository;
import io.mrkuhne.mezo.feature.companion.memory.repository.MemoryRetrievalRunRepository;
import io.mrkuhne.mezo.feature.companion.memory.service.MemoryContextService;
import io.mrkuhne.mezo.feature.companion.reflection.service.ReflectionMemoryGateway;
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
 * Reflexió S3 (bd mezo-eq85.3): the nightly pass' ONE audited memory retrieval. No test
 * transaction — the parallel retriever connections must see committed fixtures (the
 * {@code MemoryContextServiceIT} rule).
 */
@ActiveProfiles("companion-fake")
@TestPropertySource(properties = {
    "mezo.feature.companion.enabled=true",
    "mezo.companion.reflection.enabled=true"
})
class ReflectionMemoryGatewayIT extends AbstractIntegrationTest {

    private static final String VERSION = "gemini-embedding-001-768-v1";

    @Autowired private ReflectionMemoryGateway gateway;
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private MemoryItemPopulator memoryPopulator;
    @Autowired private MemoryItemRepository itemRepository;
    @Autowired private MemoryRetrievalRunRepository runRepository;
    @Autowired private MemoryPlatformProperties properties;
    @Autowired private LlmCallContextHolder llmCallContextHolder;

    @Test
    void testContextFor_shouldReturnPromptBlockAndAuditReflectionPolicy() {
        UUID owner = databasePopulator.populateUser("reflection-gateway-hit@test.local");
        item(owner, "Anna után nyugodtabban aludtam. [fake-embed:1]");
        item(owner, "Anna elvitt a hegyekbe, jó nap volt. [fake-embed:1]");

        String block = gateway.contextFor(owner, "Anna és az alvás [fake-embed:1]", false);

        assertThat(block).isNotBlank();
        assertThat(runRepository.findAll()).anySatisfy(run -> {
            assertThat(run.getCreatedBy()).isEqualTo(owner);
            assertThat(run.getConsumerPolicy()).isEqualTo("REFLECTION");
        });
    }

    @Test
    void testContextFor_shouldReturnEmptyAndNotThrow_whenRetrievalBlowsUp() {
        UUID owner = databasePopulator.populateUser("reflection-gateway-fail@test.local");
        ReflectionMemoryGateway failing = new ReflectionMemoryGateway(
                new ThrowingMemoryContextService(), properties, llmCallContextHolder);

        assertThat(failing.contextFor(owner, "Anna és az alvás", false)).isEmpty();
    }

    @Test
    void testContextFor_shouldReturnEmpty_whenQueryIsBlank() {
        UUID owner = databasePopulator.populateUser("reflection-gateway-blank@test.local");

        assertThat(gateway.contextFor(owner, "   ", false)).isEmpty();
        assertThat(gateway.contextFor(owner, null, false)).isEmpty();
    }

    private void item(UUID owner, String content) {
        MemoryItemEntity item = memoryPopulator.item(owner, "journal_entry", UUID.randomUUID(),
                "Anna napló", content, LocalDate.now().minusDays(3), new String[]{"alvas"},
                new String[]{"Anna"}, MemoryProvenanceEnvelope.empty());
        item.setSalience(new BigDecimal("0.900"));
        itemRepository.saveAndFlush(item);
        memoryPopulator.vector(item, VERSION, axisVector(0));
    }

    /** The gateway's fail-open contract is about ANY runtime blow-up below it — the retrieval
     *  coordinator itself never throws on a partial outage, so the failure is staged here. */
    private static final class ThrowingMemoryContextService extends MemoryContextService {

        private ThrowingMemoryContextService() {
            super(null, java.util.Map.of(), null, null, null, null, null, null, null, null);
        }

        @Override
        public MemoryContext retrieve(MemoryRequest request) {
            throw new IllegalStateException("retrieval exploded");
        }
    }
}
