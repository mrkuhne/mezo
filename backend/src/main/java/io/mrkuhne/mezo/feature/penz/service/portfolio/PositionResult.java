package io.mrkuhne.mezo.feature.penz.service.portfolio;

import java.math.BigDecimal;
import java.util.UUID;

/** A holding in its sleeve, with its share of the sleeve (percent, 1 decimal). */
public record PositionResult(UUID holdingId, HoldingValue value, BigDecimal sharePct) {
}
