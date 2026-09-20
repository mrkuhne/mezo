package io.mrkuhne.mezo.feature.proactive.service;

import io.mrkuhne.mezo.feature.proactive.entity.DiagnosisEvidenceEnvelope;
import io.mrkuhne.mezo.feature.proactive.entity.DiagnosisEvidenceEnvelope.EvidenceItem;
import java.util.ArrayList;
import java.util.List;

/**
 * Pure decomposition of one anchored week (mezo-85x5r §2). All inputs nullable-friendly: an
 * absent input omits its ROW (row 1) or the affected SEGMENT within a row (rows 1/2), or the
 * whole row when the row's central quantity is unavailable (rows 2/4) — never a zeroed or
 * invented value.
 *
 * <p>Emitted rows are {@code kind = "derived"}, {@code sourceHu = "számvetés"}; the metric-only
 * {@link EvidenceItem} fields ({@code metricKey}/{@code value}/{@code baselineValue}/{@code
 * delta}/{@code coverageDays}) stay {@code null} — these are code-computed facts, not a raw
 * {@link io.mrkuhne.mezo.feature.companion.service.MetricKey} series.
 *
 * <p>Row 3 ("cél-sáv") band: the spec's FIXED %bodyweight/week bands per trajectory — cut
 * [-1.0, -0.25], bulk [0.1, 0.25], maintain [-0.1, 0.1] — compared against the actual weekly rate
 * derived from {@code trendDeltaKgPerWeek/bodyweightKg × 100}. When the actual rate is not
 * computable (either input missing), the status is {@code "sáv nem számítható"} — never a
 * fabricated "terven"; see {@code WeightDecompositionTest} for the exercised cases.
 */
public record WeightDecomposition(List<EvidenceItem> derivedItems) {

    private static final String SOURCE_HU = "számvetés";
    private static final double KCAL_PER_KG_FAT = 7700.0;
    private static final double NON_TISSUE_SIGNAL_PCT_BW = 0.01;

    public record Inputs(
            Double weekAvgKg, Double prevWeekAvgKg, Integer weighInCount,
            Double rawMinKg, Double rawMaxKg,
            Double trendDeltaKgPerWeek,
            Double weekKcalSurplus,
            Double bodyweightKg,
            String goalTrajectory, Double goalRatePctPerWeek,
            Double e1rmTopDeltaPct) {
    }

    public static WeightDecomposition compute(Inputs in) {
        List<EvidenceItem> items = new ArrayList<>();
        EvidenceItem realDelta = realDeltaRow(in);
        if (realDelta != null) {
            items.add(realDelta);
        }
        EvidenceItem ceiling = tissueCeilingRow(in);
        if (ceiling != null) {
            items.add(ceiling);
        }
        items.add(goalBandRow(in));
        EvidenceItem strength = strengthTrendRow(in);
        if (strength != null) {
            items.add(strength);
        }
        return new WeightDecomposition(items);
    }

    private static EvidenceItem realDeltaRow(Inputs in) {
        if (in.weekAvgKg() == null) {
            return null;
        }
        StringBuilder detail = new StringBuilder("heti átlag ").append(round(in.weekAvgKg()));
        if (in.prevWeekAvgKg() != null) {
            detail.append(" · előző hét ").append(round(in.prevWeekAvgKg()));
        }
        if (in.trendDeltaKgPerWeek() != null) {
            detail.append(" · trend Δ ").append(signed(round(in.trendDeltaKgPerWeek()))).append(" kg/hét");
        }
        if (in.rawMinKg() != null && in.rawMaxKg() != null) {
            detail.append(" · nyers ").append(round(in.rawMinKg())).append("→").append(round(in.rawMaxKg()))
                    .append(" ZAJ-ként jelölve");
        }
        return new EvidenceItem("derived", "valódi delta", detail.toString(), SOURCE_HU,
                null, null, null, null, null);
    }

    private static EvidenceItem tissueCeilingRow(Inputs in) {
        if (in.weekKcalSurplus() == null) {
            return null;
        }
        double maxFatKg = round(in.weekKcalSurplus() / KCAL_PER_KG_FAT);
        StringBuilder detail = new StringBuilder("többlet ≈ ").append(round(in.weekKcalSurplus()))
                .append(" kcal → max ").append(maxFatKg)
                .append(" kg zsír (7700 kcal/kg) · a delta többi része víz/glikogén/tartalom");
        if (isNonTissueSignal(in)) {
            detail.append(" · >1% testsúly/hét → nem-szövet jel");
        }
        return new EvidenceItem("derived", "szövet-plafon", detail.toString(), SOURCE_HU,
                null, null, null, null, null);
    }

    private static boolean isNonTissueSignal(Inputs in) {
        if (in.trendDeltaKgPerWeek() == null || in.bodyweightKg() == null || in.bodyweightKg() == 0) {
            return false;
        }
        return Math.abs(in.trendDeltaKgPerWeek()) / in.bodyweightKg() > NON_TISSUE_SIGNAL_PCT_BW;
    }

    private static EvidenceItem goalBandRow(Inputs in) {
        if (in.goalTrajectory() == null || in.goalRatePctPerWeek() == null) {
            return new EvidenceItem("derived", "cél-sáv", "nincs aktív cél — sáv nélkül", SOURCE_HU,
                    null, null, null, null, null);
        }
        Double actual = actualPctPerWeek(in);
        String bandLabel;
        String status;
        switch (in.goalTrajectory()) {
            case "cut" -> {
                bandLabel = huPct(-1.0) + " – " + huPct(-0.25);
                if (actual == null) {
                    status = "sáv nem számítható";
                } else if (actual < -1.0) {
                    status = "terv alatt · túl gyors";
                } else if (actual > -0.25) {
                    status = "terv fölött";
                } else {
                    status = "terven";
                }
            }
            case "bulk" -> {
                bandLabel = huPct(0.1) + " – " + huPct(0.25);
                if (actual == null) {
                    status = "sáv nem számítható";
                } else if (actual < 0.1) {
                    status = "terv alatt";
                } else if (actual > 0.25) {
                    status = "terv fölött";
                } else {
                    status = "terven";
                }
            }
            case "maintain" -> {
                bandLabel = "±" + huPct(0.1);
                if (actual == null) {
                    status = "sáv nem számítható";
                } else if (Math.abs(actual) <= 0.1) {
                    status = "terven";
                } else if (actual > 0.1) {
                    status = "terv fölött";
                } else {
                    status = "terv alatt";
                }
            }
            default -> throw new IllegalStateException("unknown goalTrajectory: " + in.goalTrajectory());
        }
        String detail = status + " (sáv: " + bandLabel + " %/hét) · cél: " + huPct(in.goalRatePctPerWeek()) + " %/hét";
        return new EvidenceItem("derived", "cél-sáv", detail, SOURCE_HU,
                null, null, null, null, null);
    }

    /** Hungarian-locale decimal (comma separator) for the fixed %BW/week band labels. */
    private static String huPct(double value) {
        return String.valueOf(round(value)).replace('.', ',');
    }

    private static Double actualPctPerWeek(Inputs in) {
        if (in.trendDeltaKgPerWeek() == null || in.bodyweightKg() == null || in.bodyweightKg() == 0) {
            return null;
        }
        return in.trendDeltaKgPerWeek() / in.bodyweightKg() * 100.0;
    }

    private static EvidenceItem strengthTrendRow(Inputs in) {
        if (in.e1rmTopDeltaPct() == null) {
            return null;
        }
        double pct = round(in.e1rmTopDeltaPct());
        String detail = pct >= 0
                ? "top-gyakorlatok e1RM Δ +" + pct + "% → glikogén/izom-sztori"
                : "top-gyakorlatok e1RM Δ −" + round(Math.abs(pct)) + "% → fáradtság/víz-sztori";
        return new EvidenceItem("derived", "erő-trend", detail, SOURCE_HU,
                null, null, null, null, null);
    }

    private static String signed(double value) {
        return value >= 0 ? "+" + value : String.valueOf(value);
    }

    private static double round(double value) {
        return Math.round(value * 100.0) / 100.0;
    }
}
