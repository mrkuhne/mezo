package io.mrkuhne.mezo.feature.penz.mapper;

import io.mrkuhne.mezo.api.dto.PenzHoldingEventResponse;
import io.mrkuhne.mezo.api.dto.PenzHoldingResponse;
import io.mrkuhne.mezo.api.dto.PenzInvestTxnResponse;
import io.mrkuhne.mezo.api.dto.PenzMoney;
import io.mrkuhne.mezo.api.dto.PenzPortfolioResponse;
import io.mrkuhne.mezo.api.dto.PenzPosition;
import io.mrkuhne.mezo.api.dto.PenzPracticeRow;
import io.mrkuhne.mezo.api.dto.PenzSleeve;
import io.mrkuhne.mezo.feature.penz.entity.PenzHoldingEntity;
import io.mrkuhne.mezo.feature.penz.entity.PenzHoldingEventEntity;
import io.mrkuhne.mezo.feature.penz.entity.PenzInvestTxnEntity;
import io.mrkuhne.mezo.feature.penz.service.portfolio.HoldingValue;
import io.mrkuhne.mezo.feature.penz.service.portfolio.PortfolioResult;
import io.mrkuhne.mezo.feature.penz.service.portfolio.PositionResult;
import io.mrkuhne.mezo.feature.penz.service.portfolio.SleeveResult;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

/**
 * Portfolio rows and engine results ↔ the {@code PenzPortfolio} API shapes (Boop Pénz L6). Response enums are built
 * from their wire value ({@code fromValue}); amounts leave as {@link PenzMoney} with the STORED HUF twin.
 */
@Mapper(componentModel = "spring")
public interface PenzPortfolioMapper {

    @Mapping(target = "assetType", expression = "java(PenzHoldingResponse.AssetTypeEnum.fromValue(e.getAssetType()))")
    @Mapping(target = "platform", expression = "java(PenzHoldingResponse.PlatformEnum.fromValue(e.getPlatform()))")
    @Mapping(target = "sleeve", expression = "java(PenzHoldingResponse.SleeveEnum.fromValue(e.getSleeve()))")
    @Mapping(target = "newsTerms", expression = "java(e.getNewsTerms() == null ? new java.util.ArrayList<>() "
        + ": new java.util.ArrayList<>(e.getNewsTerms()))")
    PenzHoldingResponse toResponse(PenzHoldingEntity e);

    @Mapping(target = "side", expression = "java(PenzInvestTxnResponse.SideEnum.fromValue(e.getSide()))")
    @Mapping(target = "amount", expression = "java(money(e.getAmountMinor(), e.getCurrency(), e.getAmountHufMinor()))")
    @Mapping(target = "quantity", expression = "java(plain(e.getQuantity()))")
    @Mapping(target = "realizedHufMinor", ignore = true)
    PenzInvestTxnResponse toResponse(PenzInvestTxnEntity e);

    /** An event with its holding's name and sleeve; {@code amountHufMinor} valued by the caller (valuation policy). */
    default PenzHoldingEventResponse event(PenzHoldingEventEntity e, PenzHoldingEntity holding, Long amountHufMinor) {
        return new PenzHoldingEventResponse()
            .id(e.getId())
            .holdingId(e.getHoldingId())
            .holdingName(holding.getName())
            .sleeve(PenzHoldingEventResponse.SleeveEnum.fromValue(holding.getSleeve()))
            .kind(PenzHoldingEventResponse.KindEnum.fromValue(e.getKind()))
            .date(e.getDate())
            .amountMinor(e.getAmountMinor())
            .currency(e.getCurrency())
            .amountHufMinor(amountHufMinor)
            .note(e.getNote());
    }

    /** Pénzem: the engine's result with the holdings' own fields, the forward timeline and the practice row. */
    default PenzPortfolioResponse portfolio(PortfolioResult r, Map<UUID, PenzHoldingEntity> holdings,
                                            List<PenzHoldingEventResponse> events, long practiceMonthlyHufMinor) {
        List<PenzSleeve> sleeves = new ArrayList<>();
        for (SleeveResult s : r.sleeves()) {
            sleeves.add(new PenzSleeve()
                .sleeve(PenzSleeve.SleeveEnum.fromValue(s.sleeve().wire()))
                .valueHufMinor(s.valueHufMinor())
                .costHufMinor(s.costHufMinor())
                .sharePct(s.sharePct())
                .priceMoveHufMinor(s.priceMoveHufMinor())
                .fxMoveHufMinor(s.fxMoveHufMinor())
                .coverageMonths(s.coverageMonths())
                .holdings(s.positions().stream().map(p -> position(p, holdings.get(p.holdingId()))).toList()));
        }
        return new PenzPortfolioResponse()
            .date(r.date())
            .totalHufMinor(r.totalHufMinor())
            .costHufMinor(r.costHufMinor())
            .priceMoveHufMinor(r.priceMoveHufMinor())
            .fxMoveHufMinor(r.fxMoveHufMinor())
            .priceMovePct(r.priceMovePct())
            .fxMovePct(r.fxMovePct())
            .pricesAsOf(r.pricesAsOf())
            .stale(r.stale())
            .unpricedCount(r.unpricedCount())
            .fixedCostsMonthlyHufMinor(r.fixedCostsMonthlyHufMinor())
            .sleeves(sleeves)
            .events(events)
            .practice(new PenzPracticeRow().monthlyHufMinor(practiceMonthlyHufMinor).monthPnlHufMinor(null));
    }

    default PenzPosition position(PositionResult p, PenzHoldingEntity h) {
        HoldingValue v = p.value();
        return new PenzPosition()
            .holdingId(h.getId())
            .name(h.getName())
            .assetType(PenzPosition.AssetTypeEnum.fromValue(h.getAssetType()))
            .symbol(h.getSymbol())
            .platform(PenzPosition.PlatformEnum.fromValue(h.getPlatform()))
            .platformName(h.getPlatformName())
            .currency(h.getCurrency())
            .quantity(plain(v.quantity()))
            .valueHufMinor(v.valueHufMinor())
            .costHufMinor(v.costHufMinor())
            .sharePct(p.sharePct())
            .priceMoveHufMinor(v.priceMoveHufMinor())
            .fxMoveHufMinor(v.fxMoveHufMinor())
            .changePct(v.changePct())
            .priced(v.priced())
            .valuation(PenzPosition.ValuationEnum.fromValue(v.kind().wire()))
            .priceAsOf(v.priceAsOf());
    }

    /** A quantity without the column's trailing zeros, never in exponent form (10.00000000 → 10). */
    default java.math.BigDecimal plain(java.math.BigDecimal quantity) {
        if (quantity == null) {
            return null;
        }
        java.math.BigDecimal stripped = quantity.stripTrailingZeros();
        return stripped.scale() < 0 ? stripped.setScale(0) : stripped;
    }

    default PenzMoney money(long minor, String currency, long hufMinor) {
        return new PenzMoney().minor(minor).currency(currency).hufMinor(hufMinor);
    }
}
