package io.mrkuhne.mezo.support.populator;

import io.mrkuhne.mezo.feature.penz.entity.PenzAccountEntity;
import io.mrkuhne.mezo.feature.penz.entity.PenzCategoryEntity;
import io.mrkuhne.mezo.feature.penz.entity.PenzFxRateEntity;
import io.mrkuhne.mezo.feature.penz.entity.PenzHoldingEntity;
import io.mrkuhne.mezo.feature.penz.entity.PenzHoldingEventEntity;
import io.mrkuhne.mezo.feature.penz.entity.PenzInvestTxnEntity;
import io.mrkuhne.mezo.feature.penz.entity.PenzMonthCloseEntity;
import io.mrkuhne.mezo.feature.penz.entity.PenzProductEntity;
import io.mrkuhne.mezo.feature.penz.entity.PenzQuoteEntity;
import io.mrkuhne.mezo.feature.penz.entity.PenzRecurringRuleEntity;
import io.mrkuhne.mezo.feature.penz.entity.PenzSavingsGoalEntity;
import io.mrkuhne.mezo.feature.penz.entity.PenzSettingsEntity;
import io.mrkuhne.mezo.feature.penz.entity.PenzTransactionEntity;
import io.mrkuhne.mezo.feature.penz.repository.PenzAccountRepository;
import io.mrkuhne.mezo.feature.penz.repository.PenzCategoryRepository;
import io.mrkuhne.mezo.feature.penz.repository.PenzFxRateRepository;
import io.mrkuhne.mezo.feature.penz.repository.PenzHoldingEventRepository;
import io.mrkuhne.mezo.feature.penz.repository.PenzHoldingRepository;
import io.mrkuhne.mezo.feature.penz.repository.PenzInvestTxnRepository;
import io.mrkuhne.mezo.feature.penz.repository.PenzMonthCloseRepository;
import io.mrkuhne.mezo.feature.penz.repository.PenzProductRepository;
import io.mrkuhne.mezo.feature.penz.repository.PenzQuoteRepository;
import io.mrkuhne.mezo.feature.penz.repository.PenzRecurringRuleRepository;
import io.mrkuhne.mezo.feature.penz.repository.PenzSavingsGoalRepository;
import io.mrkuhne.mezo.feature.penz.repository.PenzSettingsRepository;
import io.mrkuhne.mezo.feature.penz.repository.PenzTransactionRepository;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
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
    private final PenzHoldingRepository holdingRepository;
    private final PenzInvestTxnRepository investTxnRepository;
    private final PenzHoldingEventRepository holdingEventRepository;
    private final PenzQuoteRepository quoteRepository;
    private final PenzProductRepository productRepository;

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

    /**
     * A catalog product (L7, mezo-r36n9.105) with an invented name and fee, checked "today": {@code status}
     * suggested|approved|declined, {@code sleeves} ⊆ short|mid|long, {@code terPct} null = no running cost known.
     */
    public PenzProductEntity product(UUID owner, String name, String kind, String currency, List<String> sleeves,
                                     String terPct, String distribution, String status) {
        PenzProductEntity e = new PenzProductEntity();
        e.setCreatedBy(owner);
        e.setName(name);
        e.setKind(kind);
        e.setCurrency(currency);
        e.setSleeves(new ArrayList<>(sleeves));
        e.setWhatItIs("Kitalált termék a tesztekhez: " + name);
        e.setTerPct(terPct == null ? null : new BigDecimal(terPct));
        e.setDistribution(distribution);
        e.setSourceName("Teszt forrás");
        e.setSourceUrl("https://pelda.example/termek");
        e.setReviewedAt(LocalDate.now(ZoneId.of("Europe/Budapest")).minusDays(30));
        e.setStatus(status);
        e.setSuggestedBy(PenzProductEntity.BY_RESEARCH);
        if (PenzProductEntity.STATUS_APPROVED.equals(status)) {
            e.setApprovedAt(Instant.now());
        }
        return productRepository.saveAndFlush(e);
    }

    /** A holding (L6, mezo-r36n9.104) on platform {@code other}, position 0, no news terms. */
    public PenzHoldingEntity holding(UUID owner, String name, String assetType, String symbol, String sleeve,
                                     String currency, BigDecimal bondRatePct) {
        PenzHoldingEntity e = new PenzHoldingEntity();
        e.setCreatedBy(owner);
        e.setName(name);
        e.setAssetType(assetType);
        e.setSymbol(symbol);
        e.setPlatform("other");
        e.setSleeve(sleeve);
        e.setCurrency(currency);
        e.setBondRatePct(bondRatePct);
        e.setNewsTerms(new ArrayList<>());
        return holdingRepository.saveAndFlush(e);
    }

    /**
     * A buy or sell with its HUF twin given (no FX lookup). A non-HUF row gets the twin's implied rate and the
     * transaction date as its rate date (the check constraint wants both).
     */
    public PenzInvestTxnEntity investTxn(UUID owner, UUID holdingId, String side, BigDecimal quantity,
                                         long amountMinor, String currency, long amountHufMinor, LocalDate date) {
        PenzInvestTxnEntity e = new PenzInvestTxnEntity();
        e.setCreatedBy(owner);
        e.setHoldingId(holdingId);
        e.setSide(side);
        e.setQuantity(quantity);
        e.setAmountMinor(amountMinor);
        e.setCurrency(currency);
        e.setAmountHufMinor(amountHufMinor);
        if (!"HUF".equals(currency)) {
            e.setFxRate(BigDecimal.valueOf(amountHufMinor).divide(BigDecimal.valueOf(amountMinor), 8,
                java.math.RoundingMode.HALF_UP));
            e.setFxRateDate(date);
        }
        e.setDate(date);
        return investTxnRepository.saveAndFlush(e);
    }

    /** A portfolio event; {@code amountMinor} null = no expected amount. */
    public PenzHoldingEventEntity holdingEvent(UUID owner, UUID holdingId, String kind, LocalDate date,
                                               Long amountMinor, String currency) {
        PenzHoldingEventEntity e = new PenzHoldingEventEntity();
        e.setCreatedBy(owner);
        e.setHoldingId(holdingId);
        e.setKind(kind);
        e.setDate(date);
        e.setAmountMinor(amountMinor);
        e.setCurrency(amountMinor == null ? null : currency);
        return holdingEventRepository.saveAndFlush(e);
    }

    /**
     * A cached global quote (a security or an FX pair like {@code EURHUF=X}) dated {@code asOf}, fetched just now
     * (so a read does not refetch it within the throttle window). Prices are invented.
     */
    public PenzQuoteEntity quote(String symbol, String currency, String price, String previousClose,
                                 LocalDate asOf) {
        PenzQuoteEntity e = new PenzQuoteEntity();
        e.setSymbol(symbol);
        e.setCurrency(currency);
        e.setPrice(new BigDecimal(price));
        e.setPreviousClose(previousClose == null ? null : new BigDecimal(previousClose));
        e.setMarketTime(asOf.atTime(16, 0).atZone(ZoneId.of("Europe/Budapest")).toInstant());
        e.setAsOf(asOf);
        e.setFetchedAt(Instant.now());
        return quoteRepository.saveAndFlush(e);
    }
}
