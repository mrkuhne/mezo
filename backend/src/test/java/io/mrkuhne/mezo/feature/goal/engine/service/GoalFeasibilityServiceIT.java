package io.mrkuhne.mezo.feature.goal.engine.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import io.mrkuhne.mezo.api.dto.FeasibilityPreviewRequest;
import io.mrkuhne.mezo.api.dto.FeasibilityPreviewResponse;
import io.mrkuhne.mezo.support.AbstractIntegrationTest;
import java.math.BigDecimal;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/**
 * Verifies the stateless realism core (G6 §3.2): the shared rate derivation, the cap/band → verdict
 * mapping, and the over-cap realistic-date suggestion. No persistence — the service is pure, so the
 * numbers are deterministic functions of the request + the {@code mezo.goal.rate} config
 * (target 0.7, cap 1.0 %BW/wk).
 */
class GoalFeasibilityServiceIT extends AbstractIntegrationTest {

    @Autowired private GoalFeasibilityService service;

    private static FeasibilityPreviewRequest req(
            String trajectory, String startKg, String targetKg, LocalDate start, LocalDate target) {
        return FeasibilityPreviewRequest.builder()
            .trajectory(trajectory)
            .startWeightKg(new BigDecimal(startKg))
            .targetWeightKg(targetKg == null ? null : new BigDecimal(targetKg))
            .startDate(start)
            .targetDate(target)
            .build();
    }

    // ── within-band cut: ~0.6 %/wk → feasible, within band, no suggestion ─────────────────────────

    @Test
    void testPreview_shouldReturnFeasibleWithNoSuggestion_whenRateWithinBand() {
        // (84 − 80) / 84 * 100 / 8 weeks ≈ 0.595 %BW/wk → ≤ target (0.7) → feasible, ≤ cap (1.0) → in band.
        FeasibilityPreviewResponse res = service.preview(req(
            "cut", "84.00", "80.00", LocalDate.of(2026, 6, 1), LocalDate.of(2026, 7, 27)));

        assertThat(res.getDerivedRatePctPerWeek()).isCloseTo(new BigDecimal("0.60"), within(new BigDecimal("0.01")));
        assertThat(res.getWithinSafeBand()).isTrue();
        assertThat(res.getVerdict()).isEqualTo(FeasibilityPreviewResponse.VerdictEnum.FEASIBLE);
        assertThat(res.getSuggestedTargetDate()).isNull();
    }

    // ── aggressive cut: ~1.43 %/wk → over cap → aggressive + a cap-paced suggested date ────────────

    @Test
    void testPreview_shouldReturnAggressiveWithCapPacedDate_whenRateOverCap() {
        LocalDate start = LocalDate.of(2026, 6, 1);
        // (84 − 78) / 84 * 100 / 5 weeks ≈ 1.43 %BW/wk → > cap (1.0) → aggressive, out of band.
        FeasibilityPreviewResponse res = service.preview(req(
            "cut", "84.00", "78.00", start, start.plusWeeks(5)));

        assertThat(res.getDerivedRatePctPerWeek()).isCloseTo(new BigDecimal("1.43"), within(new BigDecimal("0.01")));
        assertThat(res.getWithinSafeBand()).isFalse();
        assertThat(res.getVerdict()).isEqualTo(FeasibilityPreviewResponse.VerdictEnum.AGGRESSIVE);
        // weeksAtCap = (84 − 78) / 84 * 100 / 1.0 ≈ 7.14 → ceil → 8 weeks → start + 8 weeks.
        assertThat(res.getSuggestedTargetDate()).isEqualTo(start.plusWeeks(8));
    }

    // ── maintain (no target) → rate 0, feasible, no suggestion ────────────────────────────────────

    @Test
    void testPreview_shouldReturnZeroRateAndNoSuggestion_whenMaintain() {
        FeasibilityPreviewResponse res = service.preview(req(
            "maintain", "84.00", null, LocalDate.of(2026, 6, 1), LocalDate.of(2026, 7, 27)));

        assertThat(res.getDerivedRatePctPerWeek()).isEqualByComparingTo(BigDecimal.ZERO);
        assertThat(res.getWithinSafeBand()).isTrue();
        assertThat(res.getVerdict()).isEqualTo(FeasibilityPreviewResponse.VerdictEnum.FEASIBLE);
        assertThat(res.getSuggestedTargetDate()).isNull();
    }

    // ── verdictForRate is the single shared band definition (eval gate reuses it) ──────────────────

    @Test
    void testVerdictForRate_shouldMapBandBoundaries_whenGraded() {
        assertThat(service.verdictForRate(new BigDecimal("0.70"))).isEqualTo("feasible");
        assertThat(service.verdictForRate(new BigDecimal("0.85"))).isEqualTo("feasible-with-warnings");
        assertThat(service.verdictForRate(new BigDecimal("1.00"))).isEqualTo("feasible-with-warnings");
        assertThat(service.verdictForRate(new BigDecimal("1.01"))).isEqualTo("aggressive");
        // abs() — a negative magnitude grades the same as its positive counterpart.
        assertThat(service.verdictForRate(new BigDecimal("-1.50"))).isEqualTo("aggressive");
    }
}
