package io.mrkuhne.mezo.feature.penz.service.portfolio;

import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Lot-level cost basis = FIFO (Boop Pénz L6 build notes call 4) — pure, no Spring.
 *
 * <p>Transactions are taken by date; on the same day buys come before sells; otherwise the given order (the caller
 * passes creation order) is kept. Each buy is a lot. A sell consumes the oldest lots first: by quantity when every
 * transaction of the holding carries one (a partly consumed lot gives up {@code cost × taken / lotQuantity},
 * HALF_UP; a fully consumed lot gives up all its remaining cost, so nothing drifts), otherwise by HUF cost (the
 * sell's HUF twin). A sell above the open position is {@code PENZ_SELL_EXCEEDS_POSITION} (400).
 */
public final class Lots {

    private Lots() {
    }

    public static LotBook build(List<LotTxn> txns) {
        boolean quantityMode = !txns.isEmpty() && txns.stream().allMatch(t -> t.quantity() != null);
        List<LotTxn> ordered = new ArrayList<>(txns);
        ordered.sort(Comparator.comparing(LotTxn::date).thenComparing(t -> t.side() == Side.SELL));
        List<MutableLot> open = new ArrayList<>();
        Map<UUID, Long> realized = new LinkedHashMap<>();
        for (LotTxn t : ordered) {
            if (t.side() == Side.BUY) {
                open.add(new MutableLot(t, quantityMode ? t.quantity() : null, t.amountHufMinor()));
            } else {
                long consumed = quantityMode ? consumeUnits(open, t.quantity()) : consumeCost(open, t.amountHufMinor());
                realized.put(t.id(), t.amountHufMinor() - consumed);
            }
        }
        return new LotBook(quantityMode, open.stream().map(MutableLot::freeze).toList(), realized);
    }

    private static long consumeUnits(List<MutableLot> open, BigDecimal units) {
        BigDecimal held = open.stream().map(l -> l.quantity).reduce(BigDecimal.ZERO, BigDecimal::add);
        if (units.compareTo(held) > 0) {
            throw exceeds();
        }
        BigDecimal remaining = units;
        long consumed = 0;
        while (remaining.signum() > 0) {
            MutableLot lot = open.getFirst();
            if (lot.quantity.compareTo(remaining) <= 0) {
                consumed += lot.cost;
                remaining = remaining.subtract(lot.quantity);
                open.removeFirst();
            } else {
                long part = BigDecimal.valueOf(lot.cost).multiply(remaining)
                    .divide(lot.quantity, 0, RoundingMode.HALF_UP).longValueExact();
                consumed += part;
                lot.cost -= part;
                lot.quantity = lot.quantity.subtract(remaining);
                remaining = BigDecimal.ZERO;
            }
        }
        return consumed;
    }

    private static long consumeCost(List<MutableLot> open, long hufMinor) {
        long held = open.stream().mapToLong(l -> l.cost).sum();
        if (hufMinor > held) {
            throw exceeds();
        }
        long remaining = hufMinor;
        while (remaining > 0) {
            MutableLot lot = open.getFirst();
            long take = Math.min(lot.cost, remaining);
            lot.cost -= take;
            remaining -= take;
            if (lot.cost == 0) {
                open.removeFirst();
            }
        }
        return hufMinor;
    }

    private static SystemRuntimeErrorException exceeds() {
        return new SystemRuntimeErrorException(SystemMessage.error("PENZ_SELL_EXCEEDS_POSITION").build());
    }

    private static final class MutableLot {
        private final LotTxn buy;
        private BigDecimal quantity;
        private long cost;

        private MutableLot(LotTxn buy, BigDecimal quantity, long cost) {
            this.buy = buy;
            this.quantity = quantity;
            this.cost = cost;
        }

        private OpenLot freeze() {
            return new OpenLot(buy.date(), quantity, cost);
        }
    }
}
