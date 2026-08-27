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
        // A second month INSIDE the same quarter — this is what proves a quarter really is
        // assembled from ALL its month rungs (Quarters.endOf), not just its first month, which is
        // exactly what Quarters.parse(periodA) would already return on its own.
        periodSummaryPopulator.periodSummary(owner, PeriodSummaryEntity.GRANULARITY_MONTH,
                LocalDate.of(2026, 8, 1), "Augusztusban javult a helyzet.");
        periodSummaryPopulator.periodSummary(owner, PeriodSummaryEntity.GRANULARITY_MONTH,
                LocalDate.of(2026, 4, 1), "Áprilisban visszafogtam.");

        String out = memoryTools.comparePeriods("2026-Q3", "2026-Q2", ctx(owner));

        assertThat(out).contains("2026-Q3")
                .contains("Júliusban sok volt a volumen.")
                .contains("Augusztusban javult a helyzet.")
                .contains("2026-Q2")
                .contains("Áprilisban visszafogtam.");
        // Review fix (mezo-b3pp.20 final review, F4): a month rung's provenance is a MONTH, so the
        // ref is Időszak/2026-07 — never Memory/2026-07-01, which RefTag would render as a chip
        // reading like one specific DAY. Asserting the kind AND the period-shaped id together is
        // what stops a later "harmonise the ref kinds" change from quietly restoring the lie.
        assertThat(audit.toRefsEnvelope().refs())
                .anySatisfy(ref -> {
                    assertThat(ref.kind()).isEqualTo(MemoryTools.REF_KIND_PERIOD);
                    assertThat(ref.id()).isEqualTo("2026-07");
                })
                .anySatisfy(ref -> {
                    assertThat(ref.kind()).isEqualTo(MemoryTools.REF_KIND_PERIOD);
                    assertThat(ref.id()).isEqualTo("2026-08");
                })
                .noneSatisfy(ref -> assertThat(ref.kind()).isEqualTo("Memory"));
    }

    @Test
    void testComparePeriods_shouldTruncateLongSummary_whenOverRenderCap() {
        UUID owner = userPopulator.createUser().getId();
        // mezo.companion.quarterly.render-max-chars = 400 (application.yml) — one char past the
        // cap must be cut, with the "…" marker, so the prompt budget the property documents is
        // actually enforced and not merely declared.
        String longSummary = "A".repeat(400) + "TULCSORDULT-RESZ";
        periodSummaryPopulator.periodSummary(owner, PeriodSummaryEntity.GRANULARITY_MONTH,
                LocalDate.of(2026, 7, 1), longSummary);

        String out = memoryTools.comparePeriods("2026-07", "2026-06", ctx(owner));

        assertThat(out).contains("A".repeat(400) + "…")
                .doesNotContain("TULCSORDULT-RESZ");
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
        // Only the PRESENT period's rung produced a ref — the missing period's "nincs adat"
        // branch must add nothing to the audit (no ref for a period the tool didn't actually
        // find data for).
        assertThat(audit.toRefsEnvelope().refs())
                .hasSize(1)
                .anySatisfy(ref -> {
                    assertThat(ref.kind()).isEqualTo(MemoryTools.REF_KIND_PERIOD);
                    assertThat(ref.id()).isEqualTo("2026-07");
                });
    }

    @Test
    void testComparePeriods_shouldRenderNoData_whenAnArgumentIsUnparseable() {
        UUID owner = userPopulator.createUser().getId();

        assertThat(memoryTools.comparePeriods("tavaly nyáron", "2026-Q2", ctx(owner)))
                .isEqualTo("Időszak-összehasonlítás: nincs adat");
        assertThat(audit.toRefsEnvelope()).isNull();

        assertThat(memoryTools.comparePeriods(null, null, ctx(owner)))
                .isEqualTo("Időszak-összehasonlítás: nincs adat");
        assertThat(audit.toRefsEnvelope()).isNull();
    }

    @Test
    void testComparePeriods_shouldEmitNoRefs_whenBothPeriodsParseButHaveNoRungs() {
        UUID owner = userPopulator.createUser().getId();
        // No period_summary rows at all for this user — unlike the unparseable-argument test,
        // both arguments here parse fine (Quarters.parse succeeds for both), so this walks all
        // the way into renderPeriod on EACH side and hits its rungs.isEmpty() branch, rather than
        // short-circuiting before renderPeriod is ever called.

        String out = memoryTools.comparePeriods("2026-Q3", "2026-Q2", ctx(owner));

        assertThat(out).contains("2026-Q3").contains("2026-Q2")
                .contains("nincs adat");
        assertThat(audit.toRefsEnvelope()).isNull();
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
