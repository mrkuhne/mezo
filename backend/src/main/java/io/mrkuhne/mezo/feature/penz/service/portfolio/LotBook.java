package io.mrkuhne.mezo.feature.penz.service.portfolio;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * The FIFO lot book of one holding.
 *
 * @param quantityMode      true when every transaction carries a quantity (sells consume units); false = sells
 *                          consume HUF cost
 * @param openLots          the open lots, oldest first
 * @param realizedHufMinor  per sell id: proceeds (HUF twin) minus the FIFO cost of the lots it consumed
 */
public record LotBook(boolean quantityMode, List<OpenLot> openLots, Map<UUID, Long> realizedHufMinor) {

    /** Units still held; null in cost mode. */
    public BigDecimal openQuantity() {
        if (!quantityMode) {
            return null;
        }
        return openLots.stream().map(OpenLot::quantity).reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    /** The FIFO cost of the open lots, HUF minor. */
    public long openCostHufMinor() {
        return openLots.stream().mapToLong(OpenLot::costHufMinor).sum();
    }
}
