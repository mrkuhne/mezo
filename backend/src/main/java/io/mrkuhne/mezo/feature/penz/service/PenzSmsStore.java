package io.mrkuhne.mezo.feature.penz.service;

import io.mrkuhne.mezo.feature.penz.entity.PenzSmsMessageEntity;
import io.mrkuhne.mezo.feature.penz.entity.PenzTransactionEntity;
import io.mrkuhne.mezo.feature.penz.repository.PenzSmsMessageRepository;
import io.mrkuhne.mezo.feature.penz.repository.PenzTransactionRepository;
import io.mrkuhne.mezo.feature.penz.service.sms.SmsConversion.SmsTxnPlan;
import io.mrkuhne.mezo.feature.penz.service.sms.SmsIngestLogic.Normalized;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The writes of the SMS ingest (Boop Pénz L4, mezo-r36n9.102), each one short transaction — the slow LLM call
 * and the FX fetch happen BEFORE, outside any transaction. Every SMS goes in through the native
 * {@code INSERT … ON CONFLICT (created_by, text_hash) DO NOTHING}: an empty result means the owner already has
 * this SMS (a replay, or a concurrent duplicate that won), and nothing else is written.
 */
@Service
@RequiredArgsConstructor
public class PenzSmsStore {

    public static final String STATUS_CONVERTED = "converted";
    public static final String SOURCE_SMS = "sms";

    private final PenzSmsMessageRepository messages;
    private final PenzTransactionRepository transactions;

    /** The SMS as received: owner, trimmed sender and text, dedupe hash, receive instant. */
    public record Received(UUID owner, String sender, String text, String textHash, Instant receivedAt) {
    }

    /**
     * Stores an SMS that books nothing ({@code ignored}, {@code failed}, or {@code parsed} without an account /
     * rate). {@code keepText} false drops the text (ignored SMS: OTP codes and the like are never kept — nor is any
     * SMS text kept in the LLM audit log, whose {@code penz_sms} rows are payload-free).
     */
    @Transactional
    public Optional<PenzSmsMessageEntity> store(Received sms, Normalized result, String reason, boolean keepText) {
        boolean parsed = result.isParsed();
        int inserted = messages.insertIfAbsent(sms.owner(), sms.sender(), keepText ? sms.text() : null,
            sms.textHash(), sms.receivedAt(), result.status(), reason,
            parsed ? result.kind() : null, parsed ? result.amountMinor() : null, parsed ? result.currency() : null,
            parsed ? result.merchant() : null, parsed ? result.date() : null, parsed ? result.categoryName() : null);
        return inserted == 0 ? Optional.empty() : messages.findByCreatedByAndTextHashAndDeletedFalse(sms.owner(),
            sms.textHash());
    }

    /**
     * Stores a parsed SMS AND its review transaction in one transaction: the message goes in as {@code parsed},
     * the transaction (source sms, needs review, linked by {@code sms_message_id}) is written with the booked HUF
     * twin, then the message flips to {@code converted} with the transaction id. Empty for a duplicate.
     */
    @Transactional
    public Optional<PenzTransactionEntity> storeConverted(Received sms, Normalized result, SmsTxnPlan plan,
                                                          PenzFxService.Booking booking) {
        Optional<PenzSmsMessageEntity> stored = store(sms, result, null, true);
        if (stored.isEmpty()) {
            return Optional.empty();
        }
        PenzSmsMessageEntity msg = stored.get();
        PenzTransactionEntity t = new PenzTransactionEntity();
        t.setCreatedBy(sms.owner());
        t.setAccountId(plan.accountId());
        t.setKind(plan.kind());
        t.setAmountMinor(plan.amountMinor());
        t.setCurrency(plan.currency());
        t.setAmountHufMinor(booking.hufMinor());
        t.setFxRate(booking.rate());
        t.setFxRateDate(booking.rateDate());
        t.setCategoryId(plan.categoryId());
        t.setDate(plan.date());
        t.setNote(plan.note().isEmpty() ? null : plan.note());
        t.setSource(SOURCE_SMS);
        t.setNeedsReview(true);
        t.setSmsMessageId(msg.getId());
        PenzTransactionEntity txn = transactions.saveAndFlush(t);
        msg.setStatus(STATUS_CONVERTED);
        msg.setTransactionId(txn.getId());
        messages.saveAndFlush(msg);
        return Optional.of(txn);
    }
}
