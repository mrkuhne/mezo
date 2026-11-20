package io.mrkuhne.mezo.feature.penz.service.portfolio;

import java.util.UUID;

/** One valued holding placed in its sleeve. */
public record PositionInput(UUID holdingId, Sleeve sleeve, HoldingValue value) {
}
