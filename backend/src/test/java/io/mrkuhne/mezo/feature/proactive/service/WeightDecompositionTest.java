package io.mrkuhne.mezo.feature.proactive.service;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.proactive.entity.DiagnosisEvidenceEnvelope.EvidenceItem;
import io.mrkuhne.mezo.feature.proactive.service.WeightDecomposition.Inputs;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;

/**
 * Pure-JUnit unit tests for {@link WeightDecomposition#compute} (mezo-85x5r §2, Task 4 Step 1) —
 * no Spring context. Exercises the ceiling math, the goal-band classification (cut/bulk/none),
 * the &gt;1%-bodyweight non-tissue flag, and every null-input omission branch.
 */
class WeightDecompositionTest {

    private static Inputs baseInputs() {
        return new Inputs(
                79.5, 80.0, 5,
                79.0, 80.2,
                -0.5,
                3850.0,
                80.0,
                null, null,
                null);
    }

    private static Optional<EvidenceItem> find(List<EvidenceItem> items, String label) {
        return items.stream().filter(i -> i.label().equals(label)).findFirst();
    }

    @Test
    void realDeltaRowRendersAllSegmentsWhenEveryInputPresent() {
        List<EvidenceItem> items = WeightDecomposition.compute(baseInputs()).derivedItems();

        EvidenceItem row = find(items, "valódi delta").orElseThrow();
        assertThat(row.kind()).isEqualTo("derived");
        assertThat(row.sourceHu()).isEqualTo("számvetés");
        assertThat(row.detail()).isEqualTo(
                "heti átlag 79.5 · előző hét 80.0 · trend Δ -0.5 kg/hét · nyers 79.0→80.2 ZAJ-ként jelölve");
        assertThat(row.metricKey()).isNull();
        assertThat(row.value()).isNull();
    }

    @Test
    void realDeltaRowIsOmittedWhenWeekAvgIsMissing() {
        Inputs in = new Inputs(null, 80.0, 5, 79.0, 80.2, -0.5, 3850.0, 80.0, null, null, null);
        List<EvidenceItem> items = WeightDecomposition.compute(in).derivedItems();

        assertThat(find(items, "valódi delta")).isEmpty();
    }

    @Test
    void realDeltaRowOmitsThePrevWeekSegmentWhenPrevWeekIsMissing() {
        Inputs in = new Inputs(79.5, null, 5, 79.0, 80.2, -0.5, 3850.0, 80.0, null, null, null);
        List<EvidenceItem> items = WeightDecomposition.compute(in).derivedItems();

        assertThat(find(items, "valódi delta").orElseThrow().detail())
                .isEqualTo("heti átlag 79.5 · trend Δ -0.5 kg/hét · nyers 79.0→80.2 ZAJ-ként jelölve");
    }

    @Test
    void realDeltaRowOmitsTheNoiseSegmentWhenRawMinOrMaxIsMissing() {
        Inputs in = new Inputs(79.5, 80.0, 5, null, 80.2, -0.5, 3850.0, 80.0, null, null, null);
        List<EvidenceItem> items = WeightDecomposition.compute(in).derivedItems();

        assertThat(find(items, "valódi delta").orElseThrow().detail())
                .isEqualTo("heti átlag 79.5 · előző hét 80.0 · trend Δ -0.5 kg/hét");
    }

    @Test
    void tissueCeilingConvertsTheKcalSurplusTo05KgMaxFat() {
        List<EvidenceItem> items = WeightDecomposition.compute(baseInputs()).derivedItems();

        EvidenceItem row = find(items, "szövet-plafon").orElseThrow();
        assertThat(row.detail()).isEqualTo(
                "többlet ≈ 3850.0 kcal → max 0.5 kg zsír (7700 kcal/kg) · a delta többi része víz/glikogén/tartalom");
    }

    @Test
    void tissueCeilingRowIsOmittedWhenKcalSurplusIsMissing() {
        Inputs in = new Inputs(79.5, 80.0, 5, 79.0, 80.2, -0.5, null, 80.0, null, null, null);
        List<EvidenceItem> items = WeightDecomposition.compute(in).derivedItems();

        assertThat(find(items, "szövet-plafon")).isEmpty();
    }

    @Test
    void tissueCeilingFlagsANonTissueSignalAboveOnePercentBodyweightPerWeek() {
        Inputs in = new Inputs(79.5, 80.0, 5, 79.0, 80.2, -1.0, 3850.0, 80.0, null, null, null);
        List<EvidenceItem> items = WeightDecomposition.compute(in).derivedItems();

        assertThat(find(items, "szövet-plafon").orElseThrow().detail())
                .endsWith(" · >1% testsúly/hét → nem-szövet jel");
    }

    @Test
    void tissueCeilingDoesNotFlagANormalTrendBelowOnePercentBodyweight() {
        List<EvidenceItem> items = WeightDecomposition.compute(baseInputs()).derivedItems();

        assertThat(find(items, "szövet-plafon").orElseThrow().detail())
                .doesNotContain("nem-szövet jel");
    }

    @Test
    void goalBandRendersNoActiveGoalWhenThereIsNone() {
        List<EvidenceItem> items = WeightDecomposition.compute(baseInputs()).derivedItems();

        assertThat(find(items, "cél-sáv").orElseThrow().detail())
                .isEqualTo("nincs aktív cél — sáv nélkül");
    }

    @Test
    void goalBandClassifiesACutTrajectoryInsideTheFixedBandAsOnPlan() {
        // actualPct = -0.5/100*100 = -0.5, inside the fixed cut band [-1.0, -0.25].
        Inputs in = new Inputs(79.5, 80.0, 5, 79.0, 80.2, -0.5, 3850.0, 100.0, "cut", 0.5, null);
        List<EvidenceItem> items = WeightDecomposition.compute(in).derivedItems();

        assertThat(find(items, "cél-sáv").orElseThrow().detail())
                .isEqualTo("terven (sáv: -1,0 – -0,25 %/hét) · cél: 0,5 %/hét");
    }

    @Test
    void goalBandClassifiesACutTrajectoryTooSlowAsAheadOfPlan() {
        // actualPct = -0.1/100*100 = -0.1, above (i.e. less negative than) the cut band's -0.25 edge.
        Inputs in = new Inputs(79.5, 80.0, 5, 79.0, 80.2, -0.1, 3850.0, 100.0, "cut", 0.5, null);
        List<EvidenceItem> items = WeightDecomposition.compute(in).derivedItems();

        assertThat(find(items, "cél-sáv").orElseThrow().detail())
                .isEqualTo("terv fölött (sáv: -1,0 – -0,25 %/hét) · cél: 0,5 %/hét");
    }

    @Test
    void goalBandClassifiesABulkTrajectoryBelowTheFixedBandAsBehindPlan() {
        // actualPct = 0.05/100*100 = 0.05, below the bulk band's 0.1 floor.
        Inputs in = new Inputs(79.5, 80.0, 5, 79.0, 80.2, 0.05, 3850.0, 100.0, "bulk", 0.2, null);
        List<EvidenceItem> items = WeightDecomposition.compute(in).derivedItems();

        assertThat(find(items, "cél-sáv").orElseThrow().detail())
                .isEqualTo("terv alatt (sáv: 0,1 – 0,25 %/hét) · cél: 0,2 %/hét");
    }

    @Test
    void goalBandClassifiesAMaintainTrajectoryWithinTheFixedBandAsOnPlan() {
        // actualPct = 0.05/100*100 = 0.05, within the maintain band [-0.1, 0.1].
        Inputs in = new Inputs(79.5, 80.0, 5, 79.0, 80.2, 0.05, 3850.0, 100.0, "maintain", 0.0, null);
        List<EvidenceItem> items = WeightDecomposition.compute(in).derivedItems();

        assertThat(find(items, "cél-sáv").orElseThrow().detail())
                .isEqualTo("terven (sáv: ±0,1 %/hét) · cél: 0,0 %/hét");
    }

    @Test
    void goalBandNeverFabricatesOnPlanWhenTheActualRateIsNotComputable() {
        // trendDeltaKgPerWeek is null -> actualPct can't be derived; must never default to "terven".
        Inputs in = new Inputs(79.5, 80.0, 5, 79.0, 80.2, null, 3850.0, 100.0, "cut", 0.5, null);
        List<EvidenceItem> items = WeightDecomposition.compute(in).derivedItems();

        assertThat(find(items, "cél-sáv").orElseThrow().detail())
                .isEqualTo("sáv nem számítható (sáv: -1,0 – -0,25 %/hét) · cél: 0,5 %/hét");
    }

    @Test
    void strengthTrendRowRendersAPositiveDeltaAsGlycogenMuscleStory() {
        Inputs in = new Inputs(79.5, 80.0, 5, 79.0, 80.2, -0.5, 3850.0, 80.0, null, null, 4.5);
        List<EvidenceItem> items = WeightDecomposition.compute(in).derivedItems();

        assertThat(find(items, "erő-trend").orElseThrow().detail())
                .isEqualTo("top-gyakorlatok e1RM Δ +4.5% → glikogén/izom-sztori");
    }

    @Test
    void strengthTrendRowRendersANegativeDeltaAsFatigueWaterStory() {
        Inputs in = new Inputs(79.5, 80.0, 5, 79.0, 80.2, -0.5, 3850.0, 80.0, null, null, -3.2);
        List<EvidenceItem> items = WeightDecomposition.compute(in).derivedItems();

        assertThat(find(items, "erő-trend").orElseThrow().detail())
                .isEqualTo("top-gyakorlatok e1RM Δ −3.2% → fáradtság/víz-sztori");
    }

    @Test
    void strengthTrendRowIsOmittedWhenE1rmDeltaIsMissing() {
        List<EvidenceItem> items = WeightDecomposition.compute(baseInputs()).derivedItems();

        assertThat(find(items, "erő-trend")).isEmpty();
    }

    @Test
    void allRowsAreDerivedKindFromTheSzamvetesSource() {
        Inputs in = new Inputs(79.5, 80.0, 5, 79.0, 80.2, -0.5, 3850.0, 80.0, "cut", -0.5, 4.5);
        List<EvidenceItem> items = WeightDecomposition.compute(in).derivedItems();

        assertThat(items).hasSize(4);
        assertThat(items).allSatisfy(item -> {
            assertThat(item.kind()).isEqualTo("derived");
            assertThat(item.sourceHu()).isEqualTo("számvetés");
            assertThat(item.metricKey()).isNull();
            assertThat(item.value()).isNull();
            assertThat(item.baselineValue()).isNull();
            assertThat(item.delta()).isNull();
            assertThat(item.coverageDays()).isNull();
        });
    }
}
