package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.penz.entity.PenzAccountEntity;
import io.mrkuhne.mezo.feature.penz.entity.PenzCategoryEntity;
import io.mrkuhne.mezo.feature.penz.entity.PenzFxRateEntity;
import io.mrkuhne.mezo.feature.penz.entity.PenzMonthCloseEntity;
import io.mrkuhne.mezo.feature.penz.entity.PenzRecurringRuleEntity;
import io.mrkuhne.mezo.feature.penz.entity.PenzSavingsGoalEntity;
import io.mrkuhne.mezo.feature.penz.entity.PenzSettingsEntity;
import io.mrkuhne.mezo.feature.penz.entity.PenzTransactionEntity;
import io.mrkuhne.mezo.feature.penz.repository.PenzAccountRepository;
import io.mrkuhne.mezo.feature.penz.repository.PenzCategoryRepository;
import io.mrkuhne.mezo.feature.penz.repository.PenzFxRateRepository;
import io.mrkuhne.mezo.feature.penz.repository.PenzMonthCloseRepository;
import io.mrkuhne.mezo.feature.penz.repository.PenzRecurringRuleRepository;
import io.mrkuhne.mezo.feature.penz.repository.PenzSavingsGoalRepository;
import io.mrkuhne.mezo.feature.penz.repository.PenzSettingsRepository;
import io.mrkuhne.mezo.feature.penz.repository.PenzTransactionRepository;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.test.context.TestComponent;

/**
 * Boop Pénz rows (L4, mezo-r36n9.102). Amounts are invented, real-looking figures in minor units
 * (1/100 of the major unit: 12 990 Ft = 1_299_000) — never the owner's real money.
 */
@TestComponent
@RequiredArgsConstructor
public class PenzPopulator {

    private final PenzSettingsRepository settingsRepository;
    private final PenzAccountRepository accountRepository;
    private final PenzCategoryRepository categoryRepository;
    private final PenzTransactionRepository transactionRepository;
    private final PenzMonthCloseRepository monthCloseRepository;
    private final PenzRecurringRuleRepository recurringRuleRepository;
    private final PenzFxRateRepository fxRateRepository;
    private final PenzSavingsGoalRepository savingsGoalRepository;

    public PenzSettingsEntity settings(UUID owner, long savingsTargetMinor) {
        PenzSettingsEntity e = new PenzSettingsEntity();
        e.setCreatedBy(owner);
        e.setSavingsTargetMinor(savingsTargetMinor);
        e.setPracticeMonthlyMinor(2_000_000L);
        return settingsRepository.saveAndFlush(e);
    }

    /** A HUF checking account. */
    public PenzAccountEntity account(UUID owner, String name, boolean isDefault) {
        return account(owner, name, "checking", "HUF", isDefault, false);
    }

    /** The savings-target account. */
    public PenzAccountEntity savingsAccount(UUID owner, String name) {
        return account(owner, name, PenzAccountEntity.TYPE_SAVINGS, "HUF", false, true);
    }

    public PenzAccountEntity account(UUID owner, String name, String type, String currency, boolean isDefault,
                                     boolean isSavingsTarget) {
        PenzAccountEntity e = new PenzAccountEntity();
        e.setCreatedBy(owner);
        e.setName(name);
        e.setType(type);
        e.setCurrency(currency);
        e.setDefaultAccount(isDefault);
        e.setSavingsTarget(isSavingsTarget);
        return accountRepository.saveAndFlush(e);
    }

    public PenzCategoryEntity category(UUID owner, String name, String kind) {
        PenzCategoryEntity e = new PenzCategoryEntity();
        e.setCreatedBy(owner);
        e.setName(name);
        e.setKind(kind);
        return categoryRepository.saveAndFlush(e);
    }

    /** A HUF transaction (twin = amount, no fx). */
    public PenzTransactionEntity hufTransaction(UUID owner, UUID accountId, String kind, long amountMinor,
                                                LocalDate date) {
        PenzTransactionEntity e = new PenzTransactionEntity();
        e.setCreatedBy(owner);
        e.setAccountId(accountId);
        e.setKind(kind);
        e.setAmountMinor(amountMinor);
        e.setCurrency("HUF");
        e.setAmountHufMinor(amountMinor);
        e.setDate(date);
        return transactionRepository.saveAndFlush(e);
    }

    /** A monthly-or-other recurring rule with its HUF twin given (no FX lookup). */
    public PenzRecurringRuleEntity recurringRule(UUID owner, UUID accountId, UUID categoryId, String kind,
                                                 long amountMinor, String currency, long amountHufMinor,
                                                 String frequency, LocalDate startDate, boolean active) {
        PenzRecurringRuleEntity e = new PenzRecurringRuleEntity();
        e.setCreatedBy(owner);
        e.setName("Ismétlődő " + kind);
        e.setKind(kind);
        e.setAmountMinor(amountMinor);
        e.setCurrency(currency);
        e.setAmountHufMinor(amountHufMinor);
        e.setCategoryId(categoryId);
        e.setAccountId(accountId);
        e.setFrequency(frequency);
        e.setStartDate(startDate);
        e.setActive(active);
        return recurringRuleRepository.saveAndFlush(e);
    }

    /** A transaction already linked to a recurring rule on {@code date} (as another writer would leave it). */
    public PenzTransactionEntity recurringTransaction(UUID owner, UUID accountId, UUID ruleId, String kind,
                                                      LocalDate date) {
        PenzTransactionEntity e = new PenzTransactionEntity();
        e.setCreatedBy(owner);
        e.setAccountId(accountId);
        e.setKind(kind);
        e.setAmountMinor(1L);
        e.setCurrency("HUF");
        e.setAmountHufMinor(1L);
        e.setDate(date);
        e.setSource("recurring");
        e.setRecurringRuleId(ruleId);
        return transactionRepository.saveAndFlush(e);
    }

    public PenzMonthCloseEntity monthClose(UUID owner, String month, long finalRemainingMinor, String action) {
        PenzMonthCloseEntity e = new PenzMonthCloseEntity();
        e.setCreatedBy(owner);
        e.setMonth(month);
        e.setFinalRemainingMinor(finalRemainingMinor);
        e.setDeficitMinor(Math.max(0, -finalRemainingMinor));
        e.setLeftoverAction(action);
        e.setClosedAt(Instant.now());
        return monthCloseRepository.saveAndFlush(e);
    }

    /** A cached global rate {@code base→HUF} asked for {@code rateDate} (published that same day). */
    public PenzFxRateEntity fxRate(String base, LocalDate rateDate, String rate) {
        PenzFxRateEntity e = new PenzFxRateEntity();
        e.setBase(base);
        e.setQuote("HUF");
        e.setRateDate(rateDate);
        e.setPublishedDate(rateDate);
        e.setRate(new BigDecimal(rate));
        return fxRateRepository.saveAndFlush(e);
    }

    /** A savings goal ({@code goal}) or purchase plan ({@code purchase}) in HUF minor units (L5, mezo-r36n9.103). */
    public PenzSavingsGoalEntity savingsGoal(UUID owner, String name, String kind, long targetMinor, long savedMinor,
                                             int position) {
        PenzSavingsGoalEntity e = new PenzSavingsGoalEntity();
        e.setCreatedBy(owner);
        e.setName(name);
        e.setKind(kind);
        e.setTargetMinor(targetMinor);
        e.setSavedMinor(savedMinor);
        e.setPosition(position);
        return savingsGoalRepository.saveAndFlush(e);
    }
}
