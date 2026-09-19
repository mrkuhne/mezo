package io.mrkuhne.mezo.feature.character;

import static io.mrkuhne.mezo.support.populator.MemoryEmbeddingPopulator.axisVector;
import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.character.entity.CharacterConferenceEntity;
import io.mrkuhne.mezo.feature.character.service.CharacterBootstrapService;
import io.mrkuhne.mezo.feature.companion.llm.FakeCompanionLlm;
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
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

/**
 * Memória mindenhol S10 part 2 (mezo-eq85.10): {@code CHARACTER_EVIDENCE} disabled by config ⇒
 * the bootstrap konzílium ships with no {@code [Hosszú távú memória]} block and writes no {@code
 * memory_retrieval_run} row — separate class ({@code @TestPropertySource} is class-level), the
 * {@code MemoirGeneratorMemoryDisabledIT} precedent.
 */
@ActiveProfiles("companion-fake")
@TestPropertySource(properties = "mezo.companion.memory-platform.policies.character-evidence.enabled=false")
class CharacterBootstrapMemoryDisabledIT extends AbstractIntegrationTest {

    private static final String VERSION = "gemini-embedding-001-768-v1";

    @Autowired private CharacterBootstrapService bootstrapService;
    @Autowired private DailySummaryPopulator dailySummaryPopulator;
    @Autowired private UserPopulator userPopulator;
    @Autowired private MemoryItemPopulator memoryPopulator;
    @Autowired private MemoryItemRepository itemRepository;
    @Autowired private MemoryRetrievalRunRepository runRepository;
    @Autowired private FakeCompanionLlm fakeLlm;

    @Test
    void testRun_shouldShipWithNoMemoryBlockAndWriteNoRun_whenThePolicyIsDisabled() {
        UUID owner = userPopulator.createUser("bootstrap-memory-disabled@test.local").getId();
        dailySummaryPopulator.summary(owner, LocalDate.of(2026, 8, 1), "Nyugodt hónap volt.");
        MemoryItemEntity item = memoryPopulator.item(owner, "journal_entry", UUID.randomUUID(),
                "Napló", "Régen is hasonló hónapban pihentél.", LocalDate.of(2026, 7, 29),
                new String[0], new String[0], MemoryProvenanceEnvelope.empty());
        item.setSalience(new BigDecimal("0.900"));
        itemRepository.saveAndFlush(item);
        memoryPopulator.vector(item, VERSION, axisVector(0));
        long before = runRepository.count();

        CharacterConferenceEntity conference = bootstrapService.run(owner);

        assertThat(conference).isNotNull();
        assertThat(fakeLlm.userMessages()).allSatisfy(m -> assertThat(m).doesNotContain("[Hosszú távú memória]"));
        assertThat(runRepository.count()).isEqualTo(before);
    }
}
