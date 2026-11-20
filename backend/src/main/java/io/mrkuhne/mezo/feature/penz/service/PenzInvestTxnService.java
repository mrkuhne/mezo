package io.mrkuhne.mezo.feature.penz.service;

import io.mrkuhne.mezo.api.dto.PenzInvestTxnRequest;
import io.mrkuhne.mezo.api.dto.PenzInvestTxnResponse;
import io.mrkuhne.mezo.feature.penz.entity.PenzHoldingEntity;
import io.mrkuhne.mezo.feature.penz.entity.PenzInvestTxnEntity;
import io.mrkuhne.mezo.feature.penz.mapper.PenzPortfolioMapper;
import io.mrkuhne.mezo.feature.penz.repository.PenzInvestTxnRepository;
import io.mrkuhne.mezo.feature.penz.service.PenzFxService.Booking;
import io.mrkuhne.mezo.feature.penz.service.portfolio.LotBook;
import io.mrkuhne.mezo.feature.penz.service.portfolio.LotTxn;
import io.mrkuhne.mezo.feature.penz.service.portfolio.Lots;
import io.mrkuhne.mezo.feature.penz.service.portfolio.Side;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Buys and sells he already made on his own platform (Boop Pénz L6, mezo-r36n9.104). The currency is always the
 * holding's; the HUF twin is booked once at the transaction's date by the L4 FX policy ({@link PenzFxService#book}).
 * The FIFO book ({@link Lots}) is checked BEFORE an insert and BEFORE a delete, so no stored history ever holds a
 * sell above its open position (400 {@code PENZ_SELL_EXCEEDS_POSITION}). A sell's response carries its realized
 * P/L. Idempotent on {@code clientRef}.
 */
@Service
@RequiredArgsConstructor
public class PenzInvestTxnService {

    private static final int QUANTITY_SCALE = 8;

    private final PenzInvestTxnRepository repository;
    private final PenzHoldingService holdings;
    private final PenzFxService fx;
    private final PenzSettingsService settings;
    private final PenzPortfolioMapper mapper;

    /** One holding's transactions, newest first. */
    public List<PenzInvestTxnResponse> list(UUID owner, UUID holdingId) {
        holdings.require(owner, holdingId);
        List<PenzInvestTxnEntity> rows = repository.findByCreatedByAndHoldingIdAndDeletedFalseOrderByCreatedAtAsc(
            owner, holdingId);
        Map<UUID, Long> realized = Lots.build(rows.stream().map(PenzInvestTxnService::lot).toList())
            .realizedHufMinor();
        return rows.stream()
            .sorted(Comparator.comparing(PenzInvestTxnEntity::getDate)
                .thenComparing(PenzInvestTxnEntity::getCreatedAt).reversed())
            .map(r -> respond(r, realized)).toList();
    }

    @Transactional
    public PenzInvestTxnResponse create(UUID owner, PenzInvestTxnRequest req) {
        if (req.getClientRef() != null) {
            Optional<PenzInvestTxnEntity> replay = repository.findByCreatedByAndClientRefAndDeletedFalse(owner,
                req.getClientRef());
            if (replay.isPresent()) {
                return withRealized(owner, replay.get());
            }
        }
        PenzHoldingEntity holding = holdings.require(owner, req.getHoldingId());
        BigDecimal quantity = req.getQuantity() == null ? null
            : req.getQuantity().setScale(QUANTITY_SCALE, RoundingMode.HALF_UP);
        if (quantity != null && quantity.signum() <= 0) {
            throw PenzErrors.field("quantity");
        }
        Booking booking = fx.book(holding.getCurrency(), req.getAmountMinor(), req.getDate(), settings.today(owner));

        List<LotTxn> book = new ArrayList<>(repository.findByCreatedByAndHoldingIdAndDeletedFalseOrderByCreatedAtAsc(
            owner, holding.getId()).stream().map(PenzInvestTxnService::lot).toList());
        book.add(new LotTxn(UUID.randomUUID(), req.getDate(), Side.of(req.getSide()), quantity, booking.hufMinor()));
        Lots.build(book); // throws PENZ_SELL_EXCEEDS_POSITION

        PenzInvestTxnEntity row = new PenzInvestTxnEntity();
        row.setCreatedBy(owner);
        row.setHoldingId(holding.getId());
        row.setSide(req.getSide());
        row.setQuantity(quantity);
        row.setAmountMinor(req.getAmountMinor());
        row.setCurrency(holding.getCurrency());
        row.setAmountHufMinor(booking.hufMinor());
        row.setFxRate(booking.rate());
        row.setFxRateDate(booking.rateDate());
        row.setDate(req.getDate());
        row.setNote(req.getNote() == null || req.getNote().isBlank() ? null : req.getNote().strip());
        row.setClientRef(req.getClientRef());
        if (row.getClientRef() == null) {
            return withRealized(owner, repository.saveAndFlush(row));
        }
        repository.insertIfAbsent(owner, row.getHoldingId(), row.getSide(), row.getQuantity(), row.getAmountMinor(),
            row.getCurrency(), row.getAmountHufMinor(), row.getFxRate(), row.getFxRateDate(), row.getDate(),
            row.getNote(), row.getClientRef());
        return withRealized(owner, repository.findByCreatedByAndClientRefAndDeletedFalse(owner, row.getClientRef())
            .orElseThrow()); // just inserted, or the concurrent winner
    }

    /** Soft delete — refused when a later sell would exceed the position left without this row. */
    @Transactional
    public void delete(UUID owner, UUID id) {
        PenzInvestTxnEntity row = repository.findByIdAndCreatedByAndDeletedFalse(id, owner)
            .orElseThrow(() -> PenzErrors.notFound("PENZ_INVEST_TXN_NOT_FOUND"));
        Lots.build(repository.findByCreatedByAndHoldingIdAndDeletedFalseOrderByCreatedAtAsc(owner, row.getHoldingId())
            .stream().filter(t -> !t.getId().equals(id)).map(PenzInvestTxnService::lot).toList());
        repository.delete(row);
        repository.flush();
    }

    /** The FIFO book input of one stored row. */
    public static LotTxn lot(PenzInvestTxnEntity e) {
        return new LotTxn(e.getId(), e.getDate(), Side.of(e.getSide()), e.getQuantity(), e.getAmountHufMinor());
    }

    private PenzInvestTxnResponse withRealized(UUID owner, PenzInvestTxnEntity row) {
        LotBook book = Lots.build(repository.findByCreatedByAndHoldingIdAndDeletedFalseOrderByCreatedAtAsc(owner,
            row.getHoldingId()).stream().map(PenzInvestTxnService::lot).toList());
        return respond(row, book.realizedHufMinor());
    }

    private PenzInvestTxnResponse respond(PenzInvestTxnEntity row, Map<UUID, Long> realized) {
        return mapper.toResponse(row).realizedHufMinor(realized.get(row.getId()));
    }
}
