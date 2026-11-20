package io.mrkuhne.mezo.feature.penz.service.proposal;

import io.mrkuhne.mezo.feature.penz.service.news.DigestFigures;
import io.mrkuhne.mezo.feature.penz.service.portfolio.Sleeve;
import io.mrkuhne.mezo.feature.penz.service.proposal.ProductOptions.Option;
import io.mrkuhne.mezo.feature.penz.service.proposal.ProductOptions.SleeveOptions;
import io.mrkuhne.mezo.feature.penz.service.proposal.ProposalSplitter.Split;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * The FIGURES of one proposal (Boop Pénz L7, mezo-r36n9.105, build notes call 13) — every number the backend
 * computed for it, and their one Hungarian spelling. The narration may contain these and nothing else
 * ({@link ProposalValidator}); the prompt hands them over verbatim; the "miért?" facts are formatted from them.
 *
 * <p>Spelling (the digest's, {@link DigestFigures}): whole forints, thousands grouped by a plain space, {@code " Ft"}
 * ({@code 1 250 000 Ft}); a percentage with a decimal comma and no trailing zeros ({@code 40%}, {@code 0,07%},
 * {@code 12,5%}). The horizon phrases {@code 1–3 év}, {@code 5–10 év}, {@code 10+ év} are labels, not figures: their
 * digits are allowed only inside them.
 */
public record ProposalFigures(Split split, List<SleeveOptions> sleeves) {

    /** The three horizon labels, digits allowed only inside them. */
    public static final Pattern HORIZONS = Pattern.compile(
        "(?<!\\d)(?:1\\s?[–-]\\s?3|5\\s?[–-]\\s?10|10\\s?\\+)\\s?év\\p{L}*");

    public ProposalFigures {
        sleeves = List.copyOf(sleeves);
    }

    public SleeveOptions options(Sleeve s) {
        return sleeves.stream().filter(o -> o.sleeve() == s).findFirst().orElseThrow();
    }

    /** {@code 1 250 000 Ft}: the magnitude in whole forints. */
    public static String huf(long minor) {
        return DigestFigures.hufMagnitude(minor);
    }

    /** {@code 1 250 000}: the magnitude in whole forints, no unit. */
    public static String grouped(long minor) {
        String s = huf(minor);
        return s.substring(0, s.length() - " Ft".length());
    }

    /** {@code 40%}, {@code 0,07%}, {@code 12,5%}: decimal comma, no trailing zeros. */
    public static String pct(BigDecimal pct) {
        return pctNumber(pct) + "%";
    }

    static String pctNumber(BigDecimal pct) {
        BigDecimal d = pct.abs().stripTrailingZeros();
        return (d.scale() < 0 ? d.setScale(0) : d).toPlainString().replace('.', ',');
    }

    /** 1–3 év / 5–10 év / 10+ év. */
    public static String horizon(Sleeve s) {
        return DigestFigures.sleeveLabel(s.wire());
    }

    /** Every forint figure the amount guard accepts (magnitudes, HUF minor units). */
    public Set<Long> allowedHufMinor() {
        Set<Long> out = new LinkedHashSet<>();
        out.add(split.amountMinor());
        for (Sleeve s : Sleeve.values()) {
            out.add(split.amount(s));
        }
        if (split.targetKnown()) {
            out.add(split.emergencyTargetMinor());
            out.add(split.shortfallMinor());
            out.add(split.fixedCostsMinor());
        }
        out.add(split.shortValueMinor());
        for (SleeveOptions so : sleeves) {
            List<Long> costs = so.options().stream().map(Option::yearlyCostHufMinor).filter(c -> c != null).toList();
            out.addAll(costs);
            // the "how they differ" lines print each cost's delta against the cheapest
            costs.stream().min(Long::compare).ifPresent(min -> costs.forEach(c -> out.add(c - min)));
        }
        return out;
    }

    /** Every percentage the prose may write with {@code %}, normalized. */
    public Set<String> allowedPercents() {
        Set<String> out = new LinkedHashSet<>();
        out.add(String.valueOf(ProposalSplitter.MID_PCT));
        out.add(String.valueOf(ProposalSplitter.LONG_PCT));
        for (Sleeve s : Sleeve.values()) {
            out.add(DigestFigures.normalizeNumber(pctNumber(split.sharePct(s))));
        }
        for (SleeveOptions so : sleeves) {
            for (Option o : so.options()) {
                if (o.product().terPct() != null) {
                    out.add(DigestFigures.normalizeNumber(pctNumber(o.product().terPct())));
                }
                if (o.product().entryFeePct() != null) {
                    out.add(DigestFigures.normalizeNumber(pctNumber(o.product().entryFeePct())));
                }
            }
        }
        return out;
    }

    /** Every number the prose may contain, normalized: the forint figures, the percentages, the months. */
    public Set<String> allowedNumbers() {
        Set<String> out = new LinkedHashSet<>();
        allowedHufMinor().forEach(m -> out.add(DigestFigures.normalizeNumber(grouped(m))));
        out.addAll(allowedPercents());
        if (split.targetKnown()) {
            out.add(String.valueOf(split.emergencyMonths()));
        }
        return out;
    }

    /** The FIGURES lines of the prompt, Hungarian. */
    public List<String> figureLines() {
        List<String> lines = new ArrayList<>();
        lines.add("Az összeg: " + huf(split.amountMinor()));
        if (split.targetKnown()) {
            lines.add("Havi fix költség: " + huf(split.fixedCostsMinor()));
            lines.add("A tartalék célja: " + split.emergencyMonths() + " havi fix költség, " + huf(
                split.emergencyTargetMinor()));
            lines.add("A rövid rekeszben most: " + huf(split.shortValueMinor()));
            lines.add("A tartalékból hiányzik: " + huf(split.shortfallMinor()));
        } else {
            lines.add("A tartalék célja: nem ismert (nincs rögzített fix költség)");
        }
        lines.add("A maradék felosztása: " + ProposalSplitter.MID_PCT + "% középtáv, " + ProposalSplitter.LONG_PCT
            + "% hosszú táv");
        for (Sleeve s : Sleeve.values()) {
            lines.add(horizon(s) + ": " + huf(split.amount(s)) + " (" + pct(split.sharePct(s)) + ")");
        }
        return lines;
    }

    /** The "miért?" facts: value, unit, label. */
    public List<Fact> facts() {
        List<Fact> out = new ArrayList<>();
        out.add(new Fact(grouped(split.amountMinor()), "Ft", "a felosztott összeg"));
        if (split.targetKnown()) {
            out.add(new Fact(String.valueOf(split.emergencyMonths()), "hónap", "a tartalék célja fix költségben"));
            out.add(new Fact(grouped(split.emergencyTargetMinor()), "Ft", "a tartalék célja"));
            out.add(new Fact(grouped(split.shortValueMinor()), "Ft", "a rövid rekeszben most"));
            out.add(new Fact(grouped(split.shortfallMinor()), "Ft", "a tartalékból hiányzik"));
        }
        out.add(new Fact(String.valueOf(ProposalSplitter.MID_PCT), "%", "a maradékból a középtávú rekeszbe"));
        out.add(new Fact(String.valueOf(ProposalSplitter.LONG_PCT), "%", "a maradékból a hosszú rekeszbe"));
        return out;
    }

    /** One "miért?" fact. */
    public record Fact(String value, String unit, String label) {
    }
}
