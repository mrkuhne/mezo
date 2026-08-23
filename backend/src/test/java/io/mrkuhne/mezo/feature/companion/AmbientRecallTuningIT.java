package io.mrkuhne.mezo.feature.companion;

import io.mrkuhne.mezo.feature.companion.entity.MemoryEmbeddingEntity;
import io.mrkuhne.mezo.feature.companion.entity.RecalledMemoriesEnvelope;
import io.mrkuhne.mezo.feature.companion.service.PromptMemoryAssembler;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.MemoryEmbeddingPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * W3.3 (mezo-b3pp.14) acceptance "config-only tuning verified": the SAME corpus the default yml
 * renders one way renders another under overridden per-group knobs — no code path changes, only
 * {@code mezo.companion.ambient-recall.<group>.*}. Journal floor raised to 0.8 (a 0.707 journal
 * hit drops while the 0.707 daily stays); chat-turn τ shrunk to 2 days (an old chat turn sinks
 * below a same-similarity, older-by-less daily).
 */
@Transactional
@ActiveProfiles("companion-fake")
@TestPropertySource(properties = {
        "mezo.companion.ambient-recall.journal.min-similarity=0.8",
        "mezo.companion.ambient-recall.chat-turn.decay-days=2"
})
class AmbientRecallTuningIT extends AbstractIntegrationTest {

    private static final String AXIS0_QUERY = "[fake-embed:1] alvás";
    private static final LocalDate TODAY = LocalDate.now();

    @Autowired private PromptMemoryAssembler assembler;
    @Autowired private MemoryEmbeddingPopulator memoryEmbeddingPopulator;
    @Autowired private UserPopulator userPopulator;

    /**
     * Under the DEFAULT config (journal min-similarity 0.60), both the 0.707 journal hit and the
     * 0.707 daily hit would clear their group floors and render together. With the journal floor
     * overridden to 0.8 here, only the journal hit drops — the daily hit (unaffected group) stays.
     */
    @Test
    void testRecall_shouldDropJournalBelowRaisedFloorButKeepDaily_whenJournalFloorOverridden() {
        UUID owner = userPopulator.createUser().getId();
        float[] blend = MemoryEmbeddingPopulator.blendVector(0, 1);            // sim 0.707
        memoryEmbeddingPopulator.embedding(owner, MemoryEmbeddingEntity.KIND_JOURNAL_ENTRY, UUID.randomUUID(),
                "napló 0.707", TODAY.minusDays(1), blend);
        memoryEmbeddingPopulator.embedding(owner, MemoryEmbeddingEntity.KIND_DAILY_SUMMARY, UUID.randomUUID(),
                "nap 0.707", TODAY.minusDays(1), blend);

        PromptMemoryAssembler.AmbientRecall recalled = assembler.recall(owner, UUID.randomUUID(), AXIS0_QUERY, TODAY);

        assertThat(recalled.items()).extracting(RecalledMemoriesEnvelope.Item::gist)
                .containsExactly("nap 0.707");
    }

    /**
     * Under the DEFAULT config (chat-turn decay-days 90), the 4-day-old chat turn (score
     * e^(-4/90) ≈ 0.957) would outrank the 8-day-old daily summary (e^(-8/90) ≈ 0.915) and render
     * first. With chat-turn decay-days overridden to 2, the chat turn's score collapses to
     * e^(-4/2) ≈ 0.135, sinking it below the daily summary.
     */
    @Test
    void testRecall_shouldSinkChatTurnBelowOlderDaily_whenChatTurnDecayOverridden() {
        UUID owner = userPopulator.createUser().getId();
        float[] a0 = MemoryEmbeddingPopulator.axisVector(0);
        // chat turn 4 d old: τ=2 ⇒ score e^-2 ≈ 0.135; daily 8 d old: τ=90 ⇒ e^(-8/90) ≈ 0.915
        memoryEmbeddingPopulator.embedding(owner, MemoryEmbeddingEntity.KIND_CHAT_TURN, UUID.randomUUID(),
                "Daniel: friss beszélgetés", TODAY.minusDays(4), a0);
        memoryEmbeddingPopulator.embedding(owner, MemoryEmbeddingEntity.KIND_DAILY_SUMMARY, UUID.randomUUID(),
                "régebbi nap", TODAY.minusDays(8), a0);

        PromptMemoryAssembler.AmbientRecall recalled = assembler.recall(owner, UUID.randomUUID(), AXIS0_QUERY, TODAY);

        assertThat(recalled.items()).extracting(RecalledMemoriesEnvelope.Item::gist)
                .containsExactly("régebbi nap", "Daniel: friss beszélgetés");
    }
}
