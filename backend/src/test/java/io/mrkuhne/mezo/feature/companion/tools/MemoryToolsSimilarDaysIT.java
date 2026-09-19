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

    private void item(UUID owner, String sourceKind, String content, LocalDate occurredOn, float[] vector) {
        MemoryItemEntity entity = memoryItemPopulator.item(owner, sourceKind, UUID.randomUUID(),
                null, content, occurredOn, new String[0], new String[0], MemoryProvenanceEnvelope.empty());
        memoryItemPopulator.vector(entity, VERSION, vector);
    }
}
