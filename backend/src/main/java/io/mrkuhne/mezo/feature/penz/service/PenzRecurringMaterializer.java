package io.mrkuhne.mezo.feature.penz.service;

import io.mrkuhne.mezo.feature.penz.entity.PenzRecurringRuleEntity;
import io.mrkuhne.mezo.feature.penz.repository.PenzRecurringRuleRepository;
import io.mrkuhne.mezo.feature.penz.repository.PenzTransactionRepository;
import io.mrkuhne.mezo.feature.penz.service.PenzFxService.Booking;
import io.mrkuhne.mezo.feature.penz.service.engine.Recurrence;
import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Writes the due occurrences of the owner's recurring rules as transactions (Boop Pénz L4, mezo-r36n9.102; a port
 * of the old app's {@code src/app/materialize.ts}). No cron: the allowance and transaction-list reads call it
 * first, and it is cheap when nothing is due (one rule query, no write).
 *
 * <p>For every ACTIVE rule, each occurrence of {@link Recurrence#dueOccurrences} (after
 * {@code last_materialized_date}, up to today) becomes one transaction: the rule's kind, account, category and
 * amount, its HUF twin booked through the one FX policy at the OCCURRENCE's date, source {@code recurring},
 * {@code needs_review} false. The write is a native {@code INSERT … ON CONFLICT DO NOTHING} on the partial unique
 * index {@code (recurring_rule_id, date)} — idempotent across concurrent reads and against a row another writer
 * already made (it is skipped, the rule still advances). After the last due occurrence the rule's
 * {@code last_materialized_date} moves to it.
 *
 * <p>A rate that cannot be booked (provider down, nothing cached) stops THAT rule at that occurrence: rows already
 * written stay, {@code last_materialized_date} does not move, the next read completes it without duplicates — the
 * old app's "keeps partial progress" — and the read itself never fails over it (the engine projects the missing
 * occurrences at the rule's current amount meanwhile).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PenzRecurringMaterializer {

    private final PenzRecurringRuleRepository rules;
    private final PenzTransactionRepository transactions;
    private final PenzFxService fx;

    /** Materializes everything due on {@code today} (the owner's today); returns how many rows were written. */
    @Transactional
    public int materializeDue(UUID owner, LocalDate today) {
        int created = 0;
        for (PenzRecurringRuleEntity rule : rules.findByCreatedByAndDeletedFalseOrderByNameAsc(owner)) {
            List<LocalDate> due = Recurrence.dueOccurrences(PenzEngineInputs.rule(rule), today);
            if (due.isEmpty()) {
                continue;
            }
            boolean complete = true;
            for (LocalDate date : due) {
                Optional<Booking> booking = fx.tryBook(rule.getCurrency(), rule.getAmountMinor(), date, today);
                if (booking.isEmpty()) {
                    log.warn("recurring rule {}: no {} rate for {}, materialization resumes on a later read",
                        rule.getId(), rule.getCurrency(), date);
                    complete = false;
                    break;
                }
                Booking b = booking.get();
                created += transactions.insertRecurringIfAbsent(owner, rule.getAccountId(), rule.getKind(),
                    rule.getAmountMinor(), rule.getCurrency(), b.hufMinor(), b.rate(), b.rateDate(),
                    rule.getCategoryId(), date, rule.getId());
            }
            if (complete) {
                rule.setLastMaterializedDate(due.getLast());
                rule.setUpdatedAt(Instant.now().truncatedTo(ChronoUnit.MICROS));
                rules.saveAndFlush(rule);
            }
        }
        return created;
    }
}
