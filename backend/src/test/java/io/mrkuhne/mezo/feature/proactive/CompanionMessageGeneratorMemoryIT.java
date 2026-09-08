package io.mrkuhne.mezo.feature.proactive;

import static io.mrkuhne.mezo.support.populator.MemoryEmbeddingPopulator.axisVector;
import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.llm.FakeCompanionLlm;
import io.mrkuhne.mezo.feature.companion.llm.FakeEmbeddingAdapter;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryItemEntity;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryProvenanceEnvelope;
import io.mrkuhne.mezo.feature.companion.memory.repository.MemoryItemRepository;
import io.mrkuhne.mezo.feature.companion.memory.repository.MemoryRetrievalRunRepository;
import io.mrkuhne.mezo.feature.goal.entity.GoalEntity;
import io.mrkuhne.mezo.feature.goal.repository.GoalRepository;
import io.mrkuhne.mezo.feature.proactive.entity.CompanionMessageEntity;
import io.mrkuhne.mezo.feature.proactive.repository.CompanionMessageRepository;
import io.mrkuhne.mezo.feature.proactive.service.CompanionMessageGenerator;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.DatabasePopulator;
import io.mrkuhne.mezo.support.populator.DailySummaryPopulator;
import io.mrkuhne.mezo.support.populator.GoalPopulator;
import io.mrkuhne.mezo.support.populator.MemoryItemPopulator;
import io.mrkuhne.mezo.support.populator.SleepLogPopulator;
import io.mrkuhne.mezo.support.populator.WeightLogPopulator;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Map;
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
 *
 * <p>Fix round (task-7 review, finding 1): the {@code FAIL_EMBED} cases below plant {@link
 * FakeEmbeddingAdapter#FAIL_EMBED} where each surface's OWN memory-retrieval query actually reads
 * it from — morning = the {@code [Cél]} block (well inside the snapshot's first 400 chars the
 * query truncates to), sleep/weight = the log's own free-text note (the only non-numeric field
 * either query carries — see {@code CompanionMessageGenerator#freeTextSuffix}), window = the
 * daily-summary narrative. Each asserts the SAME thing {@code MemoryContextServiceIT}'s own
 * dense-failure precedent does: the surface still produces its row, and the audited run's "dense"
 * retriever trace actually carries an error — proof the marker reached {@code embedQuery} and the
 * failure was absorbed, not proof of nothing (the pre-fix version of this test planted the marker
 * somewhere the query never read, so it passed identically with the whole memory wiring deleted).
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
    @Autowired private GoalPopulator goalPopulator;
    @Autowired private GoalRepository goalRepository;
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
        // Finding 2: the memory ref must reach the numbered HIVATKOZÁS-JELÖLTEK candidate block —
        // deleting `candidates.addAll(memoryRefCandidates(mem))` would leave the block present
        // (asserted above) but this numbered entry gone, and this line would go red.
        assertThat(fakeLlm.lastUserMessage()).contains("[journal_entry] Napló");
        assertThat(runRepository.findAll()).anySatisfy(run -> {
            assertThat(run.getCreatedBy()).isEqualTo(user);
            assertThat(run.getConsumerPolicy()).isEqualTo("MORNING_BRIEFING");
        });
    }

    @Test
    void testGenerateMorning_shouldStillPersist_whenMemoryEmbeddingFails() {
        UUID user = databasePopulator.populateUser("morning-memory-fail-embed@test.local");
        dailySummaryPopulator.summary(user, DAY.minusDays(1), "Tegnap pihenőnap volt.");
        // The morning memory query is `firstChars(renderWithoutBiometrics(...), 400) + planLine` —
        // the [Cél] block sits right after [Profil] near the very start of the snapshot, so a
        // marker in the goal title reliably lands inside that 400-char window.
        GoalEntity goal = goalPopulator.createGoal(user, "cut", "active");
        goal.setTitle(FakeEmbeddingAdapter.FAIL_EMBED);
        goalRepository.saveAndFlush(goal);
        item(user, "Anna után nyugodtabban aludtam. [fake-embed:1]");

        CompanionMessageEntity message = companionMessageGenerator.generateMorning(user, DAY);

        assertThat(message).isNotNull();
        assertDenseRetrieverFailed(user);
    }

    @Test
    void testGenerateSleepReaction_shouldAppendMemoryBlock_whenAMemorySeededItemMatches() {
        UUID user = databasePopulator.populateUser("sleep-memory-hit@test.local");
        sleepLogPopulator.createSleepLog(user, DAY, new BigDecimal("7.50"), 4);
        item(user, "Korábban is jól aludtam edzésnap után. [fake-embed:1]");

        CompanionMessageEntity message = companionMessageGenerator.generateSleepReaction(user, DAY);

        assertThat(message).isNotNull();
        assertThat(fakeLlm.lastUserMessage()).contains("[Hosszú távú memória]");
        assertThat(fakeLlm.lastUserMessage()).contains("[journal_entry] Napló");
        assertThat(runRepository.findAll()).anySatisfy(run ->
                assertThat(run.getConsumerPolicy()).isEqualTo("MORNING_BRIEFING"));
    }

    @Test
    void testGenerateSleepReaction_shouldStillPersist_whenMemoryEmbeddingFails() {
        UUID user = databasePopulator.populateUser("sleep-memory-fail-embed@test.local");
        // The sleep memory query is "alvás " + sleepLine + the log's own free-text note — the ONLY
        // non-numeric field CompanionMessageGenerator#generateSleepReaction's query carries.
        sleepLogPopulator.createSleepLog(user, DAY, "22:30", "06:30",
                new BigDecimal("7.50"), 4, 2, FakeEmbeddingAdapter.FAIL_EMBED);
        item(user, "Korábban is jól aludtam edzésnap után. [fake-embed:1]");

        CompanionMessageEntity message = companionMessageGenerator.generateSleepReaction(user, DAY);

        assertThat(message).isNotNull();
        assertDenseRetrieverFailed(user);
    }

    @Test
    void testGenerateWeightReaction_shouldAppendMemoryBlock_whenAMemorySeededItemMatches() {
        UUID user = databasePopulator.populateUser("weight-memory-hit@test.local");
        weightLogPopulator.createWeightLog(user, DAY, new BigDecimal("80.5"));
        item(user, "A súlyom hónapok óta lassan csökken. [fake-embed:1]");

        CompanionMessageEntity message = companionMessageGenerator.generateWeightReaction(user, DAY);

        assertThat(message).isNotNull();
        assertThat(fakeLlm.lastUserMessage()).contains("[Hosszú távú memória]");
        assertThat(fakeLlm.lastUserMessage()).contains("[journal_entry] Napló");
        assertThat(runRepository.findAll()).anySatisfy(run ->
                assertThat(run.getConsumerPolicy()).isEqualTo("MORNING_BRIEFING"));
    }

    @Test
    void testGenerateWeightReaction_shouldStillPersist_whenMemoryEmbeddingFails() {
        UUID user = databasePopulator.populateUser("weight-memory-fail-embed@test.local");
        // The weight memory query is "súly " + trendLine + the log's own free-text note — the ONLY
        // non-numeric field CompanionMessageGenerator#generateWeightReaction's query carries.
        weightLogPopulator.createWeightLog(user, DAY, new BigDecimal("80.5"), FakeEmbeddingAdapter.FAIL_EMBED);
        item(user, "A súlyom hónapok óta lassan csökken. [fake-embed:1]");

        CompanionMessageEntity message = companionMessageGenerator.generateWeightReaction(user, DAY);

        assertThat(message).isNotNull();
        assertDenseRetrieverFailed(user);
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
        // Finding 2: the window generator has no numbered candidate block — its memory refs are
        // added straight to the PERSISTED message refs (see CompanionMessageGenerator#generateWindow).
        // Deleting `refs.addAll(memoryRefCandidates(mem))` would leave the block assertion above
        // green but this one red.
        assertThat(message.getContent().refs()).anySatisfy(ref -> {
            assertThat(ref.kind()).isEqualTo("journal_entry");
            assertThat(ref.label()).isEqualTo("Napló");
        });
        assertThat(runRepository.findAll()).anySatisfy(run ->
                assertThat(run.getConsumerPolicy()).isEqualTo("MORNING_BRIEFING"));
    }

    @Test
    void testGenerateWindow_shouldStillPersist_whenMemoryEmbeddingFails() {
        UUID user = databasePopulator.populateUser("window-memory-fail-embed@test.local");
        // The window memory query is `firstChars(latest daily-summary narrative, 300)`.
        dailySummaryPopulator.summary(user, DAY.minusDays(1),
                FakeEmbeddingAdapter.FAIL_EMBED + " Ma sok vizet ittam.");
        item(user, "Régebben is figyeltem a folyadékbevitelt melegben. [fake-embed:1]");

        CompanionMessageEntity message = companionMessageGenerator
                .generateWindow(user, DAY, CompanionMessageEntity.KIND_MIDDAY);

        assertThat(message).isNotNull();
        assertDenseRetrieverFailed(user);
    }

    private void item(UUID owner, String content) {
        MemoryItemEntity item = memoryPopulator.item(owner, "journal_entry", UUID.randomUUID(),
                "Napló", content, DAY.minusDays(3), new String[0], new String[0],
                MemoryProvenanceEnvelope.empty());
        item.setSalience(new BigDecimal("0.900"));
        itemRepository.saveAndFlush(item);
        memoryPopulator.vector(item, VERSION, axisVector(0));
    }

    /**
     * Finding 1's shared assertion: an audited {@code memory_retrieval_run} row for {@code user}
     * whose "dense" retriever trace carries a non-null error — the {@code MemoryContextServiceIT}
     * precedent for proving a {@code FakeEmbeddingAdapter.FAIL_EMBED} marker actually reached
     * {@code embedQuery} and was absorbed by the retriever layer, not proof of nothing. Goes red if
     * the marker stops reaching the query (test regresses to vacuous) OR if the generator's memory
     * wiring is deleted (no run row is written at all).
     */
    private void assertDenseRetrieverFailed(UUID user) {
        assertThat(runRepository.findAll()).filteredOn(run -> user.equals(run.getCreatedBy()))
                .anySatisfy(run -> {
                    assertThat(run.getConsumerPolicy()).isEqualTo("MORNING_BRIEFING");
                    Object denseTraceRaw = run.getRetrieverTrace().get("dense");
                    assertThat(denseTraceRaw).isNotNull();
                    Map<?, ?> denseTrace = (Map<?, ?>) denseTraceRaw;
                    assertThat(denseTrace.get("error")).isNotNull();
                });
    }
}
