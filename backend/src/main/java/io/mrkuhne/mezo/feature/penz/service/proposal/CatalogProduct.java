package io.mrkuhne.mezo.feature.penz.service.proposal;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

/**
 * One catalog product as the pure proposal code reads it (mezo-r36n9.105) — the fields of {@code penz_product} a
 * proposal prints. {@code status} suggested|approved|declined; only approved products are ever offered.
 */
public record CatalogProduct(UUID id, String name, String whatItIs, String kind, String currency,
                             List<String> sleeves, BigDecimal terPct, BigDecimal entryFeePct, String feeNote,
                             String distribution, LocalDate reviewedAt, String status) {

    public static final String STATUS_SUGGESTED = "suggested";
    public static final String STATUS_APPROVED = "approved";
    public static final String STATUS_DECLINED = "declined";

    public CatalogProduct {
        sleeves = sleeves == null ? List.of() : List.copyOf(sleeves);
    }

    public boolean approved() {
        return STATUS_APPROVED.equals(status);
    }
}
