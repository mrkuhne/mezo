package io.mrkuhne.mezo.feature.proactive;

import static io.mrkuhne.mezo.support.populator.MemoryEmbeddingPopulator.axisVector;
import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.llm.FakeCompanionLlm;
import io.mrkuhne.mezo.feature.companion.llm.FakeEmbeddingAdapter;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryItemEntity;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryProvenanceEnvelope;
import io.mrkuhne.mezo.feature.companion.memory.repository.MemoryItemRepository;
import io.mrkuhne.mezo.feature.companion.memory.repository.MemoryRetrievalRunRepository;
import io.mrkuhne.mezo.feature.proactive.entity.CompanionMessageEntity;
import io.mrkuhne.mezo.feature.proactive.repository.CompanionMessageRepository;
import io.mrkuhne.mezo.feature.proactive.service.CompanionMessageGenerator;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.DailySummaryPopulator;
import io.mrkuhne.mezo.support.populator.MemoryItemPopulator;
import io.mrkuhne.mezo.support.populator.SleepLogPopulator;
import io.mrkuhne.mezo.support.populator.WeightLogPopulator;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

/**
 * Memória mindenhol S7 (bd mezo-eq85.7): the four proactive companion messages (morning, sleep,
 * weight, midday/evening window) each append a {@code [Hosszú távú memória]} block via {@link
 * io.mrkuhne.mezo.feature.companion.memory.service.MemoryContextBlock} and contribute the memory
 * platform's ref candidates. No test transaction — the parallel retriever connections must see
 * committed fixtures ({@code MemoryContextServiceIT} / {@code ReflectionMemoryGatewayIT} rule);
 * Reflexió stays off (its own digest path is covered elsewhere) to keep the payload composition
 * focused on the memory seam.
 */
@ActiveProfiles("companion-fake")
@TestPropertySource(properties = "mezo.companion.reflection.enabled=false")
class CompanionMessageGeneratorMemoryIT extends AbstractIntegrationTest {

    private static final LocalDate DAY = LocalDate.of(2026, 7, 6);
    private static final String VERSION = "gemini-embedding-001-768-v1";

    @Autowired private CompanionMessageGenerator companionMessageGenerator;
    @Autowired private CompanionMessageRepository companionMessageRepository;
    @Autowired private DailySummaryPopulator dailySummaryPopulator;
    @Autowired private SleepLogPopulator sleepLogPopulator;
    @Autowired private WeightLogPopulator weightLogPopulator;
    @Autowired private DatabasePopulator databasePopulator;
    @Autowired private MemoryItemPopulator memoryPopulator;
    @Autowired private MemoryItemRepository itemRepository;
    @Autowired private MemoryRetrievalRunRepository runRepository;
    @Autowired private FakeCompanionLlm fakeLlm;

    @Test
    void testGenerateMorning_shouldAppendMemoryBlockAndAuditRun_whenAMemorySeededItemMatches() {
        UUID user = databasePopulator.populateUser("morning-memory-hit@test.local");
        dailySummaryPopulator.summary(user, DAY.minusDays(1), "Tegnap pihenőnap volt. [fake-embed:1]");
        item(user, "Anna után nyugodtabban aludtam. [fake-embed:1]");

        CompanionMessageEntity message = companionMessageGenerator.generateMorning(user, DAY);

        assertThat(message).isNotNull();
        assertThat(fakeLlm.lastUserMessage()).contains("[Hosszú távú memória]");
        assertThat(runRepository.findAll()).anySatisfy(run -> {
            assertThat(run.getCreatedBy()).isEqualTo(user);
            assertThat(run.getConsumerPolicy()).isEqualTo("MORNING_BRIEFING");
        });
    }

    @Test
    void testGenerateMorning_shouldStillPersist_whenMemoryEmbeddingFails() {
        UUID user = databasePopulator.populateUser("morning-memory-fail-embed@test.local");
        dailySummaryPopulator.summary(user, DAY.minusDays(1),
                "Tegnap pihenőnap volt. " + FakeEmbeddingAdapter.FAIL_EMBED);

        CompanionMessageEntity message = companionMessageGenerator.generateMorning(user, DAY);

        assertThat(message).isNotNull();
        assertThat(fakeLlm.lastUserMessage()).doesNotContain("[Hosszú távú memória]");
    }

    @Test
    void testGenerateSleepReaction_shouldAppendMemoryBlock_whenAMemorySeededItemMatches() {
        UUID user = databasePopulator.populateUser("sleep-memory-hit@test.local");
        sleepLogPopulator.createSleepLog(user, DAY, new BigDecimal("7.50"), 4);
        item(user, "Korábban is jól aludtam edzésnap után. [fake-embed:1]");

        CompanionMessageEntity message = companionMessageGenerator.generateSleepReaction(user, DAY);

        assertThat(message).isNotNull();
        assertThat(fakeLlm.lastUserMessage()).contains("[Hosszú távú memória]");
        assertThat(runRepository.findAll()).anySatisfy(run ->
                assertThat(run.getConsumerPolicy()).isEqualTo("MORNING_BRIEFING"));
    }

    @Test
    void testGenerateWeightReaction_shouldAppendMemoryBlock_whenAMemorySeededItemMatches() {
        UUID user = databasePopulator.populateUser("weight-memory-hit@test.local");
        weightLogPopulator.createWeightLog(user, DAY, new BigDecimal("80.5"));
        item(user, "A súlyom hónapok óta lassan csökken. [fake-embed:1]");

        CompanionMessageEntity message = companionMessageGenerator.generateWeightReaction(user, DAY);

        assertThat(message).isNotNull();
        assertThat(fakeLlm.lastUserMessage()).contains("[Hosszú távú memória]");
        assertThat(runRepository.findAll()).anySatisfy(run ->
                assertThat(run.getConsumerPolicy()).isEqualTo("MORNING_BRIEFING"));
    }

    @Test
    void testGenerateWindow_shouldAppendMemoryBlockAndRefCandidate_whenAMemorySeededItemMatches() {
        UUID user = databasePopulator.populateUser("window-memory-hit@test.local");
        dailySummaryPopulator.summary(user, DAY.minusDays(1), "Ma sok vizet ittam. [fake-embed:1]");
        item(user, "Régebben is figyeltem a folyadékbevitelt melegben. [fake-embed:1]");

        CompanionMessageEntity message = companionMessageGenerator
                .generateWindow(user, DAY, CompanionMessageEntity.KIND_MIDDAY);

        assertThat(message).isNotNull();
        assertThat(fakeLlm.lastUserMessage()).contains("[Hosszú távú memória]");
        assertThat(runRepository.findAll()).anySatisfy(run ->
                assertThat(run.getConsumerPolicy()).isEqualTo("MORNING_BRIEFING"));
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
