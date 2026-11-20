package io.mrkuhne.mezo.feature.penz.mapper;

import io.mrkuhne.mezo.api.dto.PenzAccountResponse;
import io.mrkuhne.mezo.api.dto.PenzAllowanceLine;
import io.mrkuhne.mezo.api.dto.PenzAllowanceMonth;
import io.mrkuhne.mezo.api.dto.PenzAllowanceResponse;
import io.mrkuhne.mezo.api.dto.PenzAllowanceWeek;
import io.mrkuhne.mezo.api.dto.PenzCategoryResponse;
import io.mrkuhne.mezo.api.dto.PenzMoney;
import io.mrkuhne.mezo.api.dto.PenzMonthCloseResponse;
import io.mrkuhne.mezo.api.dto.PenzRecurringRuleResponse;
import io.mrkuhne.mezo.api.dto.PenzSavingsGoalResponse;
import io.mrkuhne.mezo.api.dto.PenzSmsKeyResponse;
import io.mrkuhne.mezo.api.dto.PenzTransactionResponse;
import io.mrkuhne.mezo.feature.penz.entity.PenzAccountEntity;
import io.mrkuhne.mezo.feature.penz.entity.PenzApiKeyEntity;
import io.mrkuhne.mezo.feature.penz.entity.PenzCategoryEntity;
import io.mrkuhne.mezo.feature.penz.entity.PenzMonthCloseEntity;
import io.mrkuhne.mezo.feature.penz.entity.PenzRecurringRuleEntity;
import io.mrkuhne.mezo.feature.penz.entity.PenzSavingsGoalEntity;
import io.mrkuhne.mezo.feature.penz.entity.PenzTransactionEntity;
import io.mrkuhne.mezo.feature.penz.service.engine.AllowanceLine;
import io.mrkuhne.mezo.feature.penz.service.engine.CloseOutcome;
import io.mrkuhne.mezo.feature.penz.service.engine.MonthlyAllowance;
import io.mrkuhne.mezo.feature.penz.service.engine.WeeklyAllowance;
import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.YearMonth;
import java.time.ZoneOffset;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

/**
 * Pénz rows ↔ the API shapes. Amounts leave as {@link PenzMoney} (minor units in their own currency + the
 * STORED HUF twin); response enums are built from their wire value ({@code fromValue}), never the enum name.
 */
@Mapper(componentModel = "spring")
public interface PenzMapper {

    String HUF = "HUF";

    @Mapping(target = "type", expression = "java(PenzAccountResponse.TypeEnum.fromValue(e.getType()))")
    @Mapping(target = "isDefault", source = "defaultAccount")
    @Mapping(target = "isSavingsTarget", source = "savingsTarget")
    PenzAccountResponse toResponse(PenzAccountEntity e);

    @Mapping(target = "kind", expression = "java(PenzCategoryResponse.KindEnum.fromValue(e.getKind()))")
    @Mapping(target = "monthlyBudgetHufMinor", source = "monthlyBudgetMinor")
    PenzCategoryResponse toResponse(PenzCategoryEntity e);

    @Mapping(target = "kind", expression = "java(PenzTransactionResponse.KindEnum.fromValue(e.getKind()))")
    @Mapping(target = "source", expression = "java(PenzTransactionResponse.SourceEnum.fromValue(e.getSource()))")
    @Mapping(target = "amount", expression = "java(money(e.getAmountMinor(), e.getCurrency(), e.getAmountHufMinor()))")
    PenzTransactionResponse toResponse(PenzTransactionEntity e);

    @Mapping(target = "kind", expression = "java(PenzRecurringRuleResponse.KindEnum.fromValue(e.getKind()))")
    @Mapping(target = "frequency",
        expression = "java(PenzRecurringRuleResponse.FrequencyEnum.fromValue(e.getFrequency()))")
    @Mapping(target = "amount", expression = "java(money(e.getAmountMinor(), e.getCurrency(), e.getAmountHufMinor()))")
    PenzRecurringRuleResponse toResponse(PenzRecurringRuleEntity e);

    @Mapping(target = "closed", constant = "true")
    @Mapping(target = "finalRemaining", expression = "java(huf(e.getFinalRemainingMinor()))")
    @Mapping(target = "deficit", expression = "java(huf(e.getDeficitMinor()))")
    @Mapping(target = "leftoverAction",
        expression = "java(PenzMonthCloseResponse.LeftoverActionEnum.fromValue(e.getLeftoverAction()))")
    PenzMonthCloseResponse toResponse(PenzMonthCloseEntity e);

    @Mapping(target = "kind", expression = "java(PenzSavingsGoalResponse.KindEnum.fromValue(e.getKind()))")
    @Mapping(target = "target", expression = "java(huf(e.getTargetMinor()))")
    @Mapping(target = "saved", expression = "java(huf(e.getSavedMinor()))")
    PenzSavingsGoalResponse toResponse(PenzSavingsGoalEntity e);

    /** An SMS API key as listed: never the key itself, nor its hash. */
    PenzSmsKeyResponse toResponse(PenzApiKeyEntity e);

    /**
     * A month with transactions and no close yet, with the figures a close would store now: the engine's
     * remaining (previous deficit only from a CLOSED previous month) and the deficit it would carry over.
     */
    default PenzMonthCloseResponse openMonth(YearMonth month, CloseOutcome outcome, long remainingHufMinor) {
        return new PenzMonthCloseResponse().month(month.toString()).closed(false)
            .finalRemaining(huf(remainingHufMinor)).deficit(huf(outcome.deficitMinor()));
    }

    /** The allowance of {@code date}: month figures, week figures (+ the per-day figure) and the 10 lines. */
    default PenzAllowanceResponse allowance(LocalDate date, MonthlyAllowance m, WeeklyAllowance w, long perDayHufMinor) {
        return new PenzAllowanceResponse()
            .date(date)
            .month(new PenzAllowanceMonth().month(m.month().toString()).free(huf(m.freeMinor()))
                .spent(huf(m.spentMinor())).remaining(huf(m.remainingMinor())))
            .week(new PenzAllowanceWeek().start(w.weekStart()).end(w.weekEnd()).budget(huf(w.budgetMinor()))
                .spent(huf(w.spentMinor())).remaining(huf(w.remainingMinor())).perDay(huf(perDayHufMinor)))
            .lines(m.lines().stream().map(this::line).toList());
    }

    default PenzAllowanceLine line(AllowanceLine l) {
        return new PenzAllowanceLine().key(PenzAllowanceLine.KeyEnum.fromValue(l.key().wireKey()))
            .amount(huf(l.amountMinor()));
    }

    default PenzMoney money(long minor, String currency, long hufMinor) {
        return new PenzMoney().minor(minor).currency(currency).hufMinor(hufMinor);
    }

    default PenzMoney huf(long hufMinor) {
        return money(hufMinor, HUF, hufMinor);
    }

    default OffsetDateTime map(Instant instant) {
        return instant == null ? null : instant.atOffset(ZoneOffset.UTC);
    }
}
