package io.mrkuhne.mezo.feature.penz.mapper;

import io.mrkuhne.mezo.api.dto.PenzAccountResponse;
import io.mrkuhne.mezo.api.dto.PenzCategoryResponse;
import io.mrkuhne.mezo.api.dto.PenzMoney;
import io.mrkuhne.mezo.api.dto.PenzMonthCloseResponse;
import io.mrkuhne.mezo.api.dto.PenzRecurringRuleResponse;
import io.mrkuhne.mezo.api.dto.PenzTransactionResponse;
import io.mrkuhne.mezo.feature.penz.entity.PenzAccountEntity;
import io.mrkuhne.mezo.feature.penz.entity.PenzCategoryEntity;
import io.mrkuhne.mezo.feature.penz.entity.PenzMonthCloseEntity;
import io.mrkuhne.mezo.feature.penz.entity.PenzRecurringRuleEntity;
import io.mrkuhne.mezo.feature.penz.entity.PenzTransactionEntity;
import java.time.Instant;
import java.time.OffsetDateTime;
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

    /** A month with transactions and no close yet — its figures need the allowance engine (later phase). */
    default PenzMonthCloseResponse openMonth(String month) {
        return new PenzMonthCloseResponse().month(month).closed(false);
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
