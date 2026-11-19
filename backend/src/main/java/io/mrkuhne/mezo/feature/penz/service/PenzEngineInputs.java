package io.mrkuhne.mezo.feature.penz.service;

import io.mrkuhne.mezo.feature.penz.entity.PenzMonthCloseEntity;
import io.mrkuhne.mezo.feature.penz.entity.PenzRecurringRuleEntity;
import io.mrkuhne.mezo.feature.penz.entity.PenzTransactionEntity;
import io.mrkuhne.mezo.feature.penz.service.engine.Frequency;
import io.mrkuhne.mezo.feature.penz.service.engine.MonthCloseInput;
import io.mrkuhne.mezo.feature.penz.service.engine.RecurringRuleInput;
import io.mrkuhne.mezo.feature.penz.service.engine.RuleKind;
import io.mrkuhne.mezo.feature.penz.service.engine.TxnInput;
import io.mrkuhne.mezo.feature.penz.service.engine.TxnKind;
import java.time.YearMonth;
import java.util.Locale;

/** Pénz rows → the pure engine's input records (wire/DB values are the lower-case enum names). */
final class PenzEngineInputs {

    private PenzEngineInputs() {
    }

    static TxnInput txn(PenzTransactionEntity t) {
        return new TxnInput(t.getAccountId(), TxnKind.valueOf(t.getKind().toUpperCase(Locale.ROOT)),
            t.getAmountMinor(), t.getCurrency(), t.getAmountHufMinor(), t.getDate(), t.getRecurringRuleId());
    }

    static RecurringRuleInput rule(PenzRecurringRuleEntity r) {
        return new RecurringRuleInput(r.getId(), RuleKind.valueOf(r.getKind().toUpperCase(Locale.ROOT)),
            r.getAmountHufMinor(), Frequency.valueOf(r.getFrequency().toUpperCase(Locale.ROOT)), r.getStartDate(),
            r.getEndDate(), r.getLastMaterializedDate(), r.isActive());
    }

    static MonthCloseInput close(PenzMonthCloseEntity c) {
        return new MonthCloseInput(YearMonth.parse(c.getMonth()), c.getDeficitMinor());
    }
}
