package io.mrkuhne.mezo.feature.proactive;

import static io.mrkuhne.mezo.support.populator.MemoryEmbeddingPopulator.axisVector;
import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.llm.FakeCompanionLlm;
import io.mrkuhne.mezo.feature.companion.llm.FakeEmbeddingAdapter;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryItemEntity;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryProvenanceEnvelope;
import io.mrkuhne.mezo.feature.companion.memory.repository.MemoryItemRepository;
import io.mrkuhne.mezo.feature.companion.memory.repository.MemoryRetrievalRunRepository;
import io.mrkuhne.mezo.feature.llmlog.entity.CallKind;
import io.mrkuhne.mezo.feature.proactive.entity.MemoirEntity;
import io.mrkuhne.mezo.feature.proactive.repository.MemoirRepository;
import io.mrkuhne.mezo.feature.proactive.service.MemoirGenerator;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.DailySummaryPopulator;
import io.mrkuhne.mezo.support.populator.LlmLogPopulator;
import io.mrkuhne.mezo.support.populator.MemoryItemPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import io.mrkuhne.mezo.techcore.security.LlmActorContext;
import java.math.BigDecimal;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.TemporalAdjusters;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;

/**
 * Memória mindenhol S8 (bd mezo-eq85.8): the memoir's own gather appends a {@code [Hosszú távú
 * memória]} block via {@link io.mrkuhne.mezo.feature.companion.memory.service.MemoryContextBlock}
 * and contributes the memory platform's ref candidates into the numbered HORGONY-JELÖLTEK list —
 * the {@code CompanionMessageGeneratorMemoryIT} idiom (Task 7), applied to {@code MemoirGenerator}.
 * No class-level {@code @Transactional} — same {@code MemoirGeneratorIT} rationale (an
 * emit-under-{@code REQUIRES_NEW} deadlock risk, bd mezo-gzhp.1), which also happens to be exactly
 * what a real memory retrieval needs (committed fixtures, no shared test connection to starve).
 *
 * <p>The {@code FAIL_EMBED} case plants the marker in the week's own daily-summary narrative — the
 * ONLY text {@code MemoirGenerator}'s memory query is built from (the week's narratives joined,
 * first 800 chars) — and asserts the SAME thing {@code MemoryContextServiceIT}'s dense-failure
 * precedent does: the memoir still gets generated, and the audited run's "dense" retriever trace
 * actually carries an error, proof the marker reached {@code embedQuery} and was absorbed.
 */
@ActiveProfiles("companion-fake")
// mezo-eq85.8 fix round 1: pinned low purely so 90 cents of spend IS the 90% throttle line —
// the shipped ceiling is $30 (see application.yml); the LlmBudgetCapIT precedent for this trick.
@TestPropertySource(properties = "mezo.llm-log.budget.hard-cap-usd=1.00")
class MemoirGeneratorMemoryIT extends AbstractIntegrationTest {

    private static final LocalDate WEEK_START = LocalDate.now()
            .with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)).minusWeeks(1);
    private static final String VERSION = "gemini-embedding-001-768-v1";

    @Autowired private MemoirGenerator generator;
    @Autowired private MemoirRepository repository;
    @Autowired private DailySummaryPopulator dailySummaryPopulator;
    @Autowired private UserPopulator userPopulator;
    @Autowired private MemoryItemPopulator memoryPopulator;
    @Autowired private MemoryItemRepository itemRepository;
    @Autowired private MemoryRetrievalRunRepository runRepository;
    @Autowired private FakeCompanionLlm fakeLlm;
    @Autowired private LlmLogPopulator llmLogPopulator;

    @Test
    void testGenerate_shouldAppendMemoryBlockAndAuditRun_whenAMemorySeededItemMatches() {
        UUID user = userPopulator.createUser("memoir-memory-hit@test.local").getId();
        dailySummaryPopulator.summary(user, WEEK_START, "Hétfőn nyugodt nap volt.");
        item(user, "Régen is hasonló héten pihentél.");

        MemoirEntity memoir = generator.generate(user, WEEK_START);

        assertThat(memoir).isNotNull();
        assertThat(fakeLlm.lastUserMessage()).contains("[Hosszú távú memória]");
        // Finding 2 precedent (Task 7 review): the memory ref must reach the numbered
        // HORGONY-JELÖLTEK candidate block — deleting `candidates.addAll(memoryAnchorCandidates(mem))`
        // would leave the block present (asserted above) but this numbered entry gone.
        assertThat(fakeLlm.lastUserMessage()).contains("[journal_entry] Napló");
        assertThat(runRepository.findAll()).filteredOn(run -> user.equals(run.getCreatedBy()))
                .anySatisfy(run -> assertThat(run.getConsumerPolicy()).isEqualTo("WEEKLY_MEMOIR"));
    }

    @Test
    void testGenerate_shouldStillPersist_whenMemoryEmbeddingFails() {
        UUID user = userPopulator.createUser("memoir-memory-fail-embed@test.local").getId();
        // The memoir memory query is the week's daily-summary narratives joined, first 800 chars —
        // the ONLY text it is built from.
        dailySummaryPopulator.summary(user, WEEK_START,
                "Hétfőn nyugodt nap volt. " + FakeEmbeddingAdapter.FAIL_EMBED);
        item(user, "Régen is hasonló héten pihentél.");

        MemoirEntity memoir = generator.generate(user, WEEK_START);

        assertThat(memoir).isNotNull();
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

    /**
     * The Task-7 {@code assertDenseRetrieverFailed} precedent: an audited {@code
     * memory_retrieval_run} row for {@code user} whose "dense" retriever trace carries a non-null
     * error. Goes red if the marker stops reaching the query (test regresses to vacuous) OR if the
     * generator's memory wiring is deleted (no run row is written at all).
     */
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
