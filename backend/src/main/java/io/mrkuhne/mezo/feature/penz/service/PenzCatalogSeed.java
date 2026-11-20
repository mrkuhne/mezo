package io.mrkuhne.mezo.feature.penz.service;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * The researched product list every owner's catalog is seeded from (Boop Pénz L7, mezo-r36n9.105, build notes call
 * 10) — code, reviewed like code, because every figure here is something Boop may print about a product. Each row is
 * inserted once per owner and {@link Seed#key} ({@code penz_product.seed_key}) as {@code suggested} /
 * {@code research}; the owner approves or declines it with one tap. Adding a row later seeds it for every owner on
 * their next catalog read; changing a row's figures does NOT touch rows already seeded (his copy is his).
 *
 * <p>Every seed carries the fee figures, the source they were read from and {@code reviewedAt} = the date they were
 * checked against that source. <b>Empty for now</b>: the real product facts are being verified before they go in.
 */
public final class PenzCatalogSeed {

    /**
     * One researched product.
     *
     * @param key        stable identity of the seed (never reused), e.g. {@code pmap-2026}
     * @param sleeves    ⊆ short|mid|long
     * @param terPct     yearly running cost percent, null when not applicable / unknown
     * @param reviewedAt when the figures were checked against {@code sourceUrl}
     */
    public record Seed(String key, String name, String kind, String currency, List<String> sleeves, String whatItIs,
                       BigDecimal terPct, BigDecimal entryFeePct, String feeNote, String distribution, String isin,
                       String symbol, String sourceName, String sourceUrl, LocalDate reviewedAt) {

        public Seed {
            sleeves = List.copyOf(sleeves);
        }
    }

    /** The researched list — intentionally empty until the facts are verified (see the class doc). */
    public static final List<Seed> SEEDS = List.of();

    private PenzCatalogSeed() {
    }
}
