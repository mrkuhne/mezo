package io.mrkuhne.mezo.feature.proactive.service;

import static io.mrkuhne.mezo.support.populator.MemoryEmbeddingPopulator.axisVector;
import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.llm.FakeCompanionLlm;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryItemEntity;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryProvenanceEnvelope;
import io.mrkuhne.mezo.feature.companion.memory.repository.MemoryItemRepository;
import io.mrkuhne.mezo.feature.companion.memory.repository.MemoryRetrievalRunRepository;
import io.mrkuhne.mezo.feature.proactive.entity.WeeklyReviewEntity;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.CheckInPopulator;
import io.mrkuhne.mezo.support.populator.DailySummaryPopulator;
import io.mrkuhne.mezo.support.populator.MemoryItemPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

/**
 * Memória mindenhol S8 (mezo-eq85.8): {@code WEEKLY_MEMOIR} disabled by config ⇒ the weekly
 * review's gather ships with no {@code [Hosszú távú memória]} block and writes no {@code
 * memory_retrieval_run} row. Separate class (not a case inside {@code
 * WeeklyReviewGeneratorMemoryIT}) so the {@code @TestPropertySource} override scopes to exactly
 * this one context — the {@code ChatServicePipelineSwitchOffIT}/{@code
 * MemoirGeneratorMemoryDisabledIT} precedent.
 */
@ActiveProfiles("companion-fake")
@TestPropertySource(properties = "mezo.companion.memory-platform.policies.weekly-memoir.enabled=false")
class WeeklyReviewGeneratorMemoryDisabledIT extends AbstractIntegrationTest {

    private static final LocalDate WEEK_START = LocalDate.now()
            .with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)).minusWeeks(1);
    private static final String VERSION = "gemini-embedding-001-768-v1";

    @Autowired private WeeklyReviewGenerator generator;
    @Autowired private DailySummaryPopulator dailySummaryPopulator;
    @Autowired private CheckInPopulator checkInPopulator;
    @Autowired private UserPopulator userPopulator;
    @Autowired private MemoryItemPopulator memoryPopulator;
    @Autowired private MemoryItemRepository itemRepository;
    @Autowired private MemoryRetrievalRunRepository runRepository;
    @Autowired private FakeCompanionLlm fakeLlm;

    @Test
    void testGenerate_shouldShipWithNoMemoryBlockAndWriteNoRun_whenThePolicyIsDisabled() {
        UUID user = userPopulator.createUser("weekly-review-memory-disabled@test.local").getId();
        dailySummaryPopulator.summary(user, WEEK_START, "Hétfőn nyugodt nap volt.");
        checkInPopulator.createCheckIn(user, WEEK_START, "06:30", 4, 2, "reggeli check-in");
        MemoryItemEntity item = memoryPopulator.item(user, "journal_entry", UUID.randomUUID(),
                "Napló", "Régen is hasonló héten pihentél.", WEEK_START.minusDays(3),
                new String[0], new String[0], MemoryProvenanceEnvelope.empty());
        item.setSalience(new BigDecimal("0.900"));
        itemRepository.saveAndFlush(item);
        memoryPopulator.vector(item, VERSION, axisVector(0));
        long before = runRepository.count();

        WeeklyReviewEntity review = generator.generate(user, WEEK_START);

        assertThat(review).isNotNull();
        assertThat(fakeLlm.lastUserMessage()).doesNotContain("[Hosszú távú memória]");
        assertThat(fakeLlm.lastUserMessage()).doesNotContain("[journal_entry] Napló");
        assertThat(runRepository.count()).isEqualTo(before);
    }
}
