package io.mrkuhne.mezo.feature.proactive;

import static io.mrkuhne.mezo.support.populator.MemoryEmbeddingPopulator.axisVector;
import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.llm.FakeCompanionLlm;
import io.mrkuhne.mezo.feature.companion.llm.FakeEmbeddingAdapter;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryItemEntity;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryProvenanceEnvelope;
import io.mrkuhne.mezo.feature.companion.memory.repository.MemoryItemRepository;
import io.mrkuhne.mezo.feature.companion.memory.repository.MemoryRetrievalRunRepository;
import io.mrkuhne.mezo.feature.proactive.entity.WeeklySuggestionEntity;
import io.mrkuhne.mezo.feature.proactive.service.WeeklySuggestionGenerator;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
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
 * Memória mindenhol S8 (bd mezo-eq85.8): the weekly suggestion's own gather appends a {@code
 * [Hosszú távú memória]} block via {@link
 * io.mrkuhne.mezo.feature.companion.memory.service.MemoryContextBlock} — the {@code
 * CompanionMessageGeneratorMemoryIT}/{@code MemoirGeneratorMemoryIT} idiom, applied to {@code
 * WeeklySuggestionGenerator}. Unlike the other two Task-8 surfaces this generator has NO
 * candidate/anchor list at all (task-8 codebase notes), so these tests assert the block's
 * presence and the audited run only — no ref-candidate assertion.
 *
 * <p>No class-level {@code @Transactional} — same rationale {@code WeeklySuggestionGeneratorIT}'s
 * class javadoc now documents for why THAT class disables the policy instead: a real retrieval's
 * retriever tasks need their own pooled connection, which only works cleanly when this class'
 * fixtures actually commit.
 */
@ActiveProfiles("companion-fake")
class WeeklySuggestionGeneratorMemoryIT extends AbstractIntegrationTest {

    private static final LocalDate WEEK_START =
            LocalDate.now().with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY));
    private static final String VERSION = "gemini-embedding-001-768-v1";

    @Autowired private WeeklySuggestionGenerator generator;
    @Autowired private DailySummaryPopulator dailySummaryPopulator;
    @Autowired private UserPopulator userPopulator;
    @Autowired private MemoryItemPopulator memoryPopulator;
    @Autowired private MemoryItemRepository itemRepository;
    @Autowired private MemoryRetrievalRunRepository runRepository;
    @Autowired private FakeCompanionLlm fakeLlm;

    @Test
    void testGenerate_shouldAppendMemoryBlockAndAuditRun_whenAMemorySeededItemMatches() {
        UUID user = userPopulator.createUser("weekly-suggestion-memory-hit@test.local").getId();
        dailySummaryPopulator.summary(user, WEEK_START.minusDays(1), "Tegnap pihenő volt.");
        item(user, "Régen is hasonló héten pihentél.");

        WeeklySuggestionEntity suggestion = generator.generate(user, WEEK_START);

        assertThat(suggestion).isNotNull();
        assertThat(fakeLlm.lastUserMessage()).contains("[Hosszú távú memória]");
        assertThat(runRepository.findAll()).filteredOn(run -> user.equals(run.getCreatedBy()))
                .anySatisfy(run -> assertThat(run.getConsumerPolicy()).isEqualTo("WEEKLY_MEMOIR"));
    }

    @Test
    void testGenerate_shouldStillPersist_whenMemoryEmbeddingFails() {
        UUID user = userPopulator.createUser("weekly-suggestion-memory-fail-embed@test.local").getId();
        // The weekly suggestion memory query is the PRIOR week's daily-summary narratives joined,
        // first 800 chars — the ONLY text it is built from.
        dailySummaryPopulator.summary(user, WEEK_START.minusDays(1),
                "Tegnap pihenő volt. " + FakeEmbeddingAdapter.FAIL_EMBED);
        item(user, "Régen is hasonló héten pihentél.");

        WeeklySuggestionEntity suggestion = generator.generate(user, WEEK_START);

        assertThat(suggestion).isNotNull();
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
