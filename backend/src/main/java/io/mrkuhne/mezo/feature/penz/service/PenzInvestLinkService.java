package io.mrkuhne.mezo.feature.penz.service;

import io.mrkuhne.mezo.api.dto.PenzTransactionResponse;
import io.mrkuhne.mezo.feature.penz.entity.PenzAccountEntity;
import io.mrkuhne.mezo.feature.penz.entity.PenzInvestTxnEntity;
import io.mrkuhne.mezo.feature.penz.entity.PenzTransactionEntity;
import io.mrkuhne.mezo.feature.penz.mapper.PenzMapper;
import io.mrkuhne.mezo.feature.penz.repository.PenzInvestTxnRepository;
import io.mrkuhne.mezo.feature.penz.repository.PenzTransactionRepository;
import io.mrkuhne.mezo.feature.penz.service.PenzFxService.Booking;
import io.mrkuhne.mezo.feature.penz.service.sms.InvestSmsMatch;
import io.mrkuhne.mezo.feature.penz.service.sms.InvestSmsMatch.TxnRef;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * An investment buy / sell ↔ the money account it was paid from / into (Boop Pénz, mezo-r36n9.119). The app never
 * moves money: the linked money row only RECORDS what he already did on his own platform, so the account balance and
 * the allowance "invested" line see it.
 *
 * <ul>
 *   <li>Only a live, non-archived {@code checking} or {@code cash} account can pay (the old app's
 *       {@code payableAccounts}).</li>
 *   <li>The money row is in the ACCOUNT's currency ({@link #accountAmount}); its HUF twin is booked by the one FX
 *       policy ({@link PenzFxService}) like every transaction's.</li>
 *   <li>A bank-SMS debit can BECOME the money row of a buy ({@link #requireSmsCandidate}, {@link #adopt}); the
 *       candidates rule is {@link InvestSmsMatch}.</li>
 *   <li>Releasing a link (the investment record is deleted): a money row carrying a bank SMS (the debit really
 *       happened) reverts to an expense / income waiting for review; any other is soft-deleted.</li>
 * </ul>
 */
@Service
@RequiredArgsConstructor
public class PenzInvestLinkService {

    private static final String SIDE_BUY = "buy";

    private final PenzTransactionRepository transactions;
    private final PenzInvestTxnRepository investTxns;
    private final PenzAccountService accounts;
    private final PenzFxService fx;
    private final PenzSettingsService settings;
    private final PenzMapper mapper;

    /**
     * The owner's live, non-archived account that can pay: 404 {@code PENZ_ACCOUNT_NOT_FOUND} (not his, deleted or
     * archived), 400 on {@code accountId} for a savings or investment account.
     */
    public PenzAccountEntity requirePayable(UUID owner, UUID accountId) {
        PenzAccountEntity account = accounts.require(owner, accountId);
        if (account.isArchived()) {
            throw PenzErrors.notFound("PENZ_ACCOUNT_NOT_FOUND");
        }
        if (!PenzAccountEntity.TYPE_CHECKING.equals(account.getType())
            && !PenzAccountEntity.TYPE_CASH.equals(account.getType())) {
            throw PenzErrors.field("accountId");
        }
        return account;
    }

    /**
     * The amount in the ACCOUNT's currency: {@code explicitMinor} when he gave it; else the investment amount itself
     * when the currencies agree; else its HUF twin on a HUF account; else the HUF twin ÷ the account currency's
     * booking rate of {@code date}, HALF_UP to a whole minor unit (through {@link PenzFxService}, never a second rate
     * path).
     */
    public long accountAmount(PenzAccountEntity account, Long explicitMinor, String investCurrency,
                              long investAmountMinor, long investHufMinor, LocalDate date, LocalDate today) {
        if (explicitMinor != null) {
            return explicitMinor;
        }
        if (account.getCurrency().equals(investCurrency)) {
            return investAmountMinor;
        }
        if (PenzFxService.HUF.equals(account.getCurrency())) {
            return investHufMinor;
        }
        BigDecimal hufPerUnit = fx.book(account.getCurrency(), 1, date, today).rate();
        long converted = BigDecimal.valueOf(investHufMinor).divide(hufPerUnit, 0, RoundingMode.HALF_UP)
            .longValueExact();
        if (converted <= 0) {
            throw PenzErrors.field("accountAmountMinor");
        }
        return converted;
    }

    /** Writes the money row of a freshly stored investment transaction and returns it. */
    public PenzTransactionEntity createMoneyRow(UUID owner, PenzAccountEntity account, String side, long amountMinor,
                                                LocalDate date, String holdingName) {
        Booking booking = fx.book(account.getCurrency(), amountMinor, date, settings.today(owner));
        PenzTransactionEntity t = new PenzTransactionEntity();
        t.setCreatedBy(owner);
        t.setAccountId(account.getId());
        t.setKind(SIDE_BUY.equals(side) ? PenzTransactionEntity.KIND_INVEST_BUY : PenzTransactionEntity.KIND_INVEST_SELL);
        t.setAmountMinor(amountMinor);
        t.setCurrency(account.getCurrency());
        t.setAmountHufMinor(booking.hufMinor());
        t.setFxRate(booking.rate());
        t.setFxRateDate(booking.rateDate());
        t.setDate(date);
        t.setNote(holdingName);
        t.setSource(PenzTransactionEntity.SOURCE_MANUAL);
        t.setNeedsReview(false);
        return transactions.saveAndFlush(t);
    }

    /**
     * The bank-SMS debit {@code transactionId} a buy of {@code amountMinor} (account currency) dated {@code date} on
     * {@code account} adopts — 404 {@code PENZ_TRANSACTION_NOT_FOUND} when it is not his, 409
     * {@code PENZ_SMS_LINK_MISMATCH} when it fails the candidates rule.
     */
    public PenzTransactionEntity requireSmsCandidate(UUID owner, PenzAccountEntity account, UUID transactionId,
                                                     long amountMinor, LocalDate date) {
        PenzTransactionEntity t = transactions.findByIdAndCreatedByAndDeletedFalse(transactionId, owner)
            .orElseThrow(() -> PenzErrors.notFound("PENZ_TRANSACTION_NOT_FOUND"));
        Set<UUID> linked = linkedIds(owner, List.of(t.getId()));
        if (!InvestSmsMatch.isSmsCandidate(hasSmsSender(account), account.getId(), amountMinor, date, ref(t), linked)) {
            throw PenzErrors.conflict("PENZ_SMS_LINK_MISMATCH");
        }
        return t;
    }

    /** The bank-SMS expense becomes the buy's money row: kind invest_buy, no category, reviewed, the holding's name. */
    public PenzTransactionEntity adopt(PenzTransactionEntity t, String holdingName) {
        t.setKind(PenzTransactionEntity.KIND_INVEST_BUY);
        t.setCategoryId(null);
        t.setNeedsReview(false);
        t.setNote(holdingName);
        t.setUpdatedAt(now());
        return transactions.saveAndFlush(t);
    }

    /** {@code GET /api/penz/invest-transactions/sms-candidates}: closest date first; empty without an SMS sender. */
    @Transactional(readOnly = true)
    public List<PenzTransactionResponse> smsCandidates(UUID owner, UUID accountId, long amountMinor, LocalDate date) {
        PenzAccountEntity account = accounts.require(owner, accountId);
        if (!hasSmsSender(account)) {
            return List.of();
        }
        List<PenzTransactionEntity> rows = transactions.findByCreatedByAndAccountIdAndDateBetweenAndDeletedFalse(owner,
            accountId, date.minusDays(InvestSmsMatch.MATCH_DAYS), date.plusDays(InvestSmsMatch.MATCH_DAYS));
        Map<UUID, PenzTransactionEntity> byId = rows.stream()
            .collect(Collectors.toMap(PenzTransactionEntity::getId, Function.identity()));
        Set<UUID> linked = linkedIds(owner, byId.keySet());
        return InvestSmsMatch.smsCandidates(true, accountId, amountMinor, date,
                rows.stream().map(PenzInvestLinkService::ref).toList(), linked).stream()
            .map(r -> mapper.toResponse(byId.get(r.id())))
            .toList();
    }

    /**
     * Releases the money row of a deleted investment transaction: one carrying a bank SMS reverts to an expense (a
     * buy) / income (a sell) waiting for review; any other is soft-deleted.
     */
    public void release(UUID owner, PenzInvestTxnEntity investTxn) {
        if (investTxn.getTransactionId() == null) {
            return;
        }
        transactions.findByIdAndCreatedByAndDeletedFalse(investTxn.getTransactionId(), owner).ifPresent(t -> {
            if (t.getSmsMessageId() != null) {
                t.setKind(SIDE_BUY.equals(investTxn.getSide())
                    ? PenzTransactionEntity.KIND_EXPENSE : PenzTransactionEntity.KIND_INCOME);
                t.setNeedsReview(true);
                t.setUpdatedAt(now());
                transactions.save(t);
            } else {
                transactions.delete(t);
            }
            transactions.flush();
        });
    }

    /** The account of every linked money row among {@code rows} (money row id → account id). */
    public Map<UUID, UUID> accountsOf(Collection<PenzInvestTxnEntity> rows) {
        List<UUID> ids = rows.stream().map(PenzInvestTxnEntity::getTransactionId).filter(Objects::nonNull).toList();
        Map<UUID, UUID> out = new HashMap<>();
        if (!ids.isEmpty()) {
            transactions.findAllById(ids).forEach(t -> out.put(t.getId(), t.getAccountId()));
        }
        return out;
    }

    private Set<UUID> linkedIds(UUID owner, Collection<UUID> transactionIds) {
        if (transactionIds.isEmpty()) {
            return Set.of();
        }
        return investTxns.findByCreatedByAndTransactionIdInAndDeletedFalse(owner, transactionIds).stream()
            .map(PenzInvestTxnEntity::getTransactionId).collect(Collectors.toSet());
    }

    private static boolean hasSmsSender(PenzAccountEntity account) {
        return account.getSmsSender() != null && !account.getSmsSender().isBlank();
    }

    /** What {@link InvestSmsMatch} needs of a money row. */
    public static TxnRef ref(PenzTransactionEntity t) {
        return new TxnRef(t.getId(), t.getAccountId(), t.getKind(), t.getAmountMinor(), t.getDate(), t.getSource(),
            t.getSmsMessageId(), t.getRecurringRuleId());
    }

    private static Instant now() {
        return Instant.now().truncatedTo(ChronoUnit.MICROS);
    }
}
