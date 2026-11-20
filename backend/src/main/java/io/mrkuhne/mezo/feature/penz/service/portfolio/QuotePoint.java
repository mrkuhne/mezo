package io.mrkuhne.mezo.feature.penz.service.portfolio;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * A cached market price (a security in its own currency, or an FX pair in HUF per unit).
 *
 * @param previousClose the close before {@code asOf}'s market day; null = unknown (no move is computed)
 */
public record QuotePoint(BigDecimal price, BigDecimal previousClose, LocalDate asOf) {
}
