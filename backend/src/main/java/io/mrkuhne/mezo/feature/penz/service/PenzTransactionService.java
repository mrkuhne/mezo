package io.mrkuhne.mezo.feature.penz.service;

import io.mrkuhne.mezo.api.dto.PenzTransactionRequest;
import io.mrkuhne.mezo.api.dto.PenzTransactionResponse;
import io.mrkuhne.mezo.api.dto.PenzTransferRequest;
import io.mrkuhne.mezo.feature.penz.entity.PenzAccountEntity;
import io.mrkuhne.mezo.feature.penz.entity.PenzTransactionEntity;
import io.mrkuhne.mezo.feature.penz.mapper.PenzMapper;
import io.mrkuhne.mezo.feature.penz.repository.PenzInvestTxnRepository;
import io.mrkuhne.mezo.feature.penz.repository.PenzTransactionRepository;
import io.mrkuhne.mezo.feature.penz.service.PenzFxService.Booking;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.temporal.ChronoUnit;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Transactions and transfer pairs (Boop Pénz L4, mezo-r36n9.102).
 *
 * <p>Every write books its HUF twin through {@link PenzFxService} (the one FX policy) and STORES it; an update
 * re-books only when the amount, currency or date itself changed — otherwise the stored twin stands.
 * A phone write carrying a {@code clientRef} is idempotent: a native {@code INSERT … ON CONFLICT DO NOTHING}
 * on the partial unique index {@code (created_by, client_ref)}, then a read-back, so a retry (or a concurrent
 * duplicate) returns the stored row. A transfer is two rows — {@code transfer_out} on the source account,
 * {@code transfer_in} on the target — sharing {@code transfer_pair_id}; the client ref sits on the out leg.
 * Updating a leg moves amount, currency, date and note on both legs; deleting a leg deletes its pair.
 *
 * <p>A row's currency is ALWAYS its account's currency (400 {@code PENZ_CURRENCY_MISMATCH}) — the balance of an
 * account sums its rows in its own currency, so a row in another one would be skipped by it (legacy rows only).
 * A foreign purchase on a HUF account is entered as the forints it cost (the SMS ingest converts the same way).
 *
 * <p>The money row of a live investment buy / sell (mezo-r36n9.119) cannot be updated or deleted here (409
 * {@code PENZ_TRANSACTION_INVEST_LINKED}) — it follows its investment record.
 */
@Service
@RequiredArgsConstructor
public class PenzTransactionService {

    private static final Set<String> TRANSFER_KINDS =
        Set.of(PenzTransactionEntity.KIND_TRANSFER_OUT, PenzTransactionEntity.KIND_TRANSFER_IN);

    private final PenzTransactionRepository repository;
    private final PenzAccountService accounts;
    private final PenzCategoryService categories;
    private final PenzSettingsService settings;
    private final PenzFxService fx;
    private final PenzRecurringMaterializer materializer;
    private final PenzMapper mapper;
    private final PenzInvestTxnRepository investTxns;

    /**
     * One month's live transactions, newest first; {@code needsReview} filters when given. Due recurring
     * occurrences are materialized first, so the list shows them.
     */
    @Transactional
    public List<PenzTransactionResponse> list(UUID owner, String month, Boolean needsReview) {
        YearMonth m = PenzMonths.requireMonth(month);
        materializer.materializeDue(owner, settings.today(owner));
        return repository.findByCreatedByAndDateBetweenAndDeletedFalseOrderByDateDescCreatedAtDesc(
                owner, PenzMonths.first(m), PenzMonths.last(m)).stream()
            .filter(t -> needsReview == null || t.isNeedsReview() == needsReview)
            .map(mapper::toResponse)
            .toList();
    }

    @Transactional
    public PenzTransactionResponse create(UUID owner, PenzTransactionRequest req) {
        if (TRANSFER_KINDS.contains(req.getKind())) {
            throw PenzErrors.field("kind"); // a transfer is a pair: POST /api/penz/transfers
        }
        if (req.getClientRef() != null) {
            Optional<PenzTransactionEntity> replay = repository.findByCreatedByAndClientRefAndDeletedFalse(owner,
                req.getClientRef());
            if (replay.isPresent()) {
                return mapper.toResponse(replay.get());
            }
        }
        requireCurrency(accounts.require(owner, req.getAccountId()), req.getCurrency());
        if (req.getCategoryId() != null) {
            categories.require(owner, req.getCategoryId());
        }
        Booking booking = fx.book(req.getCurrency(), req.getAmountMinor(), req.getDate(), settings.today(owner));
        PenzTransactionEntity row = new PenzTransactionEntity();
        row.setCreatedBy(owner);
        row.setAccountId(req.getAccountId());
        row.setKind(req.getKind());
        setAmount(row, req.getAmountMinor(), req.getCurrency(), booking);
        row.setCategoryId(req.getCategoryId());
        row.setDate(req.getDate());
        row.setNote(blankToNull(req.getNote()));
        row.setNeedsReview(Boolean.TRUE.equals(req.getNeedsReview()));
        row.setClientRef(req.getClientRef());
        return mapper.toResponse(store(row));
    }

    @Transactional
    public PenzTransactionResponse update(UUID owner, UUID id, PenzTransactionRequest req) {
        PenzTransactionEntity row = require(owner, id);
        requireNotInvestLinked(owner, id);
        PenzAccountEntity account = accounts.require(owner, req.getAccountId());
        boolean transfer = row.getTransferPairId() != null && TRANSFER_KINDS.contains(row.getKind());
        if (transfer ? !row.getKind().equals(req.getKind()) : TRANSFER_KINDS.contains(req.getKind())) {
            throw PenzErrors.field("kind");
        }
        List<PenzTransactionEntity> legs = transfer
            ? repository.findByCreatedByAndTransferPairIdAndDeletedFalse(owner, row.getTransferPairId()) : List.of();
        if (transfer) {
            for (PenzTransactionEntity other : legs) {
                if (other.getId().equals(row.getId())) {
                    continue;
                }
                if (other.getAccountId().equals(req.getAccountId())) {
                    throw PenzErrors.badRequest("PENZ_TRANSFER_SAME_ACCOUNT"); // a leg onto the other leg's account
                }
                requireCurrency(accounts.require(owner, other.getAccountId()), req.getCurrency());
            }
        }
        requireCurrency(account, req.getCurrency());
        boolean rebook = needsHufRecompute(row.getAmountMinor(), row.getCurrency(), row.getDate(),
            req.getAmountMinor(), req.getCurrency(), req.getDate());
        Booking booking = rebook
            ? fx.book(req.getCurrency(), req.getAmountMinor(), req.getDate(), settings.today(owner))
            : new Booking(row.getAmountHufMinor(), row.getFxRate(), row.getFxRateDate());
        Instant now = Instant.now().truncatedTo(ChronoUnit.MICROS);
        if (transfer) {
            for (PenzTransactionEntity leg : legs) {
                setAmount(leg, req.getAmountMinor(), req.getCurrency(), booking);
                leg.setDate(req.getDate());
                leg.setNote(blankToNull(req.getNote()));
                leg.setUpdatedAt(now);
                if (leg.getId().equals(row.getId())) {
                    leg.setAccountId(req.getAccountId());
                }
                repository.save(leg);
            }
            repository.flush();
            return mapper.toResponse(require(owner, id));
        }
        if (req.getCategoryId() != null) {
            categories.require(owner, req.getCategoryId());
        }
        row.setAccountId(req.getAccountId());
        row.setKind(req.getKind());
        setAmount(row, req.getAmountMinor(), req.getCurrency(), booking);
        row.setCategoryId(req.getCategoryId());
        row.setDate(req.getDate());
        row.setNote(blankToNull(req.getNote()));
        if (req.getNeedsReview() != null) {
            row.setNeedsReview(req.getNeedsReview());
        }
        row.setUpdatedAt(now);
        return mapper.toResponse(repository.saveAndFlush(row));
    }

    /**
     * Soft delete; a transfer leg takes its pair with it. A month close's transfer leg may be deleted too — the close
     * keeps its stored figures and its (now dangling) pair id.
     */
    @Transactional
    public void delete(UUID owner, UUID id) {
        PenzTransactionEntity row = require(owner, id);
        requireNotInvestLinked(owner, id);
        if (row.getTransferPairId() != null) {
            repository.deleteAll(repository.findByCreatedByAndTransferPairIdAndDeletedFalse(owner,
                row.getTransferPairId()));
        } else {
            repository.delete(row);
        }
        repository.flush();
    }

    @Transactional
    public PenzTransactionResponse markReviewed(UUID owner, UUID id) {
        PenzTransactionEntity row = require(owner, id);
        row.setNeedsReview(false);
        row.setUpdatedAt(Instant.now().truncatedTo(ChronoUnit.MICROS));
        return mapper.toResponse(repository.saveAndFlush(row));
    }

    /** Both legs of a transfer, transfer_out first; idempotent on {@code clientRef}. */
    @Transactional
    public List<PenzTransactionResponse> transfer(UUID owner, PenzTransferRequest req) {
        if (req.getFromAccountId().equals(req.getToAccountId())) {
            throw PenzErrors.badRequest("PENZ_TRANSFER_SAME_ACCOUNT");
        }
        if (req.getClientRef() != null) {
            Optional<PenzTransactionEntity> replay = repository.findByCreatedByAndClientRefAndDeletedFalse(owner,
                req.getClientRef());
            if (replay.isPresent()) {
                return legs(owner, requirePairId(replay.get()));
            }
        }
        // L4: both accounts share the transfer's currency; a cross-currency transfer (each leg in its own
        // account's currency at its own amount) is a later slice
        requireCurrency(accounts.require(owner, req.getFromAccountId()), req.getCurrency());
        requireCurrency(accounts.require(owner, req.getToAccountId()), req.getCurrency());
        Booking booking = fx.book(req.getCurrency(), req.getAmountMinor(), req.getDate(), settings.today(owner));
        UUID pairId = writeTransfer(owner, req.getFromAccountId(), req.getToAccountId(), req.getAmountMinor(),
            req.getCurrency(), booking, req.getDate(), blankToNull(req.getNote()), req.getClientRef());
        return legs(owner, pairId);
    }

    /**
     * Writes one transfer pair with an already-booked twin and returns its pair id (the month close uses it
     * too). With a {@code clientRef} the out leg is the idempotent native insert; when a concurrent duplicate
     * won, its pair id is returned and nothing else is written.
     */
    @Transactional
    public UUID writeTransfer(UUID owner, UUID fromAccountId, UUID toAccountId, long amountMinor, String currency,
                              Booking booking, LocalDate date, String note, UUID clientRef) {
        UUID pairId = UUID.randomUUID();
        PenzTransactionEntity out = leg(owner, fromAccountId, PenzTransactionEntity.KIND_TRANSFER_OUT, amountMinor,
            currency, booking, date, note, pairId);
        out.setClientRef(clientRef);
        PenzTransactionEntity stored = store(out);
        if (!pairId.equals(stored.getTransferPairId())) {
            return requirePairId(stored); // a concurrent duplicate of this client ref won the race
        }
        repository.saveAndFlush(leg(owner, toAccountId, PenzTransactionEntity.KIND_TRANSFER_IN, amountMinor, currency,
            booking, date, note, pairId));
        return pairId;
    }

    /** The owner's live transaction, else 404 {@code PENZ_TRANSACTION_NOT_FOUND}. */
    @Transactional(readOnly = true)
    public PenzTransactionEntity require(UUID owner, UUID id) {
        return repository.findByIdAndCreatedByAndDeletedFalse(id, owner)
            .orElseThrow(() -> PenzErrors.notFound("PENZ_TRANSACTION_NOT_FOUND"));
    }

    /**
     * 409 {@code PENZ_TRANSACTION_INVEST_LINKED} when the row is the money row of a live investment buy / sell
     * (mezo-r36n9.119): it changes only through the investment record, so the two never drift.
     */
    private void requireNotInvestLinked(UUID owner, UUID id) {
        if (investTxns.existsByCreatedByAndTransactionIdAndDeletedFalse(owner, id)) {
            throw PenzErrors.conflict("PENZ_TRANSACTION_INVEST_LINKED");
        }
    }

    /** 400 {@code PENZ_CURRENCY_MISMATCH} unless {@code currency} is the account's own currency. */
    static void requireCurrency(PenzAccountEntity account, String currency) {
        if (!account.getCurrency().equals(currency)) {
            throw PenzErrors.badRequest("PENZ_CURRENCY_MISMATCH");
        }
    }

    /**
     * The pair id of the row a transfer's client ref replayed; 409 {@code PENZ_CLIENT_REF_CONFLICT} when that ref
     * belongs to a plain transaction (never query the legs with a null pair id — that is every non-transfer row).
     */
    private static UUID requirePairId(PenzTransactionEntity replayed) {
        if (replayed.getTransferPairId() == null) {
            throw PenzErrors.conflict("PENZ_CLIENT_REF_CONFLICT");
        }
        return replayed.getTransferPairId();
    }

    private List<PenzTransactionResponse> legs(UUID owner, UUID pairId) {
        return repository.findByCreatedByAndTransferPairIdAndDeletedFalse(owner, pairId).stream()
            .sorted(Comparator.comparing((PenzTransactionEntity t) ->
                !PenzTransactionEntity.KIND_TRANSFER_OUT.equals(t.getKind())))
            .map(mapper::toResponse)
            .toList();
    }

    /** Saves a new row; with a client ref through the idempotent native insert and a read-back. */
    private PenzTransactionEntity store(PenzTransactionEntity row) {
        if (row.getClientRef() == null) {
            return repository.saveAndFlush(row);
        }
        repository.insertIfAbsent(row.getCreatedBy(), row.getAccountId(), row.getKind(), row.getAmountMinor(),
            row.getCurrency(), row.getAmountHufMinor(), row.getFxRate(), row.getFxRateDate(), row.getCategoryId(),
            row.getDate(), row.getNote(), row.getSource(), row.isNeedsReview(), row.getTransferPairId(),
            row.getClientRef());
        return repository.findByCreatedByAndClientRefAndDeletedFalse(row.getCreatedBy(), row.getClientRef())
            .orElseThrow(); // just inserted, or the concurrent winner
    }

    private static PenzTransactionEntity leg(UUID owner, UUID accountId, String kind, long amountMinor,
                                             String currency, Booking booking, LocalDate date, String note,
                                             UUID pairId) {
        PenzTransactionEntity t = new PenzTransactionEntity();
        t.setCreatedBy(owner);
        t.setAccountId(accountId);
        t.setKind(kind);
        setAmount(t, amountMinor, currency, booking);
        t.setDate(date);
        t.setNote(note);
        t.setTransferPairId(pairId);
        return t;
    }

    private static void setAmount(PenzTransactionEntity row, long amountMinor, String currency, Booking booking) {
        row.setAmountMinor(amountMinor);
        row.setCurrency(currency);
        row.setAmountHufMinor(booking.hufMinor());
        row.setFxRate(booking.rate());
        row.setFxRateDate(booking.rateDate());
    }

    /**
     * Editing the amount, the currency or the date invalidates the stored HUF twin (the old app's
     * {@code needsHufRecompute}); any other edit keeps it — history is never re-derived.
     */
    static boolean needsHufRecompute(long oldAmountMinor, String oldCurrency, LocalDate oldDate,
                                     long newAmountMinor, String newCurrency, LocalDate newDate) {
        return oldAmountMinor != newAmountMinor || !oldCurrency.equals(newCurrency) || !oldDate.equals(newDate);
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.strip();
    }
}
