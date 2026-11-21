package io.mrkuhne.mezo.feature.penz.service.sms;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/**
 * An investment buy ↔ its bank-SMS debit, the pure half (Boop Pénz, mezo-r36n9.119) — port of the old app's
 * {@code findSmsCandidates} ({@code src/features/invest/record.ts}) and {@code matchInvestTxnForSms}
 * ({@code src/app/smsConversion.ts}). Both directions use the same window: the amount must be EXACTLY the same in
 * the account's currency and the dates at most {@value #MATCH_DAYS} days apart.
 */
public final class InvestSmsMatch {

    /** Days either side of a buy within which its bank SMS may land. */
    public static final int MATCH_DAYS = 3;

    private static final String KIND_EXPENSE = "expense";
    private static final String KIND_INVEST_BUY = "invest_buy";
    private static final String SOURCE_SMS = "sms";

    private InvestSmsMatch() {
    }

    /** What the matching needs of a money row ({@code penz_transaction}). */
    public record TxnRef(UUID id, UUID accountId, String kind, long amountMinor, LocalDate date, String source,
                         UUID smsMessageId, UUID recurringRuleId) {
    }

    /**
     * Whether {@code t} is a bank-SMS debit a buy of {@code amountMinor} (account currency) on {@code accountId} dated
     * {@code date} may adopt: an expense on that account that came from an SMS (or carries one), not a recurring
     * occurrence, not already linked to an investment ({@code linkedIds}), the same amount, within ±3 days. The account
     * must receive SMS at all ({@code accountHasSmsSender}).
     */
    public static boolean isSmsCandidate(boolean accountHasSmsSender, UUID accountId, long amountMinor, LocalDate date,
                                         TxnRef t, Set<UUID> linkedIds) {
        return accountHasSmsSender
            && Objects.equals(t.accountId(), accountId)
            && KIND_EXPENSE.equals(t.kind())
            && (SOURCE_SMS.equals(t.source()) || t.smsMessageId() != null)
            && t.recurringRuleId() == null
            && !linkedIds.contains(t.id())
            && t.amountMinor() == amountMinor
            && daysApart(t.date(), date) <= MATCH_DAYS;
    }

    /** Every {@link #isSmsCandidate} row, closest date first, then the earlier date. Empty without an SMS sender. */
    public static List<TxnRef> smsCandidates(boolean accountHasSmsSender, UUID accountId, long amountMinor,
                                             LocalDate date, List<TxnRef> txns, Set<UUID> linkedIds) {
        if (!accountHasSmsSender) {
            return List.of();
        }
        return txns.stream()
            .filter(t -> isSmsCandidate(true, accountId, amountMinor, date, t, linkedIds))
            .sorted(closestTo(date))
            .toList();
    }

    /**
     * A buy recorded before its bank SMS arrived: for a planned SMS row of {@code plannedKind} on
     * {@code accountId}, the {@code invest_buy} on the same account with the same amount (account currency), no SMS
     * linked yet and a date within ±3 days. The closest date wins, then the earlier one. Empty for anything but a
     * planned expense (the SMS then becomes a normal expense).
     */
    public static Optional<TxnRef> matchInvestBuyForSms(String plannedKind, UUID accountId, long amountMinor,
                                                        LocalDate plannedDate, List<TxnRef> txns) {
        if (!KIND_EXPENSE.equals(plannedKind)) {
            return Optional.empty();
        }
        return txns.stream()
            .filter(t -> KIND_INVEST_BUY.equals(t.kind())
                && Objects.equals(t.accountId(), accountId)
                && t.amountMinor() == amountMinor
                && t.smsMessageId() == null
                && daysApart(t.date(), plannedDate) <= MATCH_DAYS)
            .min(closestTo(plannedDate));
    }

    static long daysApart(LocalDate a, LocalDate b) {
        return Math.abs(ChronoUnit.DAYS.between(a, b));
    }

    private static Comparator<TxnRef> closestTo(LocalDate date) {
        return Comparator.comparingLong((TxnRef t) -> daysApart(t.date(), date)).thenComparing(TxnRef::date);
    }
}
