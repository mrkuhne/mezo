package io.mrkuhne.mezo.feature.penz.service;

import io.mrkuhne.mezo.api.dto.PenzInvestTxnRequest;
import io.mrkuhne.mezo.api.dto.PenzInvestTxnResponse;
import io.mrkuhne.mezo.api.dto.PenzTransactionResponse;
import io.mrkuhne.mezo.feature.penz.entity.PenzAccountEntity;
import io.mrkuhne.mezo.feature.penz.entity.PenzHoldingEntity;
import io.mrkuhne.mezo.feature.penz.entity.PenzInvestTxnEntity;
import io.mrkuhne.mezo.feature.penz.entity.PenzTransactionEntity;
import io.mrkuhne.mezo.feature.penz.mapper.PenzPortfolioMapper;
import io.mrkuhne.mezo.feature.penz.repository.PenzInvestTxnRepository;
import io.mrkuhne.mezo.feature.penz.service.PenzFxService.Booking;
import io.mrkuhne.mezo.feature.penz.service.portfolio.LotBook;
import io.mrkuhne.mezo.feature.penz.service.portfolio.LotTxn;
import io.mrkuhne.mezo.feature.penz.service.portfolio.Lots;
import io.mrkuhne.mezo.feature.penz.service.portfolio.Side;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
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
 *
 * <p>With an {@code accountId} (mezo-r36n9.119) the buy / sell also lands on that money account as ONE linked
 * {@code penz_transaction} ({@link PenzInvestLinkService}), written in the same transaction and only by the request
 * that actually inserted the row — a clientRef replay never writes a second money row. With a
 * {@code linkTransactionId} a bank-SMS debit becomes that money row instead and the buy takes its date.
 */
@Service
@RequiredArgsConstructor
public class PenzInvestTxnService {

    private static final int QUANTITY_SCALE = 8;
    private static final String SIDE_BUY = "buy";

    private final PenzInvestTxnRepository repository;
    private final PenzHoldingService holdings;
    private final PenzFxService fx;
    private final PenzSettingsService settings;
    private final PenzPortfolioMapper mapper;
    private final PenzInvestLinkService links;

    /** One holding's transactions, newest first. */
    public List<PenzInvestTxnResponse> list(UUID owner, UUID holdingId) {
        holdings.require(owner, holdingId);
        List<PenzInvestTxnEntity> rows = repository.findByCreatedByAndHoldingIdAndDeletedFalseOrderByCreatedAtAsc(
            owner, holdingId);
        Map<UUID, Long> realized = Lots.build(rows.stream().map(PenzInvestTxnService::lot).toList())
            .realizedHufMinor();
        Map<UUID, UUID> accountOf = links.accountsOf(rows);
        return rows.stream()
            .sorted(Comparator.comparing(PenzInvestTxnEntity::getDate)
                .thenComparing(PenzInvestTxnEntity::getCreatedAt).reversed())
            .map(r -> respond(r, realized, accountOf)).toList();
    }

    /** Bank-SMS debits a buy may adopt (mezo-r36n9.119) — see {@link PenzInvestLinkService#smsCandidates}. */
    public List<PenzTransactionResponse> smsCandidates(UUID owner, UUID accountId, long amountMinor, LocalDate date) {
        return links.smsCandidates(owner, accountId, amountMinor, date);
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
        if (req.getLinkTransactionId() != null && (!SIDE_BUY.equals(req.getSide()) || req.getAccountId() == null)) {
            throw PenzErrors.field("linkTransactionId"); // only a buy paid from an account adopts a bank debit
        }
        LocalDate today = settings.today(owner);
        PenzAccountEntity account = req.getAccountId() == null ? null
            : links.requirePayable(owner, req.getAccountId());

        // a linked bank debit fixes the date: one buy never carries two dates
        PenzTransactionEntity adopted = null;
        LocalDate date = req.getDate();
        if (req.getLinkTransactionId() != null) {
            Booking typed = fx.book(holding.getCurrency(), req.getAmountMinor(), req.getDate(), today);
            long expected = links.accountAmount(account, req.getAccountAmountMinor(), holding.getCurrency(),
                req.getAmountMinor(), typed.hufMinor(), req.getDate(), today);
            adopted = links.requireSmsCandidate(owner, account, req.getLinkTransactionId(), expected, req.getDate());
            date = adopted.getDate();
        }
        Booking booking = fx.book(holding.getCurrency(), req.getAmountMinor(), date, today);

        List<LotTxn> book = new ArrayList<>(repository.findByCreatedByAndHoldingIdAndDeletedFalseOrderByCreatedAtAsc(
            owner, holding.getId()).stream().map(PenzInvestTxnService::lot).toList());
        book.add(new LotTxn(UUID.randomUUID(), date, Side.of(req.getSide()), quantity, booking.hufMinor()));
        Lots.build(book); // throws PENZ_SELL_EXCEEDS_POSITION

        long accountAmount = account == null || adopted != null ? 0 : links.accountAmount(account,
            req.getAccountAmountMinor(), holding.getCurrency(), req.getAmountMinor(), booking.hufMinor(), date, today);

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
        row.setDate(date);
        row.setNote(req.getNote() == null || req.getNote().isBlank() ? null : req.getNote().strip());
        row.setClientRef(req.getClientRef());
        PenzInvestTxnEntity stored;
        if (row.getClientRef() == null) {
            stored = repository.saveAndFlush(row);
        } else {
            int inserted = repository.insertIfAbsent(owner, row.getHoldingId(), row.getSide(), row.getQuantity(),
                row.getAmountMinor(), row.getCurrency(), row.getAmountHufMinor(), row.getFxRate(),
                row.getFxRateDate(), row.getDate(), row.getNote(), row.getClientRef());
            stored = repository.findByCreatedByAndClientRefAndDeletedFalse(owner, row.getClientRef())
                .orElseThrow(); // just inserted, or the concurrent winner
            if (inserted == 0) {
                return withRealized(owner, stored); // the concurrent winner wrote its own money row
            }
        }
        if (account != null) {
            PenzTransactionEntity money = adopted != null
                ? links.adopt(adopted, holding.getName())
                : links.createMoneyRow(owner, account, req.getSide(), accountAmount, date, holding.getName());
            stored.setTransactionId(money.getId());
            stored = repository.saveAndFlush(stored);
        }
        return withRealized(owner, stored);
    }

    /**
     * Soft delete — refused when a later sell would exceed the position left without this row. Its linked money row
     * is released in the same transaction ({@link PenzInvestLinkService#release}).
     */
    @Transactional
    public void delete(UUID owner, UUID id) {
        PenzInvestTxnEntity row = repository.findByIdAndCreatedByAndDeletedFalse(id, owner)
            .orElseThrow(() -> PenzErrors.notFound("PENZ_INVEST_TXN_NOT_FOUND"));
        Lots.build(repository.findByCreatedByAndHoldingIdAndDeletedFalseOrderByCreatedAtAsc(owner, row.getHoldingId())
            .stream().filter(t -> !t.getId().equals(id)).map(PenzInvestTxnService::lot).toList());
        repository.delete(row);
        repository.flush();
        links.release(owner, row);
    }

    /** The FIFO book input of one stored row. */
    public static LotTxn lot(PenzInvestTxnEntity e) {
        return new LotTxn(e.getId(), e.getDate(), Side.of(e.getSide()), e.getQuantity(), e.getAmountHufMinor());
    }

    private PenzInvestTxnResponse withRealized(UUID owner, PenzInvestTxnEntity row) {
        LotBook book = Lots.build(repository.findByCreatedByAndHoldingIdAndDeletedFalseOrderByCreatedAtAsc(owner,
            row.getHoldingId()).stream().map(PenzInvestTxnService::lot).toList());
        return respond(row, book.realizedHufMinor(), links.accountsOf(List.of(row)));
    }

    private PenzInvestTxnResponse respond(PenzInvestTxnEntity row, Map<UUID, Long> realized,
                                          Map<UUID, UUID> accountOf) {
        return mapper.toResponse(row).realizedHufMinor(realized.get(row.getId()))
            .accountId(row.getTransactionId() == null ? null : accountOf.get(row.getTransactionId()));
    }
}
