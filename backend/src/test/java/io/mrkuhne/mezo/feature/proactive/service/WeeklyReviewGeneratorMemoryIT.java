package io.mrkuhne.mezo.feature.proactive.service;

import static io.mrkuhne.mezo.support.populator.MemoryEmbeddingPopulator.axisVector;
import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.llm.FakeCompanionLlm;
import io.mrkuhne.mezo.feature.companion.llm.FakeEmbeddingAdapter;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryItemEntity;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryProvenanceEnvelope;
import io.mrkuhne.mezo.feature.companion.memory.repository.MemoryItemRepository;
import io.mrkuhne.mezo.feature.companion.memory.repository.MemoryRetrievalRunRepository;
import io.mrkuhne.mezo.feature.proactive.entity.WeeklyReviewEntity;
import io.mrkuhne.mezo.feature.proactive.repository.WeeklyReviewRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.CheckInPopulator;
import io.mrkuhne.mezo.support.populator.DailySummaryPopulator;
import io.mrkuhne.mezo.support.populator.MemoryItemPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

/**
 * Memória mindenhol S8 (bd mezo-eq85.8): the weekly review's own gather appends a {@code [Hosszú
 * távú memória]} block via {@link
 * io.mrkuhne.mezo.feature.companion.memory.service.MemoryContextBlock} and contributes the memory
 * platform's ref candidates into the numbered HORGONY-JELÖLTEK list — the
 * {@code CompanionMessageGeneratorMemoryIT}/{@code MemoirGeneratorMemoryIT} idiom, applied to
 * {@code WeeklyReviewGenerator}. No class-level {@code @Transactional} — same
 * {@code WeeklyReviewGeneratorIT} rationale (bd mezo-gzhp.1), which also happens to be exactly
 * what a real memory retrieval needs (committed fixtures, no shared test connection to starve).
 *
 * <p>A {@code checkinPopulator} check-in is planted alongside the daily summary purely so
 * {@code hasLoggedData} sees a non-empty week and {@code gather} does not bail before ever
 * building the memory query — the summary's NARRATIVE is what the query is actually built from,
 * not the check-in.
 */
@ActiveProfiles("companion-fake")
class WeeklyReviewGeneratorMemoryIT extends AbstractIntegrationTest {

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
    void testGenerate_shouldAppendMemoryBlockAndAuditRun_whenAMemorySeededItemMatches() {
        UUID user = userPopulator.createUser("weekly-review-memory-hit@test.local").getId();
        dailySummaryPopulator.summary(user, WEEK_START, "Hétfőn nyugodt nap volt.");
        checkInPopulator.createCheckIn(user, WEEK_START, "06:30", 4, 2, "reggeli check-in");
        item(user, "Régen is hasonló héten pihentél.");

        WeeklyReviewEntity review = generator.generate(user, WEEK_START);

        assertThat(review).isNotNull();
        assertThat(fakeLlm.lastUserMessage()).contains("[Hosszú távú memória]");
        assertThat(fakeLlm.lastUserMessage()).contains("[journal_entry] Napló");
        assertThat(runRepository.findAll()).filteredOn(run -> user.equals(run.getCreatedBy()))
                .anySatisfy(run -> assertThat(run.getConsumerPolicy()).isEqualTo("WEEKLY_MEMOIR"));
    }

    @Test
    void testGenerate_shouldStillPersist_whenMemoryEmbeddingFails() {
        UUID user = userPopulator.createUser("weekly-review-memory-fail-embed@test.local").getId();
        // The weekly review memory query is the week's daily-summary narratives joined, first 800
        // chars — the ONLY text it is built from.
        dailySummaryPopulator.summary(user, WEEK_START,
                "Hétfőn nyugodt nap volt. " + FakeEmbeddingAdapter.FAIL_EMBED);
        checkInPopulator.createCheckIn(user, WEEK_START, "06:30", 4, 2, "reggeli check-in");
        item(user, "Régen is hasonló héten pihentél.");

        WeeklyReviewEntity review = generator.generate(user, WEEK_START);

        assertThat(review).isNotNull();
        assertDenseRetrieverFailed(user);
    }

    private void item(UUID owner, String content) {
        MemoryItemEntity item = memoryPopulator.item(owner, "journal_entry", UUID.randomUUID(),
                "Napló", content, WEEK_START.minusDays(3), new String[0], new String[0],
                MemoryProvenanceEnvelope.empty());
        item.setSalience(new BigDecimal("0.900"));
        itemRepository.saveAndFlush(item);
        memoryPopulator.vector(item, VERSION, axisVector(0));
    }

    /** The Task-7 {@code assertDenseRetrieverFailed} precedent, adapted for {@code WEEKLY_MEMOIR}. */
    private void assertDenseRetrieverFailed(UUID user) {
        assertThat(runRepository.findAll()).filteredOn(run -> user.equals(run.getCreatedBy()))
                .anySatisfy(run -> {
                    assertThat(run.getConsumerPolicy()).isEqualTo("WEEKLY_MEMOIR");
                    Object denseTraceRaw = run.getRetrieverTrace().get("dense");
                    assertThat(denseTraceRaw).isNotNull();
                    Map<?, ?> denseTrace = (Map<?, ?>) denseTraceRaw;
                    assertThat(denseTrace.get("error")).isNotNull();
                });
    }
}
