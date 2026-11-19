package io.mrkuhne.mezo.feature.penz.service;

import io.mrkuhne.mezo.api.dto.PenzTransactionRequest;
import io.mrkuhne.mezo.api.dto.PenzTransactionResponse;
import io.mrkuhne.mezo.api.dto.PenzTransferRequest;
import io.mrkuhne.mezo.feature.penz.entity.PenzTransactionEntity;
import io.mrkuhne.mezo.feature.penz.mapper.PenzMapper;
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
        accounts.require(owner, req.getAccountId());
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
        accounts.require(owner, req.getAccountId());
        boolean transfer = row.getTransferPairId() != null && TRANSFER_KINDS.contains(row.getKind());
        if (transfer ? !row.getKind().equals(req.getKind()) : TRANSFER_KINDS.contains(req.getKind())) {
            throw PenzErrors.field("kind");
        }
        boolean rebook = needsHufRecompute(row.getAmountMinor(), row.getCurrency(), row.getDate(),
            req.getAmountMinor(), req.getCurrency(), req.getDate());
        Booking booking = rebook
            ? fx.book(req.getCurrency(), req.getAmountMinor(), req.getDate(), settings.today(owner))
            : new Booking(row.getAmountHufMinor(), row.getFxRate(), row.getFxRateDate());
        Instant now = Instant.now().truncatedTo(ChronoUnit.MICROS);
        if (transfer) {
            for (PenzTransactionEntity leg : repository.findByCreatedByAndTransferPairIdAndDeletedFalse(owner,
                    row.getTransferPairId())) {
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

    /** Soft delete; a transfer leg takes its pair with it. */
    @Transactional
    public void delete(UUID owner, UUID id) {
        PenzTransactionEntity row = require(owner, id);
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
                return legs(owner, replay.get().getTransferPairId());
            }
        }
        accounts.require(owner, req.getFromAccountId());
        accounts.require(owner, req.getToAccountId());
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
            return stored.getTransferPairId(); // a concurrent duplicate of this client ref won the race
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
