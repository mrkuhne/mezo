package io.mrkuhne.mezo.feature.penz.mapper;

import io.mrkuhne.mezo.api.dto.PenzMoney;
import io.mrkuhne.mezo.api.dto.PenzPaperTrade;
import io.mrkuhne.mezo.api.dto.PenzPracticeCap;
import io.mrkuhne.mezo.api.dto.PenzPracticeCurvePoint;
import io.mrkuhne.mezo.api.dto.PenzPracticeDistribution;
import io.mrkuhne.mezo.api.dto.PenzPracticeMistake;
import io.mrkuhne.mezo.api.dto.PenzPracticeObservation;
import io.mrkuhne.mezo.api.dto.PenzPracticeSetup;
import io.mrkuhne.mezo.api.dto.PenzPracticeTag;
import io.mrkuhne.mezo.api.dto.PenzPracticeWeek;
import io.mrkuhne.mezo.feature.penz.entity.PenzPaperTradeEntity;
import io.mrkuhne.mezo.feature.penz.service.money.FxConversion;
import io.mrkuhne.mezo.feature.penz.service.practice.PaperTradeMath;
import io.mrkuhne.mezo.feature.penz.service.practice.PaperTradeMath.Direction;
import io.mrkuhne.mezo.feature.penz.service.practice.PracticeCap;
import io.mrkuhne.mezo.feature.penz.service.practice.PracticeCopy.Copy;
import io.mrkuhne.mezo.feature.penz.service.practice.PracticeTag;
import io.mrkuhne.mezo.feature.penz.service.practice.WeeklyReview.Mistake;
import io.mrkuhne.mezo.feature.penz.service.practice.WeeklyReview.Week;
import java.math.BigDecimal;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import org.mapstruct.Mapper;

/**
 * Paper trades and the computed practice figures ↔ the {@code PenzPractice} API shapes (Boop Pénz L7). Per-unit
 * prices leave as {@link PenzMoney} with their HUF twin at the trade's stored rate (the plan rate, the entry date's
 * once opened; the last close at its own date's rate); totals carry their stored, booked twins. Nothing is fetched.
 */
@Mapper(componentModel = "spring")
public interface PenzPracticeMapper {

    default PenzPaperTrade trade(PenzPaperTradeEntity e) {
        Direction d = Direction.of(e.getDirection());
        boolean opened = e.getEntryMinor() != null;
        Long riskMinor = e.getRiskMinor();
        Long riskHuf = e.getRiskHufMinor();
        if (!opened && e.getPlannedEntryMinor() != null) {
            riskMinor = PaperTradeMath.riskMinor(e.getPlannedEntryMinor(), e.getStopMinor(), e.getQuantity());
            riskHuf = twin(riskMinor, e.getFxRate());
        }
        boolean closed = PenzPaperTradeEntity.CLOSED.equals(e.getStatus());
        boolean open = PenzPaperTradeEntity.OPEN.equals(e.getStatus());
        return new PenzPaperTrade()
            .id(e.getId())
            .paper(e.isPaper())
            .status(PenzPaperTrade.StatusEnum.fromValue(e.getStatus()))
            .instrument(e.getInstrument())
            .direction(PenzPaperTrade.DirectionEnum.fromValue(e.getDirection()))
            .why(e.getWhy())
            .currency(e.getCurrency())
            .quantity(plain(e.getQuantity()))
            .plannedEntry(price(e.getPlannedEntryMinor(), e))
            .stop(price(e.getStopMinor(), e))
            .target(price(e.getTargetMinor(), e))
            .entry(price(e.getEntryMinor(), e))
            .entryDate(e.getEntryDate())
            .exit(e.getExitMinor() == null ? null
                : money(e.getExitMinor(), e.getCurrency(), twin(e.getExitMinor(), e.getExitFxRate())))
            .exitDate(e.getExitDate())
            .lastClose(e.getLastCloseMinor() == null ? null
                : money(e.getLastCloseMinor(), e.getCurrency(), twin(e.getLastCloseMinor(), e.getLastCloseFxRate())))
            .lastCloseDate(e.getLastCloseDate())
            .riskMinor(riskMinor)
            .riskHufMinor(riskHuf)
            .costHufMinor(e.getCostHufMinor())
            .pnl(e.getPnlMinor() == null || e.getPnlHufMinor() == null ? null
                : money(e.getPnlMinor(), e.getCurrency(), e.getPnlHufMinor()))
            .rMultiple(e.getRMultiple())
            .unrealizedHufMinor(open ? (e.getUnrealizedHufMinor() == null ? 0L : e.getUnrealizedHufMinor()) : null)
            .tags(e.getTags() == null ? new ArrayList<>() : new ArrayList<>(e.getTags()))
            .mistake(e.isMistake())
            .line(e.getLine())
            .stopRespected(closed && e.getExitMinor() != null
                ? PaperTradeMath.stopRespected(d, e.getStopMinor(), e.getExitMinor()) : null)
            .createdAt(e.getCreatedAt() == null ? null : e.getCreatedAt().atOffset(ZoneOffset.UTC))
            .clientRef(e.getClientRef());
    }

    default PenzPracticeCap cap(PracticeCap c) {
        return new PenzPracticeCap().capHufMinor(c.capHufMinor()).usedHufMinor(c.usedHufMinor())
            .leftHufMinor(c.leftHufMinor());
    }

    default List<PenzPracticeTag> tags() {
        return Arrays.stream(PracticeTag.values()).map(t -> new PenzPracticeTag().key(t.key()).label(t.label()))
            .toList();
    }

    default PenzPracticeWeek week(Week w, Copy copy, List<PenzPaperTradeEntity> trades) {
        Mistake m = w.commonMistake();
        return new PenzPracticeWeek()
            .weekStart(w.weekStart())
            .weekEnd(w.weekEnd())
            .headline(copy.headline())
            .sub(copy.sub())
            .closedCount(w.closedCount())
            .winRatePct(w.winRatePct())
            .avgR(w.avgR())
            .bySetup(w.bySetup().stream().map(s -> new PenzPracticeSetup().tag(s.tag().key()).label(s.tag().label())
                .count(s.count()).wins(s.wins()).avgR(s.avgR())).toList())
            .distribution(new PenzPracticeDistribution().bigWins(w.distribution().bigWins())
                .smallLosses(w.distribution().smallLosses()).worseThanLimit(w.distribution().worseThanLimit())
                .healthy(w.distribution().healthy()))
            .commonMistake(m == null ? null : new PenzPracticeMistake().tag(m.tag().key()).label(m.tag().label())
                .count(m.count()).costHufMinor(m.costHufMinor()))
            .observations(copy.observations().stream()
                .map(o -> new PenzPracticeObservation().title(o.title()).body(o.body())).toList())
            .curve(w.curve().stream().map(p -> new PenzPracticeCurvePoint().date(p.date())
                .cumulativeHufMinor(p.cumulativeHufMinor())).toList())
            .trades(trades.stream().map(this::trade).toList());
    }

    private PenzMoney price(Long minor, PenzPaperTradeEntity e) {
        return minor == null ? null : money(minor, e.getCurrency(), twin(minor, e.getFxRate()));
    }

    private static long twin(long minor, BigDecimal rate) {
        return rate == null ? minor : FxConversion.toHufMinor(minor, rate);
    }

    private static PenzMoney money(long minor, String currency, long hufMinor) {
        return new PenzMoney().minor(minor).currency(currency).hufMinor(hufMinor);
    }

    /** A quantity without the column's trailing zeros, never in exponent form (10.00000000 → 10). */
    private static BigDecimal plain(BigDecimal quantity) {
        if (quantity == null) {
            return null;
        }
        BigDecimal stripped = quantity.stripTrailingZeros();
        return stripped.scale() < 0 ? stripped.setScale(0) : stripped;
    }
}
