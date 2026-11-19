package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.penz.entity.PenzAccountEntity;
import io.mrkuhne.mezo.feature.penz.entity.PenzCategoryEntity;
import io.mrkuhne.mezo.feature.penz.entity.PenzFxRateEntity;
import io.mrkuhne.mezo.feature.penz.entity.PenzMonthCloseEntity;
import io.mrkuhne.mezo.feature.penz.entity.PenzSettingsEntity;
import io.mrkuhne.mezo.feature.penz.entity.PenzTransactionEntity;
import io.mrkuhne.mezo.feature.penz.repository.PenzAccountRepository;
import io.mrkuhne.mezo.feature.penz.repository.PenzCategoryRepository;
import io.mrkuhne.mezo.feature.penz.repository.PenzFxRateRepository;
import io.mrkuhne.mezo.feature.penz.repository.PenzMonthCloseRepository;
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
    private final PenzFxRateRepository fxRateRepository;

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
}
