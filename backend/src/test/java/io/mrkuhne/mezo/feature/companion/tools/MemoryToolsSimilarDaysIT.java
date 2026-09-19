package io.mrkuhne.mezo.feature.companion.tools;

import static io.mrkuhne.mezo.support.populator.MemoryEmbeddingPopulator.axisVector;
import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryItemEntity;
import io.mrkuhne.mezo.feature.companion.memory.entity.MemoryProvenanceEnvelope;
import io.mrkuhne.mezo.feature.companion.memory.repository.MemoryRetrievalRunRepository;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.MemoryItemPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.model.ToolContext;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;

/**
 * Memória mindenhol S10 (bd mezo-eq85.10): {@code find_similar_past_days} moved off the retired
 * V2.3 {@code MemoryRecallService} onto {@link io.mrkuhne.mezo.feature.companion.memory.service.MemoryContextService}
 * under the {@code SIMILAR_DAYS} policy — seeded via {@code memory_item}/{@code memory_vector}
 * only (no {@code memory_embedding} row exists), same shape {@link MemoryObservatorySimilarDaysIT}
 * exercises for the endpoint. Deliberately NOT class-level {@code @Transactional}: the retrieval
 * fans out across {@code applicationTaskExecutor}, each retriever on its own pooled JDBC
 * connection — wrapping the test in an outer transaction risks the pool-exhaustion hang the S7/S8
 * hazard note describes.
 */
@ActiveProfiles("companion-fake")
class MemoryToolsSimilarDaysIT extends AbstractIntegrationTest {

    private static final String VERSION = "gemini-embedding-001-768-v1";
    /** The fake port maps {@code [fake-embed:1]} to the 0. axis — cosine is hand-computable. */
    private static final String QUERY = "[fake-embed:1] rossz alvás edzés után";
    /** Shares no trigram with {@link #QUERY}: only the dense retriever can ever reach this text. */
    private static final String LEXICALLY_INERT = "Qxwj zvbk pmhg tdfl kryn.";

    @Autowired private MemoryTools memoryTools;
    @Autowired private MemoryItemPopulator memoryItemPopulator;
    @Autowired private MemoryRetrievalRunRepository runRepository;
    @Autowired private UserPopulator userPopulator;

    private ToolCallAudit audit;

    private ToolContext ctx(UUID userId) {
        audit = new ToolCallAudit(6, 10);
        return new ToolContext(Map.of(ToolContexts.USER_ID, userId, ToolContexts.AUDIT, audit));
    }

    @Test
    void testFindSimilarPastDays_shouldRenderOnlyDailySummaryDays_whenMemoryItemAndVectorAreSeeded() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate day = LocalDate.now().minusDays(4);
        item(owner, "daily_summary", "Kemény leg-day volt, utána rossz alvás.", day, axisVector(0));
        // A same-vector (perfect cosine match), but NON-daily_summary item — proves the
        // source-kind filter actually runs, not just "something came back": without it this
        // would be an equally strong candidate and would leak into the rendered output.
        item(owner, "journal_entry", "IDEGEN-NAPLO-SZOVEG", day.minusDays(1), axisVector(0));

        String out = memoryTools.findSimilarPastDays("[fake-embed:1] rossz alvás edzés után", 2, ctx(owner));

        assertThat(out).contains("Hasonló korábbi napok")
                .contains(day.toString())
                .contains("Kemény leg-day volt, utána rossz alvás.")
                .doesNotContain("IDEGEN-NAPLO-SZOVEG")
                .doesNotContain("egyezés")
                .doesNotContain("%");
        assertThat(audit.toRefsEnvelope().refs())
                .anySatisfy(ref -> {
                    assertThat(ref.kind()).isEqualTo("Memory");
                    assertThat(ref.id()).isEqualTo(day.toString());
                });
        assertThat(runRepository.findAll()).filteredOn(run -> owner.equals(run.getCreatedBy()))
                .anySatisfy(run -> assertThat(run.getConsumerPolicy()).isEqualTo("SIMILAR_DAYS"));
    }

    /**
     * mezo-eq85.10 fix round 1, FIX 1 — the reviewer's proof. The retrieval itself must be scoped
     * to {@code daily_summary}; filtering only in the mapping is too late, because
     * {@code MemoryContextSelector} has already spent the ~600-token budget on non-day hits (in
     * production, overwhelmingly {@code chat_turn}). Twelve long, lexically-and-densely stronger
     * journal entries fill the budget several times over; the ONE matching day is last in the
     * fused rank and never survives selection under the wrong order.
     */
    @Test
    void testFindSimilarPastDays_shouldStillFindTheDay_whenNonDayHitsWouldFillTheWholeTokenBudget() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate day = LocalDate.now().minusDays(40);
        // The day is deliberately the LONGEST body of the lot: the selector skips an over-budget
        // candidate and keeps trying shorter ones, so a short day line would squeeze into the
        // leftover slack and hide the defect. Nothing may be able to rescue it but the kind scoping.
        item(owner, "daily_summary", body("hegyinap", 44), day, axisVector(0));
        // Newer, same-vector, ALSO lexically matching: each one outranks the day in both retrievers,
        // and three of them alone exhaust the SIMILAR_DAYS 600-token budget.
        for (int i = 0; i < 12; i++) {
            item(owner, "journal_entry", "rossz alvas edzes utan " + body("naploszo" + i, 35),
                    LocalDate.now().minusDays(i + 1L), axisVector(0));
        }

        String out = memoryTools.findSimilarPastDays(QUERY, 2, ctx(owner));

        assertThat(out).contains("hegyinapx0 ").doesNotContain("naploszo");
    }

    /** A long body of words unique to {@code stem}, so nothing near-duplicates anything else. */
    private static String body(String stem, int words) {
        StringBuilder text = new StringBuilder();
        for (int word = 0; word < words; word++) {
            text.append(stem).append('x').append(word).append(' ');
        }
        return text.toString();
    }

    @Test
    void testFindSimilarPastDays_shouldRenderNoData_whenDescriptionMissing() {
        UUID owner = userPopulator.createUser().getId();

        // 'required' is schema-advertised only — an omitting model must get an honest no-data,
        // not a TOOL_FAILED internal error from an NPE deep in the retrieval path.
        assertThat(memoryTools.findSimilarPastDays(null, 2, ctx(owner)))
                .isEqualTo("Hasonló korábbi napok: nincs adat");
        assertThat(memoryTools.findSimilarPastDays("   ", 2, ctx(owner)))
                .isEqualTo("Hasonló korábbi napok: nincs adat");
    }

    @Test
    void testFindSimilarPastDays_shouldRenderNoData_whenNothingMatches() {
        UUID owner = userPopulator.createUser().getId();

        String out = memoryTools.findSimilarPastDays("[fake-embed:1] bármi", null, ctx(owner));

        assertThat(out).isEqualTo("Hasonló korábbi napok: nincs adat");
        assertThat(audit.toRefsEnvelope()).isNull();
    }

    /**
     * mezo-eq85.10 fix round 1, FIX 2 — the restored raw-similarity floor (the equivalent of the
     * deleted {@code testSearchSimilarDays_shouldReturnEmptyList_whenNothingAboveFloor}). The day
     * below {@code mezo.companion.recall.min-similarity} (0.25) is a fabricated resemblance, not a
     * memory: an honest "nincs adat" beats it. The day's text shares not one TRIGRAM with the
     * query, so the lexical retriever's own honest {@code score > 0} floor already excludes it —
     * the dense cosine is the only thing that can reach this row, which is what makes the test
     * decisive about the floor rather than about lexical luck.
     */
    @Test
    void testFindSimilarPastDays_shouldRenderNoData_whenTheOnlyDayIsBelowTheSimilarityFloor() {
        UUID owner = userPopulator.createUser().getId();
        item(owner, "daily_summary", LEXICALLY_INERT, LocalDate.now().minusDays(4), cosineVector(0.20f));

        assertThat(memoryTools.findSimilarPastDays(QUERY, 2, ctx(owner)))
                .isEqualTo("Hasonló korábbi napok: nincs adat");
    }

    /** The control for the floor test: the very same day, just above 0.25, must still come back. */
    @Test
    void testFindSimilarPastDays_shouldRenderTheDay_whenItIsAboveTheSimilarityFloor() {
        UUID owner = userPopulator.createUser().getId();
        item(owner, "daily_summary", LEXICALLY_INERT, LocalDate.now().minusDays(4), cosineVector(0.40f));

        assertThat(memoryTools.findSimilarPastDays(QUERY, 2, ctx(owner))).contains(LEXICALLY_INERT);
    }

    /** A unit vector whose cosine to the 0. axis (the query vector) is exactly {@code cosine}. */
    private static float[] cosineVector(float cosine) {
        float[] vector = axisVector(1);
        vector[0] = cosine;
        vector[1] = (float) Math.sqrt(1.0 - (double) cosine * cosine);
        return vector;
    }

    private void item(UUID owner, String sourceKind, String content, LocalDate occurredOn, float[] vector) {
        MemoryItemEntity entity = memoryItemPopulator.item(owner, sourceKind, UUID.randomUUID(),
                null, content, occurredOn, new String[0], new String[0], MemoryProvenanceEnvelope.empty());
        memoryItemPopulator.vector(entity, VERSION, vector);
    }
}
