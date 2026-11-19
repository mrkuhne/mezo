package io.mrkuhne.mezo.feature.penz.service.sms;

import io.mrkuhne.mezo.feature.penz.service.money.FxConversion;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.UUID;

/**
 * A parsed bank SMS → its review transaction, the pure half (Boop Pénz L4, mezo-r36n9.102) — port of the old
 * {@code src/app/smsConversion.ts} {@code pickSmsAccount} / {@code convertMinor} / {@code planSmsTxn}. The old
 * {@code dedupePending} is replaced by the database (one live SMS per owner and text hash, and one transaction
 * per SMS); {@code matchInvestTxnForSms} (adopting a recorded invest buy) is L6.
 */
public final class SmsConversion {

    private SmsConversion() {
    }

    /** What the conversion needs of an account. */
    public record AccountRef(UUID id, String currency, boolean isDefault, boolean archived, String smsSender) {
    }

    /** What the conversion needs of a category. */
    public record CategoryRef(UUID id, String name, String kind) {
    }

    /** A parsed SMS: kind expense|income, the amount in its own currency, the guarded merchant/date/category. */
    public record ParsedSms(UUID id, String kind, long amountMinor, String currency, String merchant, LocalDate date,
                            String categoryName) {
    }

    /**
     * The planned transaction: always in the ACCOUNT's currency ({@code converted} when the SMS was in another
     * one); {@code amountHufMinor} is its HUF twin at the account currency's rate.
     */
    public record SmsTxnPlan(UUID accountId, String kind, long amountMinor, String currency, long amountHufMinor,
                             UUID categoryId, LocalDate date, String note, UUID smsMessageId, boolean converted) {
    }

    /** The account for an SMS sender: matching {@code smsSender} (trimmed, case-insensitive), else the default,
     *  else the first; an archived account is never chosen. Null when there is none. */
    public static AccountRef pickAccount(String sender, List<AccountRef> accounts) {
        List<AccountRef> live = accounts.stream().filter(a -> !a.archived()).toList();
        String s = norm(sender);
        return live.stream().filter(a -> a.smsSender() != null && norm(a.smsSender()).equals(s)).findFirst()
            .or(() -> live.stream().filter(AccountRef::isDefault).findFirst())
            .or(() -> live.stream().findFirst())
            .orElse(null);
    }

    /** {@code amountMinor × from / to} (HUF per unit of each currency), half-up to a whole minor unit. */
    public static long convertMinor(long amountMinor, BigDecimal fromHufPerUnit, BigDecimal toHufPerUnit) {
        return BigDecimal.valueOf(amountMinor).multiply(fromHufPerUnit)
            .divide(toHufPerUnit, 0, RoundingMode.HALF_UP).longValueExact();
    }

    /**
     * Port of {@code planSmsTxn}: the SMS amount converted into the account currency when they differ (the
     * original amount then follows the merchant in the note, {@code "Bistro · 12,50 EUR"}); the category is the
     * owner's one with the SMS's kind and the same name (case-insensitive); source sms and needs-review are set
     * by the caller.
     *
     * @param msgHufPerUnit     HUF per one unit of the SMS currency (1 for HUF).
     * @param accountHufPerUnit HUF per one unit of the account currency (1 for HUF).
     */
    public static SmsTxnPlan plan(ParsedSms msg, AccountRef account, List<CategoryRef> categories,
                                  BigDecimal msgHufPerUnit, BigDecimal accountHufPerUnit) {
        boolean converted = !msg.currency().equals(account.currency());
        long amountMinor = converted
            ? convertMinor(msg.amountMinor(), msgHufPerUnit, accountHufPerUnit) : msg.amountMinor();
        String catName = msg.categoryName() == null ? null : norm(msg.categoryName());
        UUID categoryId = catName == null ? null : categories.stream()
            .filter(c -> Objects.equals(c.kind(), msg.kind()) && norm(c.name()).equals(catName))
            .map(CategoryRef::id).findFirst().orElse(null);
        String note = String.join(" · ", java.util.stream.Stream.of(
                msg.merchant() == null ? "" : msg.merchant(),
                converted ? formatMoney(msg.amountMinor(), msg.currency()) : "")
            .filter(p -> !p.isEmpty()).toList());
        return new SmsTxnPlan(account.id(), msg.kind(), amountMinor, account.currency(),
            FxConversion.toHufMinor(amountMinor, accountHufPerUnit), categoryId, msg.date(), note, msg.id(),
            converted);
    }

    /** Hungarian-style amount for the note: {@code 12,50 EUR}, {@code 15 500 HUF} (whole forints). */
    static String formatMoney(long minor, String currency) {
        boolean huf = "HUF".equals(currency);
        BigDecimal major = BigDecimal.valueOf(minor, 2).setScale(huf ? 0 : 2, RoundingMode.HALF_UP);
        String plain = major.abs().toPlainString();
        String intPart = plain.contains(".") ? plain.substring(0, plain.indexOf('.')) : plain;
        String decPart = plain.contains(".") ? plain.substring(plain.indexOf('.') + 1) : "";
        StringBuilder grouped = new StringBuilder();
        for (int i = 0; i < intPart.length(); i++) {
            if (i > 0 && (intPart.length() - i) % 3 == 0) {
                grouped.append(' ');
            }
            grouped.append(intPart.charAt(i));
        }
        return (major.signum() < 0 ? "-" : "") + grouped + (decPart.isEmpty() ? "" : "," + decPart) + " " + currency;
    }

    private static String norm(String s) {
        return s == null ? "" : s.strip().toLowerCase(Locale.ROOT);
    }
}
