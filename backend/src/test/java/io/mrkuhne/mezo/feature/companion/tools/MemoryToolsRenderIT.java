package io.mrkuhne.mezo.feature.companion.tools;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.companion.entity.MemoryEmbeddingEntity;
import io.mrkuhne.mezo.feature.companion.entity.PeriodSummaryEntity;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import io.mrkuhne.mezo.support.populator.MemoryEmbeddingPopulator;
import io.mrkuhne.mezo.support.populator.PeriodSummaryPopulator;
import io.mrkuhne.mezo.support.populator.UserPopulator;
import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.model.ToolContext;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.Map;
import java.util.UUID;

/**
 * V2.3 recall tool render (the CompanionToolsRenderIT idiom): direct call with a hand-built
 * ToolContext, the query embedding scripted via the fake embedder's {@code [fake-embed:…]}
 * sentinel, refs asserted on the audit.
 */
@Transactional
@ActiveProfiles("companion-fake")
class MemoryToolsRenderIT extends AbstractIntegrationTest {

    @Autowired private MemoryTools memoryTools;
    @Autowired private MemoryEmbeddingPopulator memoryEmbeddingPopulator;
    @Autowired private UserPopulator userPopulator;
    @Autowired private PeriodSummaryPopulator periodSummaryPopulator;

    private ToolCallAudit audit;

    private ToolContext ctx(UUID userId) {
        audit = new ToolCallAudit(6, 10);
        return new ToolContext(Map.of(ToolContexts.USER_ID, userId, ToolContexts.AUDIT, audit));
    }

    @Test
    void testFindSimilarPastDays_shouldRenderDatesAndDigests_whenSummariesMatch() {
        UUID owner = userPopulator.createUser().getId();
        LocalDate day = LocalDate.now().minusDays(4);
        memoryEmbeddingPopulator.embedding(owner, MemoryEmbeddingEntity.KIND_DAILY_SUMMARY,
                UUID.randomUUID(), "Kemény leg-day volt, utána rossz alvás.", day,
                MemoryEmbeddingPopulator.axisVector(0));

        String out = memoryTools.findSimilarPastDays("[fake-embed:1] rossz alvás edzés után", 2, ctx(owner));

        assertThat(out).contains("Hasonló korábbi napok")
                .contains(day.toString())
                .contains("Kemény leg-day volt, utána rossz alvás.")
                .contains("egyezés 100%");
        assertThat(audit.toRefsEnvelope().refs())
                .anySatisfy(ref -> {
                    assertThat(ref.kind()).isEqualTo("Memory");
                    assertThat(ref.id()).isEqualTo(day.toString());
                });
    }

    @Test
    void testFindSimilarPastDays_shouldRenderNoData_whenDescriptionMissing() {
        UUID owner = userPopulator.createUser().getId();

        // 'required' is schema-advertised only — an omitting model must get an honest no-data,
        // not a TOOL_FAILED internal error from an NPE deep in the embed path.
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

    @Test
    void testComparePeriods_shouldRenderBothQuarters_whenRungsExist() {
        UUID owner = userPopulator.createUser().getId();
        periodSummaryPopulator.periodSummary(owner, PeriodSummaryEntity.GRANULARITY_MONTH,
                LocalDate.of(2026, 7, 1), "Júliusban sok volt a volumen.");
        periodSummaryPopulator.periodSummary(owner, PeriodSummaryEntity.GRANULARITY_MONTH,
                LocalDate.of(2026, 4, 1), "Áprilisban visszafogtam.");

        String out = memoryTools.comparePeriods("2026-Q3", "2026-Q2", ctx(owner));

        assertThat(out).contains("2026-Q3")
                .contains("Júliusban sok volt a volumen.")
                .contains("2026-Q2")
                .contains("Áprilisban visszafogtam.");
        assertThat(audit.toRefsEnvelope().refs())
                .anySatisfy(ref -> {
                    assertThat(ref.kind()).isEqualTo("Memory");
                    assertThat(ref.id()).isEqualTo("2026-07-01");
                });
    }

    @Test
    void testComparePeriods_shouldAcceptMonths_whenSpelledAsYyyyMm() {
        UUID owner = userPopulator.createUser().getId();
        periodSummaryPopulator.periodSummary(owner, PeriodSummaryEntity.GRANULARITY_MONTH,
                LocalDate.of(2026, 7, 1), "Júliusi hónap.");

        String out = memoryTools.comparePeriods("2026-07", "2026-06", ctx(owner));

        assertThat(out).contains("2026-07").contains("Júliusi hónap.")
                .contains("2026-06").contains("nincs adat");
    }

    @Test
    void testComparePeriods_shouldRenderHonestNoData_whenAPeriodHasNoRungs() {
        UUID owner = userPopulator.createUser().getId();
        periodSummaryPopulator.periodSummary(owner, PeriodSummaryEntity.GRANULARITY_MONTH,
                LocalDate.of(2026, 7, 1), "Júliusi hónap.");

        String out = memoryTools.comparePeriods("2026-Q3", "2025-Q1", ctx(owner));

        assertThat(out).contains("2025-Q1").contains("nincs adat");
    }

    @Test
    void testComparePeriods_shouldRenderNoData_whenAnArgumentIsUnparseable() {
        UUID owner = userPopulator.createUser().getId();

        assertThat(memoryTools.comparePeriods("tavaly nyáron", "2026-Q2", ctx(owner)))
                .isEqualTo("Időszak-összehasonlítás: nincs adat");
        assertThat(memoryTools.comparePeriods(null, null, ctx(owner)))
                .isEqualTo("Időszak-összehasonlítás: nincs adat");
    }

    @Test
    void testComparePeriods_shouldNotLeakAnotherUsersPeriods_whenOwnershipDiffers() {
        UUID owner = userPopulator.createUser().getId();
        UUID other = userPopulator.createUser().getId();
        periodSummaryPopulator.periodSummary(other, PeriodSummaryEntity.GRANULARITY_MONTH,
                LocalDate.of(2026, 7, 1), "IDEGEN-SZOVEG");

        String out = memoryTools.comparePeriods("2026-Q3", "2026-Q2", ctx(owner));

        assertThat(out).doesNotContain("IDEGEN-SZOVEG");
    }
}
