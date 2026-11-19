package io.mrkuhne.mezo.feature.penz.service;

import io.mrkuhne.mezo.api.dto.PenzAllowanceResponse;
import io.mrkuhne.mezo.feature.penz.mapper.PenzMapper;
import io.mrkuhne.mezo.feature.penz.repository.PenzMonthCloseRepository;
import io.mrkuhne.mezo.feature.penz.repository.PenzRecurringRuleRepository;
import io.mrkuhne.mezo.feature.penz.repository.PenzTransactionRepository;
import io.mrkuhne.mezo.feature.penz.service.engine.AllowanceEngine;
import io.mrkuhne.mezo.feature.penz.service.engine.AllowanceSettings;
import io.mrkuhne.mezo.feature.penz.service.engine.MonthCloseInput;
import io.mrkuhne.mezo.feature.penz.service.engine.MonthCloseRules;
import io.mrkuhne.mezo.feature.penz.service.engine.MonthlyAllowance;
import io.mrkuhne.mezo.feature.penz.service.engine.PenzDates;
import io.mrkuhne.mezo.feature.penz.service.engine.RecurringRuleInput;
import io.mrkuhne.mezo.feature.penz.service.engine.TxnInput;
import io.mrkuhne.mezo.feature.penz.service.engine.WeeklyAllowance;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The allowance (Boop Pénz L4, mezo-r36n9.102): maps the owner's rows into the pure {@link AllowanceEngine} and
 * back — the old app's {@code buildHomeModel} minus the display parts.
 *
 * <p>Inputs: every live transaction touching the month(s) (the stored HUF twins), every live recurring rule
 * (paused and ended ones too — the engine decides), the settings ({@code savings_target_minor}, the Gyakorlás cap
 * {@code practice_monthly_minor}, per-month savings targets from {@code month_overrides}) and the deficit the
 * previous month's CLOSE carried over ({@link MonthCloseRules#previousDeficit}: 0 while that month is open).
 *
 * <p><b>Per day</b> (old {@code homeModel.ts} {@code perDayLeftMinor}): {@code max(0, week remaining) / days left
 * in the week counting the asked date itself} — Wednesday of a Monday-start week has 5 days left (Wed…Sun). The
 * old app kept the fraction; the server floors it to a whole minor unit (1/100 Ft — invisible on screen).
 */
@Service
@RequiredArgsConstructor
public class PenzAllowanceService {

    private final PenzTransactionRepository transactions;
    private final PenzRecurringRuleRepository rules;
    private final PenzMonthCloseRepository closes;
    private final PenzSettingsService settings;
    private final PenzRecurringMaterializer materializer;
    private final PenzMapper mapper;

    /**
     * The month, week and derivation for {@code date} (null = the owner's today). Due recurring occurrences are
     * materialized first (up to the owner's real today, whatever {@code date} asks).
     */
    @Transactional
    public PenzAllowanceResponse allowance(UUID owner, LocalDate date) {
        LocalDate today = settings.today(owner);
        materializer.materializeDue(owner, today);
        LocalDate d = date == null ? today : date;
        YearMonth month = YearMonth.from(d);
        Inputs in = inputs(owner, month, month.plusMonths(1));
        long previousDeficit = MonthCloseRules.previousDeficit(month, in.closes());
        MonthlyAllowance monthly = AllowanceEngine.monthly(month, in.rules(), in.txns(), in.settings(),
            previousDeficit);
        WeeklyAllowance weekly = AllowanceEngine.weekly(d, in.rules(), in.txns(), in.settings(), previousDeficit);
        return mapper.allowance(d, monthly, weekly, perDay(weekly, d));
    }

    /** {@code max(0, week remaining) / days left in the week including {@code date}}, floored (see the class doc). */
    static long perDay(WeeklyAllowance weekly, LocalDate date) {
        int daysLeftInWeek = PenzDates.daysBetweenInclusive(date, weekly.weekEnd());
        return Math.max(0, weekly.remainingMinor()) / daysLeftInWeek;
    }

    /** The allowance of {@code month} as its close sees it (previous deficit from a closed previous month). */
    @Transactional
    public MonthlyAllowance monthly(UUID owner, YearMonth month) {
        return monthlies(owner, List.of(month)).getFirst();
    }

    /** {@link #monthly} for several months with one load of the inputs. */
    @Transactional
    public List<MonthlyAllowance> monthlies(UUID owner, List<YearMonth> months) {
        if (months.isEmpty()) {
            return List.of();
        }
        YearMonth from = months.stream().min(YearMonth::compareTo).orElseThrow();
        YearMonth to = months.stream().max(YearMonth::compareTo).orElseThrow();
        Inputs in = inputs(owner, from, to);
        return months.stream().map(m -> AllowanceEngine.monthly(m, in.rules(), in.txns(), in.settings(),
            MonthCloseRules.previousDeficit(m, in.closes()))).toList();
    }

    private Inputs inputs(UUID owner, YearMonth from, YearMonth to) {
        List<TxnInput> txns = transactions.findByCreatedByAndDateBetweenAndDeletedFalseOrderByDateDescCreatedAtDesc(
            owner, from.atDay(1), to.atEndOfMonth()).stream().map(PenzEngineInputs::txn).toList();
        List<RecurringRuleInput> ruleInputs = rules.findByCreatedByAndDeletedFalseOrderByNameAsc(owner).stream()
            .map(PenzEngineInputs::rule).toList();
        List<MonthCloseInput> closeInputs = closes.findByCreatedByAndDeletedFalseOrderByMonthDesc(owner).stream()
            .map(PenzEngineInputs::close).toList();
        return new Inputs(txns, ruleInputs, closeInputs, settings.allowanceSettings(owner));
    }

    private record Inputs(List<TxnInput> txns, List<RecurringRuleInput> rules, List<MonthCloseInput> closes,
                          AllowanceSettings settings) {
    }
}
