package io.mrkuhne.mezo.feature.companion;

import io.mrkuhne.mezo.feature.companion.entity.MemoryEmbeddingEntity;
import io.mrkuhne.mezo.feature.companion.entity.RecalledMemoriesEnvelope;
import io.mrkuhne.mezo.feature.companion.service.PromptMemoryAssembler;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.MemoryEmbeddingPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * W3.3 (mezo-b3pp.14, spec §7.3) — the ambient-recall EVAL HARNESS: a fixed, hand-crafted vector
 * corpus and a TABLE of (query → expected gists in prompt order). Provider-free and deterministic
 * (fake embedder, axis/blend vectors), so it is the regression net for every future
 * {@code mezo.companion.ambient-recall.*} tuning: move a floor or a τ in yml, run this class, and
 * read the table to see which memories moved in, out, or around.
 *
 * <p><b>Geometry legend</b> — every corpus vector is a unit vector on axes 0..3 (or a 45° blend),
 * and every query is an axis, so cosine similarity is just the seeded vector's component on the
 * queried axis:
 * <pre>
 *   axis 0 = "alvás/futás"   axis 1 = "munka/app"   axis 2 = "fesztivál"   axis 3 = "zaj"
 *
 *   axisVector(i)   sim 1.00 to axis i, 0.00 to every other axis
 *   blendVector(a,b) sim 0.707 to axis a AND to axis b — above every floor (0.55 / 0.60)
 *   weak(a,b) = 0.58·axis a + 0.815·axis b — the lived-with 2026-08-22 shape: 0.58 is BELOW the
 *              journal floor 0.60 (so it stays out of an axis-a query) while 0.815 is well above
 *              it (so the same row IS recalled by an axis-b query)
 * </pre>
 *
 * <p><b>Scoring</b>: {@code score = similarity × exp(-ageDays / τ_group)}, the floor is applied to
 * the RAW similarity, and the block is one global score-ordered list across groups. Live tuning
 * (application.yml): daily-summary 2 / 0.55 / τ 90, period-summary 2 / 0.55 / τ 180, journal
 * 2 / 0.60 / τ 90, chat-turn 1 / 0.55 / τ 90, other 1 / 0.55 / τ 90; {@code weekly-shadow-days: 30}
 * — daily summaries older than 30 days are not even asked for, their consolidation rung answers.
 * Ages are chosen so decay decides every tie deterministically (no two scores are within 0.05).
 */
@Transactional
@ActiveProfiles("companion-fake")
class AmbientRecallEvalIT extends AbstractIntegrationTest {

    private static final LocalDate TODAY = LocalDate.now();

    @Autowired private PromptMemoryAssembler assembler;
    @Autowired private MemoryEmbeddingPopulator memoryEmbeddingPopulator;
    @Autowired private UserPopulator userPopulator;

    /** One row of the tuning table. */
    record Case(String name, String query, List<String> expectedGistsInOrder) {
        @Override public String toString() { return name; }
    }

    /** THE TABLE — readable top-down: query → what the [Emlékek] block must carry, in order. */
    static Stream<Case> table() {
        return Stream.of(
            new Case("alvás/futás query: note + journal + chat + day, freshest-first, then the weekly rung",
                "[fake-embed:1] hogy aludtam futás után?",
                List.of("Jegyzet: esti séta, jó alvás.",       // other,   2 d, sim 1.00 → 0.978
                        "Napló: futás után jobban aludtam.",    // journal, 3 d, sim 1.00 → 0.967
                        "Beszélgetés: alvásról.",               // chat,    5 d, sim 1.00 → 0.946
                        "Nap: hosszú futás, korai lefekvés.",   // daily,  10 d, sim 1.00 → 0.895
                        "Hét: futóhét, rendezett alvás.")),     // weekly, 40 d, sim 0.707, τ180 → 0.566
                        // OUT: "Napló: fejleszteni…" sim 0.58 < the journal floor 0.60
            new Case("munka/app query: the app-day leads, the weakly-related journal follows, then the rung",
                "[fake-embed:0 1] mi volt az appal?",
                List.of("Nap: egész nap kódolás.",              // daily,   6 d, sim 1.00 → 0.936
                        "Napló: fejleszteni az applikációt.",   // journal, 4 d, sim 0.815 → 0.779
                        "Hét: futóhét, rendezett alvás.")),     // weekly, 40 d, sim 0.707, τ180 → 0.566
            new Case("fesztivál query: the old stretch speaks through its monthly rung alone",
                "[fake-embed:0 0 1] mi volt a fesztiválon?",
                List.of("Hónap: fesztiválhónap, kevés alvás.")),// monthly, 80 d, sim 1.00, τ180 → 0.641
                        // OUT: the 75-day "Nap: fesztivál első napja." is beyond weekly-shadow-days 30
                        //      → never queried; "Napló: fesztivál…" sim 0.58 < the journal floor 0.60
            new Case("zaj query: only the journal line that leans on the noise axis survives",
                "[fake-embed:0 0 0 1] valami teljesen más",
                List.of("Napló: fesztivál… nincs kedvem."))     // journal, 70 d, sim 0.815 → 0.374
        );
    }

    private void seed(UUID owner, String kind, String content, int daysAgo, float[] vector) {
        memoryEmbeddingPopulator.embedding(owner, kind, UUID.randomUUID(), content,
                TODAY.minusDays(daysAgo), vector);
    }

    /** A unit vector 0.58 along {@code weakAxis} and the remainder along {@code strongAxis}. */
    private static float[] weakVector(int weakAxis, int strongAxis) {
        float[] vector = new float[EmbeddingPort.DIMENSIONS];
        vector[weakAxis] = 0.58f;
        vector[strongAxis] = (float) Math.sqrt(1 - 0.58 * 0.58);
        return vector;
    }

    /** The corpus every case runs against — one place, so the table above stays readable. */
    private UUID seedCorpus() {
        UUID owner = userPopulator.createUser().getId();
        float[] a0 = MemoryEmbeddingPopulator.axisVector(0);
        float[] a1 = MemoryEmbeddingPopulator.axisVector(1);
        float[] a2 = MemoryEmbeddingPopulator.axisVector(2);

        // alvás/futás family — one unit per group, ages spread so decay orders them
        seed(owner, MemoryEmbeddingEntity.KIND_ACTIVITY_NOTE, "Jegyzet: esti séta, jó alvás.", 2, a0);
        seed(owner, MemoryEmbeddingEntity.KIND_JOURNAL_ENTRY, "Napló: futás után jobban aludtam.", 3, a0);
        seed(owner, MemoryEmbeddingEntity.KIND_CHAT_TURN, "Beszélgetés: alvásról.\nMezo: igen", 5, a0);
        seed(owner, MemoryEmbeddingEntity.KIND_DAILY_SUMMARY, "Nap: hosszú futás, korai lefekvés.", 10, a0);
        seed(owner, MemoryEmbeddingEntity.KIND_WEEKLY_SUMMARY, "Hét: futóhét, rendezett alvás.", 40,
                MemoryEmbeddingPopulator.blendVector(0, 1));
        // munka/app family — the 2026-08-22 lived-with case: a journal line only WEAKLY (0.58) about
        // sleep, but strongly (0.815) about the app
        seed(owner, MemoryEmbeddingEntity.KIND_JOURNAL_ENTRY, "Napló: fejleszteni az applikációt.", 4,
                weakVector(0, 1));
        seed(owner, MemoryEmbeddingEntity.KIND_DAILY_SUMMARY, "Nap: egész nap kódolás.", 6, a1);
        // fesztivál family — old, so the daily is shadowed (weekly-shadow-days 30) and the rung answers
        seed(owner, MemoryEmbeddingEntity.KIND_DAILY_SUMMARY, "Nap: fesztivál első napja.", 75, a2);
        seed(owner, MemoryEmbeddingEntity.KIND_MONTHLY_SUMMARY, "Hónap: fesztiválhónap, kevés alvás.", 80, a2);
        seed(owner, MemoryEmbeddingEntity.KIND_JOURNAL_ENTRY, "Napló: fesztivál… nincs kedvem.", 70,
                weakVector(2, 3));
        return owner;
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("table")
    void testRecall_shouldMatchTheTuningTable_whenTheEvalCorpusIsSeeded(Case c) {
        UUID owner = seedCorpus();

        PromptMemoryAssembler.AmbientRecall recalled =
                assembler.recall(owner, UUID.randomUUID(), c.query(), TODAY);

        assertThat(recalled.items()).extracting(RecalledMemoriesEnvelope.Item::gist)
                .containsExactlyElementsOf(c.expectedGistsInOrder());
    }
}
