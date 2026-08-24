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
 * (fake embedder, hand-seeded vectors), so it is the regression net for
 * {@code mezo.companion.ambient-recall.*} tuning: move a floor, a cap or a τ in yml, run this
 * class, and read the table to see which memories moved in, out, or around.
 *
 * <p><b>Geometry legend</b> — every query is a bare axis, so a row's cosine similarity to it is
 * simply that row's component on the queried axis:
 * <pre>
 *   axis 0 = "alvás/futás"   axis 1 = "munka/app"   axis 2 = "fesztivál"
 *   axis 3 = "rossz kedv"    axis 4 = queried by nobody's memory (the empty-recall row)
 *
 *   tilted(axis, c)          sim c to that axis, 0 to every other QUERIED axis — the remainder
 *                            rides on {@link #FILLER_AXIS}, which no query ever touches, so a
 *                            tilted row answers exactly one case and the table stays local
 *   spanning(a, c, b)        sim c to axis a and sqrt(1-c²) to axis b — the only rows that answer
 *                            TWO queries: the 0.58/0.815 pair below and the weekly's 45° blend
 * </pre>
 *
 * <p><b>Scoring</b>: {@code score = similarity × exp(-ageDays / τ_group)}; the floor is applied to
 * the RAW similarity; the block is one global score-ordered list across groups. Live tuning
 * (application.yml): daily-summary 2 / 0.55 / τ90, period-summary 2 / 0.55 / τ180, journal
 * 2 / 0.60 / τ90, chat-turn 1 / 0.55 / τ90, other 1 / 0.55 / τ90, {@code weekly-shadow-days: 30}
 * (older daily summaries are not even asked for), {@code candidate-pool: 20} — applied per
 * kind-group, and the largest group here is 7 rows, so the pool never truncates. Every ordering
 * decision below has ≥0.021 of headroom and every
 * floor/cap decision ≥0.017 — orders of magnitude above float4 noise (~1e-7).
 *
 * <p><b>What this table pins.</b> Every entry below was verified by MUTATION: the knob was moved
 * on the command line ({@code ./mvnw test -Dtest=AmbientRecallEvalIT
 * -Dmezo.companion.ambient-recall.<knob>=<value>}) and this class was confirmed to go red.
 * <ul>
 *   <li>ALL FIVE {@code cap}s, in BOTH directions — each group has one above-floor candidate
 *       deliberately cut by its cap ("Beszélgetés: futócipőről.", "Check-in: reggeli nyújtás.",
 *       "Nap: futópad, fáradtan.", "Napló: kód és kávé.", "Hónap: nyári fesztiválszezon."): raise
 *       the cap and it appears, lower it and that group's last kept item vanishes.</li>
 *   <li>{@code daily-summary.min-similarity} → pinned to (0.52, 0.62]. Both sides: the 0.62 day is
 *       recalled (0.63 goes red), and the 0.52 day is fresh enough to OUTSCORE it, so lowering the
 *       floor does not merely add a row — it TAKES the 0.62 day's slot (0.45 goes red).</li>
 *   <li>{@code journal.min-similarity} → pinned to (0.58, 0.66] (0.57 and 0.67 both go red).</li>
 *   <li>{@code period/chat/other.min-similarity} from ABOVE only — their kept rows sit at 0.66, so
 *       0.70 goes red.</li>
 *   <li>{@code period-summary.decay-days} 180: at τ90 the 80-day monthly falls below the 28-day
 *       day and case 3 reorders — the documented 180→90 move is exactly the tripwire.</li>
 *   <li>{@code daily-summary.decay-days} 90 from above: at τ180 case 3's day climbs over the
 *       weekly rung.</li>
 *   <li>{@code weekly-shadow-days} 30 — the 75-day festival day is invisible; at 90 case 3 gains it.</li>
 * </ul>
 * <b>What it does NOT pin</b>, stated so nobody reads more into a green run than is there:
 * {@code journal/chat-turn/other.decay-days} (verified unchanged across τ 45…180 — every ordering
 * they take part in has more headroom than that); the period/chat/other floors from BELOW; and the
 * journal floor at exactly 0.58, since the seeded 0.58 is {@code 0.58f} = 0.5799999 and so still
 * reads as "under" a 0.58 floor.
 */
@Transactional
@ActiveProfiles("companion-fake")
class AmbientRecallEvalIT extends AbstractIntegrationTest {

    private static final LocalDate TODAY = LocalDate.now();

    /** Carries the "rest" of a {@link #tilted} unit vector. No query has a component here. */
    private static final int FILLER_AXIS = 9;

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
            new Case("alvás/futás: one hit per group by decayed score, then the 0.62 day scrapes in",
                "[fake-embed:1] hogy aludtam futás után?",
                List.of("Napló: futás után jobban aludtam.",             // journal 1.00 @3  → 0.967
                        "Nap: hosszú futás, korai lefekvés.",            // daily   1.00 @11 → 0.885
                        "Jegyzet: esti séta, jó alvás.",                 // other   0.66 @2  → 0.645
                        "Beszélgetés: alvásról.",                        // chat    0.66 @5  → 0.624
                        "Hét: futóhét és sok munka, rendezett alvás.",   // weekly  0.707 @40 τ180 → 0.566
                        "Nap: rövid futás, késői lefekvés.")),           // daily   0.62 @20 → 0.496
                        // OUT: "Nap: pihenőnap, semmi mozgás." sim 0.52 < the daily floor 0.55 —
                        //      and it scores 0.514, ABOVE the 0.62 day, so the floor is what holds
                        //      it back; "Napló: fejleszteni…" sim 0.58 < the journal floor 0.60
                        //      (it would score 0.555, i.e. between the weekly and the 0.62 day)
            new Case("munka/app: the app-day leads, the two best journals follow, then the shared rung",
                "[fake-embed:0 1] mi volt az appal?",
                List.of("Nap: egész nap kódolás.",                       // daily   1.00 @6  → 0.936
                        "Napló: fejleszteni az applikációt.",            // journal 0.815 @4 → 0.779
                        "Napló: refaktorálás, elégedettség.",            // journal 0.66 @2  → 0.645
                        "Hét: futóhét és sok munka, rendezett alvás.")), // weekly  0.707 @40 τ180 → 0.566
                        // CUT by journal cap 2: "Napló: kód és kávé." (0.66 @20 → 0.528)
            new Case("fesztivál: the shadowed stretch answers through two rungs, then a day inside the window",
                "[fake-embed:0 0 1] mi volt a fesztiválon?",
                List.of("Hónap: fesztiválhónap, kevés alvás.",           // monthly 1.00 @80 τ180 → 0.641
                        "Hét: fesztiválhét, kevés alvás.",               // weekly  0.66 @45 τ180 → 0.514
                        "Nap: fesztivál utáni pihenés.")),               // daily   0.66 @28 → 0.484
                        // τ180 is what keeps the monthly on top: at τ90 it drops to 0.411, BELOW
                        // the day — this row is the period-τ tripwire.
                        // OUT: "Nap: fesztivál első napja." (1.00 @75) is past weekly-shadow-days 30
                        //      → never queried; "Napló: fesztivál…" sim 0.58 < the journal floor
            new Case("rossz kedv: only the journal line that leans on that axis survives",
                "[fake-embed:0 0 0 1] valami rossz hangulat",
                List.of("Napló: fesztivál… nincs kedvem.")),             // journal 0.815 @70 → 0.374
            new Case("unrelated axis: nothing clears any floor → no block at all",
                "[fake-embed:0 0 0 0 1] valami teljesen más",
                List.of())
        );
    }

    private void seed(UUID owner, String kind, String content, int daysAgo, float[] vector) {
        memoryEmbeddingPopulator.embedding(owner, kind, UUID.randomUUID(), content,
                TODAY.minusDays(daysAgo), vector);
    }

    /** Unit vector with {@code cosine} on {@code axis} and the remainder on {@link #FILLER_AXIS}. */
    private float[] tilted(int axis, double cosine) {
        return spanning(axis, cosine, FILLER_AXIS);
    }

    /** Unit vector with {@code cosine} on {@code axis} and the remainder on {@code otherAxis}. */
    private float[] spanning(int axis, double cosine, int otherAxis) {
        float[] vector = new float[EmbeddingPort.DIMENSIONS];
        vector[axis] = (float) cosine;
        vector[otherAxis] = (float) Math.sqrt(1 - cosine * cosine);
        return vector;
    }

    /**
     * The corpus every case runs against — one place, so the table above stays readable. Each row is
     * (kind, gist, age in days, vector); the comment gives its similarity to the query it answers
     * and why it is kept, cut or dropped.
     */
    private UUID seedCorpus() {
        UUID owner = userPopulator.createUser().getId();

        // ── alvás/futás (axis 0) — one kept hit per group plus, per group, one candidate the CAP
        //    must cut, and the two rows the daily/journal FLOORS must hold back
        seed(owner, MemoryEmbeddingEntity.KIND_JOURNAL_ENTRY, "Napló: futás után jobban aludtam.", 3,
                tilted(0, 1.00));
        seed(owner, MemoryEmbeddingEntity.KIND_DAILY_SUMMARY, "Nap: hosszú futás, korai lefekvés.", 11,
                tilted(0, 1.00));
        seed(owner, MemoryEmbeddingEntity.KIND_ACTIVITY_NOTE, "Jegyzet: esti séta, jó alvás.", 2,
                tilted(0, 0.66));
        seed(owner, MemoryEmbeddingEntity.KIND_CHAT_TURN, "Beszélgetés: alvásról.\nMezo: igen", 5,
                tilted(0, 0.66));
        seed(owner, MemoryEmbeddingEntity.KIND_DAILY_SUMMARY, "Nap: rövid futás, késői lefekvés.", 20,
                tilted(0, 0.62));                                   // the last item that fits
        seed(owner, MemoryEmbeddingEntity.KIND_CHAT_TURN, "Beszélgetés: futócipőről.", 12,
                tilted(0, 0.66));                                   // cut: chat-turn cap 1
        seed(owner, MemoryEmbeddingEntity.KIND_CHECKIN_NOTE, "Check-in: reggeli nyújtás.", 20,
                tilted(0, 0.66));                                   // cut: other cap 1
        seed(owner, MemoryEmbeddingEntity.KIND_DAILY_SUMMARY, "Nap: futópad, fáradtan.", 28,
                tilted(0, 0.62));                                   // cut: daily-summary cap 2
        seed(owner, MemoryEmbeddingEntity.KIND_DAILY_SUMMARY, "Nap: pihenőnap, semmi mozgás.", 1,
                tilted(0, 0.52));                                   // dropped: daily floor 0.55 —
                                                                    // its 0.514 would take a slot

        // ── the two rows that span two real axes, so they answer two of the cases
        seed(owner, MemoryEmbeddingEntity.KIND_WEEKLY_SUMMARY,
                "Hét: futóhét és sok munka, rendezett alvás.", 40,
                MemoryEmbeddingPopulator.blendVector(0, 1));        // sim 0.707 to axis 0 AND axis 1
        // the lived-with 2026-08-22 case: only WEAKLY (0.58) about sleep — below the journal floor —
        // but strongly (0.815) about the app
        seed(owner, MemoryEmbeddingEntity.KIND_JOURNAL_ENTRY, "Napló: fejleszteni az applikációt.", 4,
                spanning(0, 0.58, 1));

        // ── munka/app (axis 1) — pins the journal cap: three candidates clear 0.60, two survive
        seed(owner, MemoryEmbeddingEntity.KIND_DAILY_SUMMARY, "Nap: egész nap kódolás.", 6,
                tilted(1, 1.00));
        seed(owner, MemoryEmbeddingEntity.KIND_JOURNAL_ENTRY, "Napló: refaktorálás, elégedettség.", 2,
                tilted(1, 0.66));                                   // the 0.66 that pins the floor
        seed(owner, MemoryEmbeddingEntity.KIND_JOURNAL_ENTRY, "Napló: kód és kávé.", 20,
                tilted(1, 0.66));                                   // cut: journal cap 2

        // ── fesztivál (axis 2) — an OLD stretch: the fine-grained day is shadowed, the ladder speaks,
        //    and the period τ decides who leads
        seed(owner, MemoryEmbeddingEntity.KIND_MONTHLY_SUMMARY, "Hónap: fesztiválhónap, kevés alvás.", 80,
                tilted(2, 1.00));
        seed(owner, MemoryEmbeddingEntity.KIND_WEEKLY_SUMMARY, "Hét: fesztiválhét, kevés alvás.", 45,
                tilted(2, 0.66));
        seed(owner, MemoryEmbeddingEntity.KIND_DAILY_SUMMARY, "Nap: fesztivál utáni pihenés.", 28,
                tilted(2, 0.66));                                   // inside the 30-day window
        seed(owner, MemoryEmbeddingEntity.KIND_MONTHLY_SUMMARY, "Hónap: nyári fesztiválszezon.", 120,
                tilted(2, 0.66));                                   // cut: period-summary cap 2
        seed(owner, MemoryEmbeddingEntity.KIND_DAILY_SUMMARY, "Nap: fesztivál első napja.", 75,
                tilted(2, 1.00));                                   // shadowed: 75 d > 30 d, not asked
        // 0.58 about the festival (below the journal floor) but 0.815 about the bad mood (axis 3)
        seed(owner, MemoryEmbeddingEntity.KIND_JOURNAL_ENTRY, "Napló: fesztivál… nincs kedvem.", 70,
                spanning(2, 0.58, 3));
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
