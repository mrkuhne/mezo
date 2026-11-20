package io.mrkuhne.mezo.feature.penz.service.proposal;

import io.mrkuhne.mezo.feature.penz.service.portfolio.Sleeve;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;

/**
 * The options of one sleeve (Boop Pénz L7, mezo-r36n9.105, build notes call 12; spec decision 12) — pure.
 *
 * <ul>
 *   <li>Approved products whose {@code sleeves} contain the sleeve (the status is re-checked here, whatever the
 *       caller passed), cheapest running cost first — TER ascending (unknown last), then the entry fee (unknown
 *       last), then the name — at most {@value #MAX_OPTIONS}.</li>
 *   <li>Fewer than two → the sleeve still gets its amount, with an honest {@code note}.</li>
 *   <li>Each option carries computed figures only: the yearly running cost in Ft for the sleeve's amount
 *       ({@code amount × TER}, rounded HALF_UP to 10 Ft; null without a TER) and the "how they differ" lines,
 *       computed here: "the lowest" only for a strictly cheapest option, the cost delta per year against the cheapest, the currency (only when the options differ),
 *       accumulating vs distributing (only when they differ), and a one-off entry fee.</li>
 * </ul>
 */
public final class ProductOptions {

    public static final int MAX_OPTIONS = 3;
    /** 10 Ft. */
    private static final BigDecimal TEN_FT_MINOR = BigDecimal.valueOf(1_000L);

    private ProductOptions() {
    }

    public record Option(CatalogProduct product, Long yearlyCostHufMinor, List<String> differs) {

        public Option {
            differs = List.copyOf(differs);
        }
    }

    /** The sleeve's options and the note shown when there are fewer than two (else null). */
    public record SleeveOptions(Sleeve sleeve, long amountMinor, List<Option> options, String note) {

        public SleeveOptions {
            options = List.copyOf(options);
        }

        public List<String> names() {
            return options.stream().map(o -> o.product().name()).toList();
        }
    }

    public static SleeveOptions forSleeve(Sleeve sleeve, long amountMinor, List<CatalogProduct> products) {
        List<CatalogProduct> picked = products.stream()
            .filter(Objects::nonNull)
            .filter(CatalogProduct::approved)
            .filter(p -> p.sleeves().contains(sleeve.wire()))
            .sorted(Comparator.comparing(CatalogProduct::terPct, Comparator.nullsLast(Comparator.naturalOrder()))
                .thenComparing(CatalogProduct::entryFeePct, Comparator.nullsLast(Comparator.naturalOrder()))
                .thenComparing(CatalogProduct::name))
            .limit(MAX_OPTIONS)
            .toList();
        List<Long> costs = picked.stream().map(p -> yearlyCost(amountMinor, p.terPct())).toList();
        Long cheapest = costs.stream().filter(Objects::nonNull).min(Long::compare).orElse(null);
        long knownCosts = costs.stream().filter(Objects::nonNull).count();
        // "the lowest" only when strictly lowest: a TER tie or a 0 Ft amount has no cheapest option
        long atCheapest = costs.stream().filter(c -> c != null && c.equals(cheapest)).count();
        boolean currenciesDiffer = picked.stream().map(CatalogProduct::currency).distinct().count() > 1;
        boolean distributionsDiffer = picked.stream().map(CatalogProduct::distribution).distinct().count() > 1;
        List<Option> options = new ArrayList<>();
        for (int i = 0; i < picked.size(); i++) {
            CatalogProduct p = picked.get(i);
            Long cost = costs.get(i);
            List<String> differs = new ArrayList<>();
            if (picked.size() > 1) {
                if (cost == null) {
                    differs.add(p.feeNote() != null && !p.feeNote().isBlank()
                        ? "nincs egyszerű éves díja — lásd a díjmegjegyzést"
                        : "az éves költségét nem tudom forintban megmondani");
                } else if (knownCosts > 1 && cost.equals(cheapest)) {
                    if (atCheapest == 1) {
                        differs.add("ebben a rekeszben ennek a legalacsonyabb az éves költsége");
                    }
                } else if (knownCosts > 1) {
                    differs.add("évente " + ProposalFigures.huf(cost - cheapest) + "-tal többe kerül, mint a legolcsóbb");
                }
                if (currenciesDiffer) {
                    differs.add("HUF".equals(p.currency()) ? "forintban van, nincs árfolyamkockázata"
                        : "devizában van (" + p.currency() + ") — az árfolyam is mozgatja a forintértékét");
                }
                if (distributionsDiffer) {
                    differs.add(distributionLine(p.distribution()));
                }
            }
            if (p.entryFeePct() != null && p.entryFeePct().signum() > 0) {
                differs.add("belépéskor " + ProposalFigures.pct(p.entryFeePct()) + " egyszeri díj");
            }
            options.add(new Option(p, cost, differs));
        }
        return new SleeveOptions(sleeve, amountMinor, options, note(picked.size()));
    }

    /** {@code amount × TER / 100}, rounded HALF_UP to 10 Ft; null without a TER. */
    public static Long yearlyCost(long amountMinor, BigDecimal terPct) {
        if (terPct == null) {
            return null;
        }
        BigDecimal minor = BigDecimal.valueOf(amountMinor).multiply(terPct).divide(BigDecimal.valueOf(100));
        return minor.divide(TEN_FT_MINOR, 0, RoundingMode.HALF_UP).multiply(TEN_FT_MINOR).longValueExact();
    }

    static String note(int count) {
        if (count >= 2) {
            return null;
        }
        String head = count == 0 ? "ehhez a rekeszhez még nincs jóváhagyott termék"
            : "ehhez a rekeszhez még csak 1 jóváhagyott termék van";
        return head + " — a termékjegyzékben tudsz jóváhagyni";
    }

    private static String distributionLine(String distribution) {
        return switch (distribution) {
            case "accumulating" -> "újrabefekteti a hozamot (felhalmozó)";
            case "distributing" -> "kifizeti a hozamot (osztalékfizető)";
            default -> "kamatot fizet";
        };
    }
}
