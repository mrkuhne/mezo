package io.mrkuhne.mezo.feature.companion;

import io.mrkuhne.mezo.feature.companion.entity.AiConversationEntity;
import io.mrkuhne.mezo.feature.companion.entity.AiMessageEntity;
import io.mrkuhne.mezo.feature.companion.entity.MemoryEmbeddingEntity;
import io.mrkuhne.mezo.feature.companion.entity.RecalledMemoriesEnvelope;
import io.mrkuhne.mezo.feature.companion.entity.RefsEnvelope;
import io.mrkuhne.mezo.feature.companion.llm.FakeEmbeddingAdapter;
import io.mrkuhne.mezo.feature.companion.repository.MemoryEmbeddingRepository;
import io.mrkuhne.mezo.feature.companion.service.PromptMemoryAssembler;
import io.mrkuhne.mezo.feature.companion.service.PromptMemoryAssembler.AmbientRecall;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.AiConversationPopulator;
import io.mrkuhne.mezo.support.populator.AiMessagePopulator;
import io.mrkuhne.mezo.support.populator.MemoryEmbeddingPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.tuple;
import static org.assertj.core.api.Assertions.within;

/**
 * W3.1 ambient recall over hand-seeded vectors + the fake embedder's {@code [fake-embed:…]}
 * scripted query: per-group caps, the similarity floor, today-skip, decayed ordering, Memory
 * refs, and both failure paths (embed hop, ANN query) — all provider-free.
 */
@Transactional
@ActiveProfiles("companion-fake")
class PromptMemoryAssemblerIT extends AbstractIntegrationTest {

    /** Query whose fake embedding is exactly axis-0 — cosine geometry is then hand-computable. */
    private static final String AXIS0_QUERY = "[fake-embed:1] hogy aludtam futás után?";
    private static final LocalDate TODAY = LocalDate.now();

    @Autowired private PromptMemoryAssembler assembler;
    @Autowired private MemoryEmbeddingPopulator memoryEmbeddingPopulator;
    @Autowired private MemoryEmbeddingRepository memoryEmbeddingRepository;
    @Autowired private UserPopulator userPopulator;
    @Autowired private AiConversationPopulator aiConversationPopulator;
    @Autowired private AiMessagePopulator aiMessagePopulator;

    private void seed(UUID owner, String kind, String content, LocalDate day, float[] vector) {
        memoryEmbeddingPopulator.embedding(owner, kind, UUID.randomUUID(), content, day, vector);
    }

    @Test
    void testRecall_shouldRenderRelevantEpisodesWithDateAndKindTag_whenSimilarMemoriesExist() {
        UUID owner = userPopulator.createUser().getId();
        seed(owner, MemoryEmbeddingEntity.KIND_JOURNAL_ENTRY, "futás után jobban aludtam", TODAY.minusDays(3),
                MemoryEmbeddingPopulator.axisVector(0));
        seed(owner, MemoryEmbeddingEntity.KIND_DAILY_SUMMARY, "Kemény nap volt.\nMásodik sor.", TODAY.minusDays(10),
                MemoryEmbeddingPopulator.axisVector(0));
        seed(owner, MemoryEmbeddingEntity.KIND_CHAT_TURN, "Daniel: alvás?\nMezo: jó volt", TODAY.minusDays(5),
                MemoryEmbeddingPopulator.axisVector(0));
        seed(owner, MemoryEmbeddingEntity.KIND_ACTIVITY_NOTE, "hosszú esti séta a parton", TODAY.minusDays(2),
                MemoryEmbeddingPopulator.axisVector(0));

        AmbientRecall recalled = assembler.recall(owner, UUID.randomUUID(), AXIS0_QUERY, TODAY);

        assertThat(recalled.block()).startsWith(PromptMemoryAssembler.MEMORIES_HEADER);
        assertThat(recalled.block()).contains("- " + TODAY.minusDays(3) + " (napló): futás után jobban aludtam\n");
        assertThat(recalled.block()).contains("- " + TODAY.minusDays(10) + " (napi összefoglaló): Kemény nap volt.\n");
        assertThat(recalled.block()).doesNotContain("Második sor");
        assertThat(recalled.block()).contains("(korábbi beszélgetés): Daniel: alvás?");
        assertThat(recalled.block()).contains("(aktivitásjegyzet): hosszú esti séta");
        assertThat(recalled.refs()).containsExactlyInAnyOrder(
                new RefsEnvelope.Ref("Memory", TODAY.minusDays(2).toString()),
                new RefsEnvelope.Ref("Memory", TODAY.minusDays(3).toString()),
                new RefsEnvelope.Ref("Memory", TODAY.minusDays(5).toString()),
                new RefsEnvelope.Ref("Memory", TODAY.minusDays(10).toString()));
        // W3.1b (mezo-b3pp.28): the same items, disclosable — in PROMPT order (decayed score, so
        // freshest first here) with the rendered label and the byte-identical one-line gist.
        assertThat(recalled.items()).extracting(
                        RecalledMemoriesEnvelope.Item::occurredOn, RecalledMemoriesEnvelope.Item::kind,
                        RecalledMemoriesEnvelope.Item::label, RecalledMemoriesEnvelope.Item::gist)
                .containsExactly(
                        tuple(TODAY.minusDays(2), MemoryEmbeddingEntity.KIND_ACTIVITY_NOTE,
                                "aktivitásjegyzet", "hosszú esti séta a parton"),
                        tuple(TODAY.minusDays(3), MemoryEmbeddingEntity.KIND_JOURNAL_ENTRY,
                                "napló", "futás után jobban aludtam"),
                        tuple(TODAY.minusDays(5), MemoryEmbeddingEntity.KIND_CHAT_TURN,
                                "korábbi beszélgetés", "Daniel: alvás?"),
                        tuple(TODAY.minusDays(10), MemoryEmbeddingEntity.KIND_DAILY_SUMMARY,
                                "napi összefoglaló", "Kemény nap volt."));
        // similarity is the RAW cosine (not the decayed score) — every seed is axis-0, so 1.0
        assertThat(recalled.items()).allSatisfy(item ->
                assertThat(item.similarity()).isCloseTo(1.0, within(1e-6)));
    }

    /**
     * Memory refs carry the DATE, not the row id — so two episodes of the same day render as two
     * lines but claim ONE ref. This is what keeps a dense day from eating the turn's ref budget.
     */
    @Test
    void testRecall_shouldCollapseSameDayItemsToOneMemoryRef_whenTwoEpisodesShareADay() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate sharedDay = TODAY.minusDays(4);
        seed(owner, MemoryEmbeddingEntity.KIND_JOURNAL_ENTRY, "reggel futottam", sharedDay,
                MemoryEmbeddingPopulator.axisVector(0));
        seed(owner, MemoryEmbeddingEntity.KIND_DAILY_SUMMARY, "jó nap volt", sharedDay,
                MemoryEmbeddingPopulator.axisVector(0));

        AmbientRecall recalled = assembler.recall(owner, UUID.randomUUID(), AXIS0_QUERY, TODAY);

        // both rendered…
        assertThat(recalled.block()).contains("- " + sharedDay + " (napló): reggel futottam\n");
        assertThat(recalled.block()).contains("- " + sharedDay + " (napi összefoglaló): jó nap volt\n");
        // …but the day is ONE ref
        assertThat(recalled.refs()).containsExactly(new RefsEnvelope.Ref("Memory", sharedDay.toString()));
        // W3.1b: the disclosure is per EPISODE, not per day — the collapse is a ref-budget device
        assertThat(recalled.items()).extracting(RecalledMemoriesEnvelope.Item::gist)
                .containsExactlyInAnyOrder("reggel futottam", "jó nap volt");
    }

    @Test
    void testRecall_shouldCapEachKindGroup_whenMoreMatchesThanCap() {
        UUID owner = userPopulator.createUser().getId();
        for (int i = 1; i <= 3; i++) {
            seed(owner, MemoryEmbeddingEntity.KIND_DAILY_SUMMARY, "összefoglaló " + i, TODAY.minusDays(i),
                    MemoryEmbeddingPopulator.axisVector(0));
        }
        seed(owner, MemoryEmbeddingEntity.KIND_JOURNAL_ENTRY, "napló 1", TODAY.minusDays(1), MemoryEmbeddingPopulator.axisVector(0));
        seed(owner, MemoryEmbeddingEntity.KIND_JOURNAL_ENTRY, "napló 2", TODAY.minusDays(2), MemoryEmbeddingPopulator.axisVector(0));
        seed(owner, MemoryEmbeddingEntity.KIND_GRATITUDE, "hála 1", TODAY.minusDays(3), MemoryEmbeddingPopulator.axisVector(0));
        seed(owner, MemoryEmbeddingEntity.KIND_CHAT_TURN, "Daniel: a\nMezo: b", TODAY.minusDays(1), MemoryEmbeddingPopulator.axisVector(0));
        seed(owner, MemoryEmbeddingEntity.KIND_CHAT_TURN, "Daniel: c\nMezo: d", TODAY.minusDays(2), MemoryEmbeddingPopulator.axisVector(0));

        AmbientRecall recalled = assembler.recall(owner, UUID.randomUUID(), AXIS0_QUERY, TODAY);

        String block = recalled.block();
        assertThat(block.split("\\(napi összefoglaló\\)", -1).length - 1).isEqualTo(2);   // daily-summary.cap
        assertThat(block).contains("összefoglaló 1").contains("összefoglaló 2").doesNotContain("összefoglaló 3");
        // the journal FAMILY shares journal.cap=2: the two fresher journal rows win over the older gratitude
        assertThat(block.split("\\(napló\\)", -1).length - 1 + block.split("\\(hála\\)", -1).length - 1).isEqualTo(2);
        assertThat(block).doesNotContain("hála 1");
        assertThat(block.split("\\(korábbi beszélgetés\\)", -1).length - 1).isEqualTo(1);      // chat-turn.cap
    }

    @Test
    void testRecall_shouldDropMatchesBelowFloorAndKeepMidMatches_whenGeometryStaged() {
        UUID owner = userPopulator.createUser().getId();
        seed(owner, MemoryEmbeddingEntity.KIND_JOURNAL_ENTRY, "ortogonális zaj", TODAY.minusDays(1),
                MemoryEmbeddingPopulator.axisVector(1));                       // similarity 0.0
        // similarity 0.4: pins the floor to (0.4, 0.707] — passes the TOOL's 0.25 floor
        // (recall.min-similarity) but must fail the journal group's 0.60 floor
        // (ambient-recall.journal.min-similarity); a typo that read `recall.minSimilarity()`
        // instead of `ambient.journal().minSimilarity()` in the assembler would let this row
        // through and this assertion would catch it.
        float[] weak = new float[EmbeddingPort.DIMENSIONS];
        weak[0] = 0.4f;
        weak[1] = (float) Math.sqrt(1 - 0.4 * 0.4);
        seed(owner, MemoryEmbeddingEntity.KIND_JOURNAL_ENTRY, "gyenge egyezés", TODAY.minusDays(1), weak);
        seed(owner, MemoryEmbeddingEntity.KIND_JOURNAL_ENTRY, "félig hasonló", TODAY.minusDays(1),
                MemoryEmbeddingPopulator.blendVector(0, 1));                   // similarity 0.707 ≥ 0.55

        AmbientRecall recalled = assembler.recall(owner, UUID.randomUUID(), AXIS0_QUERY, TODAY);

        assertThat(recalled.block()).contains("félig hasonló")
                .doesNotContain("ortogonális zaj")
                .doesNotContain("gyenge egyezés");
    }

    @Test
    void testRecall_shouldSkipTodaysEpisodes_whenSnapshotAlreadyCoversTheDay() {
        UUID owner = userPopulator.createUser().getId();
        seed(owner, MemoryEmbeddingEntity.KIND_JOURNAL_ENTRY, "ma írt napló", TODAY, MemoryEmbeddingPopulator.axisVector(0));
        seed(owner, MemoryEmbeddingEntity.KIND_DAILY_SUMMARY, "jövőbeli", TODAY.plusDays(1), MemoryEmbeddingPopulator.axisVector(0));

        AmbientRecall recalled = assembler.recall(owner, UUID.randomUUID(), AXIS0_QUERY, TODAY);

        assertThat(recalled).isSameAs(AmbientRecall.EMPTY);
    }

    @Test
    void testRecall_shouldOrderByDecayedScore_whenSameSimilarityDifferentAge() {
        UUID owner = userPopulator.createUser().getId();
        // 20 days: inside the W3.2 coverage window (ambient-recall.weekly-shadow-days = 30), so
        // this day is still asked for directly instead of through its weekly rung
        seed(owner, MemoryEmbeddingEntity.KIND_DAILY_SUMMARY, "régi nap", TODAY.minusDays(20), MemoryEmbeddingPopulator.axisVector(0));
        seed(owner, MemoryEmbeddingEntity.KIND_JOURNAL_ENTRY, "friss napló", TODAY.minusDays(2), MemoryEmbeddingPopulator.axisVector(0));

        AmbientRecall recalled = assembler.recall(owner, UUID.randomUUID(), AXIS0_QUERY, TODAY);

        assertThat(recalled.block().indexOf("friss napló")).isLessThan(recalled.block().indexOf("régi nap"));
    }

    @Test
    void testRecall_shouldReturnEmpty_whenUserHasNoMemories() {
        UUID owner = userPopulator.createUser().getId();

        assertThat(assembler.recall(owner, UUID.randomUUID(), AXIS0_QUERY, TODAY)).isSameAs(AmbientRecall.EMPTY);
    }

    @Test
    void testRecall_shouldReturnEmptyAndNotThrow_whenEmbeddingFails() {
        UUID owner = userPopulator.createUser().getId();
        seed(owner, MemoryEmbeddingEntity.KIND_JOURNAL_ENTRY, "lenne mit felidézni", TODAY.minusDays(1),
                MemoryEmbeddingPopulator.axisVector(0));

        AmbientRecall recalled = assembler.recall(owner, UUID.randomUUID(),
                FakeEmbeddingAdapter.FAIL_EMBED + " hogy aludtam?", TODAY);

        assertThat(recalled).isSameAs(AmbientRecall.EMPTY);
        // W3.1b: nothing to disclose either — a failed recall is silent, not a half-filled row
        assertThat(recalled.items()).isEmpty();
    }

    @Test
    void testRecall_shouldReturnEmptyAndNotThrow_whenAnnQueryFails() {
        UUID owner = userPopulator.createUser().getId();
        seed(owner, MemoryEmbeddingEntity.KIND_JOURNAL_ENTRY, "lenne mit felidézni", TODAY.minusDays(1),
                MemoryEmbeddingPopulator.axisVector(0));

        // the embed hop SUCCEEDS but returns a 3-dim vector — the ANN statement dies at the DB
        AmbientRecall recalled = assembler.recall(owner, UUID.randomUUID(),
                FakeEmbeddingAdapter.FAIL_ANN + " hogy aludtam?", TODAY);

        assertThat(recalled).isSameAs(AmbientRecall.EMPTY);
        assertThat(recalled.items()).isEmpty();
        // …and the savepoint rollback left THIS (test-managed) transaction healthy — a poisoned
        // one would fail here with "current transaction is aborted" instead of counting the seed
        assertThat(memoryEmbeddingRepository.count()).isEqualTo(1);
    }

    @Test
    void testRecallStrict_shouldExposeFailure_whenAnnQueryFails() {
        UUID owner = userPopulator.createUser().getId();
        seed(owner, MemoryEmbeddingEntity.KIND_JOURNAL_ENTRY, "lenne mit felidézni", TODAY.minusDays(1),
                MemoryEmbeddingPopulator.axisVector(0));

        assertThatThrownBy(() -> assembler.recallStrict(
                owner, UUID.randomUUID(), FakeEmbeddingAdapter.FAIL_ANN + " hogy aludtam?", TODAY))
                .isInstanceOf(RuntimeException.class);
    }

    @Test
    void testRecall_shouldReturnEmpty_whenMessageBlank() {
        UUID owner = userPopulator.createUser().getId();

        assertThat(assembler.recall(owner, UUID.randomUUID(), "   ", TODAY)).isSameAs(AmbientRecall.EMPTY);
    }

    @Test
    void testRecall_shouldSkipOwnConversationsChatTurns_whenTheyAreAlreadyInTheHistoryWindow() {
        UUID owner = userPopulator.createUser().getId();
        AiConversationEntity current = aiConversationPopulator.conversation(owner);
        AiConversationEntity older = aiConversationPopulator.conversation(owner);
        AiMessageEntity ownTurn = aiMessagePopulator.message(current, AiMessageEntity.ROLE_ASSISTANT, "saját válasz");
        AiMessageEntity otherTurn = aiMessagePopulator.message(older, AiMessageEntity.ROLE_ASSISTANT, "régi válasz");
        memoryEmbeddingPopulator.embedding(owner, MemoryEmbeddingEntity.KIND_CHAT_TURN, ownTurn.getId(),
                "Daniel: ma\nMezo: saját", TODAY.minusDays(1), MemoryEmbeddingPopulator.axisVector(0));
        memoryEmbeddingPopulator.embedding(owner, MemoryEmbeddingEntity.KIND_CHAT_TURN, otherTurn.getId(),
                "Daniel: régen\nMezo: régi", TODAY.minusDays(2), MemoryEmbeddingPopulator.axisVector(0));

        AmbientRecall recalled = assembler.recall(owner, current.getId(), AXIS0_QUERY, TODAY);

        // chat-turn.cap is 1 and the own turn is fresher (higher decayed score) — only the
        // exclusion can make the older conversation's turn win
        assertThat(recalled.block()).contains("Daniel: régen").doesNotContain("Daniel: ma");
    }
}
