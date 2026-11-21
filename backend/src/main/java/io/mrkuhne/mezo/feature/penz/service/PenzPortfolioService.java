package io.mrkuhne.mezo.feature.penz.service;

import io.mrkuhne.mezo.api.dto.PenzPortfolioResponse;
import io.mrkuhne.mezo.feature.penz.entity.PenzHoldingEntity;
import io.mrkuhne.mezo.feature.penz.entity.PenzInvestTxnEntity;
import io.mrkuhne.mezo.feature.penz.entity.PenzQuoteEntity;
import io.mrkuhne.mezo.feature.penz.mapper.PenzPortfolioMapper;
import io.mrkuhne.mezo.feature.penz.repository.PenzHoldingRepository;
import io.mrkuhne.mezo.feature.penz.repository.PenzInvestTxnRepository;
import io.mrkuhne.mezo.feature.penz.service.engine.AllowanceLineKey;
import io.mrkuhne.mezo.feature.penz.service.portfolio.HoldingSpec;
import io.mrkuhne.mezo.feature.penz.service.portfolio.HoldingValue;
import io.mrkuhne.mezo.feature.penz.service.portfolio.Lots;
import io.mrkuhne.mezo.feature.penz.service.portfolio.PortfolioEngine;
import io.mrkuhne.mezo.feature.penz.service.portfolio.PortfolioResult;
import io.mrkuhne.mezo.feature.penz.service.portfolio.PositionInput;
import io.mrkuhne.mezo.feature.penz.service.portfolio.QuotePoint;
import io.mrkuhne.mezo.feature.penz.service.portfolio.Sleeve;
import io.mrkuhne.mezo.feature.penz.service.portfolio.Valuation;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * Pénzem (Boop Pénz L6, mezo-r36n9.104): maps the owner's holdings, transactions and the cached quotes into the
 * pure {@link Lots} / {@link Valuation} / {@link PortfolioEngine} and back.
 *
 * <ul>
 *   <li>Holdings: live and not archived, by sleeve then position. Transactions dated on or before the asked date.</li>
 *   <li>Quotes: the read first refreshes the owner's due symbols and FX pairs ({@link PenzQuoteService}, HTTP
 *       outside any transaction, throttled); a quote in another currency than the holding's is not used.</li>
 *   <li>Fixed costs = the allowance engine's {@code fixedCosts} line of the asked month
 *       ({@link PenzAllowanceService#monthly}, the same figure the allowance shows — not recomputed here).</li>
 *   <li>Events: the next 12 months from the asked date. Practice: the settings' monthly cap and the month's closed
 *       paper P/L ({@link PenzPracticeService#monthPnlHufMinor}, L7).</li>
 *   <li>Stale: the engine's 3-day rule, or the quote source failing while he holds a quoted holding.</li>
 * </ul>
 */
@Service
@RequiredArgsConstructor
public class PenzPortfolioService {

    private final PenzHoldingRepository holdingRows;
    private final PenzInvestTxnRepository txnRows;
    private final PenzQuoteService quotes;
    private final PenzProviderHealth health;
    private final PenzAllowanceService allowance;
    private final PenzSettingsService settings;
    private final PenzHoldingEventService events;
    private final PenzPracticeService practice;
    private final PenzPortfolioMapper mapper;

    /** The portfolio on {@code date} (null = the owner's today), quotes refreshed first. */
    public PenzPortfolioResponse portfolio(UUID owner, LocalDate date) {
        LocalDate today = settings.today(owner);
        LocalDate d = date == null ? today : date;
        List<PenzHoldingEntity> held = held(owner);
        quotes.refreshSymbols(symbolsOf(held), today);
        Valued valued = value(owner, d, held);
        boolean quoted = held.stream().anyMatch(h -> h.getSymbol() != null);
        boolean failing = quoted && health.failStreak(PenzQuoteService.PROVIDER_KEY) > 0;
        PortfolioResult result = PortfolioEngine.build(d, valued.positions(), fixedCosts(owner, d), failing);
        return mapper.portfolio(result, valued.byId(), events.between(owner, d, d.plusMonths(12)),
            settings.ensure(owner).getPracticeMonthlyMinor(), practice.monthPnlHufMinor(owner, YearMonth.from(d)));
    }

    /**
     * Every live, non-archived holding of the owner valued on {@code date} from the CACHED quotes (no fetch — the
     * caller refreshes first, e.g. {@link PenzQuoteService#refreshAllHeld}). What the news digest computes its
     * figures from: each story's effect is a holding's {@code priceMoveHufMinor} / {@code fxMoveHufMinor}.
     */
    public List<PenzPositionView> positions(UUID owner, LocalDate date) {
        List<PenzHoldingEntity> held = held(owner);
        Valued valued = value(owner, date, held);
        return valued.positions().stream().map(p -> {
            PenzHoldingEntity h = valued.byId().get(p.holdingId());
            HoldingValue v = p.value();
            return new PenzPositionView(h.getId(), h.getName(), h.getSymbol(), h.getCurrency(), h.getAssetType(),
                h.getSleeve(), List.copyOf(h.getNewsTerms() == null ? List.of() : h.getNewsTerms()),
                v.valueHufMinor(), v.priceMoveHufMinor(), v.fxMoveHufMinor(), v.changePct(), v.priced(),
                v.kind().wire());
        }).toList();
    }

    /**
     * The long sleeve's coverage of his fixed costs in months on {@code date}, exactly as Pénzem computes it
     * ({@link PortfolioEngine}: {@code floor(long value / fixedCosts)}) — from the CACHED quotes, no fetch; null when
     * fixed costs are unknown. The weekly long-horizon review's only money figure (mezo-r36n9.120).
     */
    public Integer longCoverageMonths(UUID owner, LocalDate date) {
        List<PenzHoldingEntity> held = held(owner);
        Valued valued = value(owner, date, held);
        return PortfolioEngine.build(date, valued.positions(), fixedCosts(owner, date), false).sleeves().stream()
            .filter(s -> s.sleeve() == Sleeve.LONG).findFirst().map(s -> s.coverageMonths()).orElse(null);
    }

    private List<PenzHoldingEntity> held(UUID owner) {
        return holdingRows.findByCreatedByAndDeletedFalseOrderByPositionAscCreatedAtAsc(owner).stream()
            .filter(h -> !h.isArchived())
            .sorted(Comparator.comparing((PenzHoldingEntity h) -> Sleeve.of(h.getSleeve())))
            .toList();
    }

    private static Set<String> symbolsOf(List<PenzHoldingEntity> held) {
        Set<String> symbols = new LinkedHashSet<>();
        held.stream().map(PenzHoldingEntity::getSymbol).filter(s -> s != null).forEach(symbols::add);
        held.stream().map(PenzHoldingEntity::getCurrency).filter(c -> !PenzFxService.HUF.equals(c))
            .map(PenzQuoteService::fxSymbol).forEach(symbols::add);
        return symbols;
    }

    private Valued value(UUID owner, LocalDate date, List<PenzHoldingEntity> held) {
        Map<UUID, List<PenzInvestTxnEntity>> txnsByHolding = txnRows.findByCreatedByAndDeletedFalseOrderByCreatedAtAsc(
            owner).stream().filter(t -> !t.getDate().isAfter(date))
            .collect(Collectors.groupingBy(PenzInvestTxnEntity::getHoldingId));
        Map<String, PenzQuoteEntity> cached = quotes.cached(symbolsOf(held));
        List<PositionInput> positions = held.stream().map(h -> {
            PenzQuoteEntity quote = h.getSymbol() == null ? null : cached.get(h.getSymbol());
            if (quote != null && !quote.getCurrency().equalsIgnoreCase(h.getCurrency())) {
                quote = null;
            }
            PenzQuoteEntity fx = cached.get(PenzQuoteService.fxSymbol(h.getCurrency()));
            HoldingValue v = Valuation.value(
                new HoldingSpec(h.getId(), h.getAssetType(), h.getCurrency(), h.getSymbol(), h.getBondRatePct()),
                Lots.build(txnsByHolding.getOrDefault(h.getId(), List.of()).stream()
                    .map(PenzInvestTxnService::lot).toList()),
                point(quote), point(fx), date);
            return new PositionInput(h.getId(), Sleeve.of(h.getSleeve()), v);
        }).toList();
        return new Valued(positions,
            held.stream().collect(Collectors.toMap(PenzHoldingEntity::getId, Function.identity())));
    }

    private static QuotePoint point(PenzQuoteEntity q) {
        return q == null ? null : new QuotePoint(q.getPrice(), q.getPreviousClose(), q.getAsOf());
    }

    private Long fixedCosts(UUID owner, LocalDate date) {
        return allowance.monthly(owner, YearMonth.from(date)).line(AllowanceLineKey.FIXED_COSTS);
    }

    private record Valued(List<PositionInput> positions, Map<UUID, PenzHoldingEntity> byId) {
    }

    /**
     * One holding as the digest reads it (HUF minor units).
     *
     * @param sleeve    short | mid | long
     * @param changePct the instrument's price change since the previous close, percent, 2 decimals; null unknown
     * @param valuation quote | accrual | cost
     */
    public record PenzPositionView(UUID holdingId, String name, String symbol, String currency, String assetType,
                                   String sleeve, List<String> newsTerms, long valueHufMinor,
                                   long priceMoveHufMinor, long fxMoveHufMinor, BigDecimal changePct,
                                   boolean priced, String valuation) {
    }
}
