package io.mrkuhne.mezo.feature.penz.controller;

import io.mrkuhne.mezo.api.controller.PenzApi;
import io.mrkuhne.mezo.api.dto.PenzAccountRequest;
import io.mrkuhne.mezo.api.dto.PenzAccountResponse;
import io.mrkuhne.mezo.api.dto.PenzAllowanceResponse;
import io.mrkuhne.mezo.api.dto.PenzCategoryRequest;
import io.mrkuhne.mezo.api.dto.PenzCategoryResponse;
import io.mrkuhne.mezo.api.dto.PenzMonthCloseRequest;
import io.mrkuhne.mezo.api.dto.PenzMonthCloseResponse;
import io.mrkuhne.mezo.api.dto.PenzRecurringRuleRequest;
import io.mrkuhne.mezo.api.dto.PenzRecurringRuleResponse;
import io.mrkuhne.mezo.api.dto.PenzSettingsRequest;
import io.mrkuhne.mezo.api.dto.PenzSettingsResponse;
import io.mrkuhne.mezo.api.dto.PenzTransactionRequest;
import io.mrkuhne.mezo.api.dto.PenzTransactionResponse;
import io.mrkuhne.mezo.api.dto.PenzTransferRequest;
import io.mrkuhne.mezo.feature.penz.service.PenzAccountService;
import io.mrkuhne.mezo.feature.penz.service.PenzCategoryService;
import io.mrkuhne.mezo.feature.penz.service.PenzErrors;
import io.mrkuhne.mezo.feature.penz.service.PenzMonthCloseService;
import io.mrkuhne.mezo.feature.penz.service.PenzRecurringRuleService;
import io.mrkuhne.mezo.feature.penz.service.PenzSettingsService;
import io.mrkuhne.mezo.feature.penz.service.PenzTransactionService;
import io.mrkuhne.mezo.techcore.security.CurrentUserId;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.RestController;

/** /api/penz (Boop Pénz L4, mezo-r36n9.102) — thin delegation, ownership from the principal. */
@RestController
@RequiredArgsConstructor
public class PenzController implements PenzApi {

    private final PenzSettingsService settings;
    private final PenzAccountService accounts;
    private final PenzCategoryService categories;
    private final PenzTransactionService transactions;
    private final PenzRecurringRuleService rules;
    private final PenzMonthCloseService monthCloses;
    private final CurrentUserId currentUserId;

    @Override
    public PenzSettingsResponse getPenzSettings() {
        return settings.get(currentUserId.get());
    }

    @Override
    public PenzSettingsResponse putPenzSettings(PenzSettingsRequest request) {
        return settings.put(currentUserId.get(), request);
    }

    @Override
    public List<PenzAccountResponse> listPenzAccounts(Boolean includeArchived) {
        return accounts.list(currentUserId.get(), Boolean.TRUE.equals(includeArchived));
    }

    @Override
    public PenzAccountResponse createPenzAccount(PenzAccountRequest request) {
        return accounts.create(currentUserId.get(), request);
    }

    @Override
    public PenzAccountResponse updatePenzAccount(UUID id, PenzAccountRequest request) {
        return accounts.update(currentUserId.get(), id, request);
    }

    @Override
    public PenzAccountResponse archivePenzAccount(UUID id) {
        return accounts.archive(currentUserId.get(), id);
    }

    @Override
    public List<PenzCategoryResponse> listPenzCategories() {
        return categories.list(currentUserId.get());
    }

    @Override
    public PenzCategoryResponse createPenzCategory(PenzCategoryRequest request) {
        return categories.create(currentUserId.get(), request);
    }

    @Override
    public PenzCategoryResponse updatePenzCategory(UUID id, PenzCategoryRequest request) {
        return categories.update(currentUserId.get(), id, request);
    }

    @Override
    public List<PenzTransactionResponse> listPenzTransactions(String month, Boolean needsReview) {
        return transactions.list(currentUserId.get(), month, needsReview);
    }

    @Override
    public PenzTransactionResponse createPenzTransaction(PenzTransactionRequest request) {
        return transactions.create(currentUserId.get(), request);
    }

    @Override
    public PenzTransactionResponse updatePenzTransaction(UUID id, PenzTransactionRequest request) {
        return transactions.update(currentUserId.get(), id, request);
    }

    @Override
    public void deletePenzTransaction(UUID id) {
        transactions.delete(currentUserId.get(), id);
    }

    @Override
    public PenzTransactionResponse markPenzTransactionReviewed(UUID id) {
        return transactions.markReviewed(currentUserId.get(), id);
    }

    @Override
    public List<PenzTransactionResponse> createPenzTransfer(PenzTransferRequest request) {
        return transactions.transfer(currentUserId.get(), request);
    }

    @Override
    public List<PenzRecurringRuleResponse> listPenzRecurringRules() {
        return rules.list(currentUserId.get());
    }

    @Override
    public PenzRecurringRuleResponse createPenzRecurringRule(PenzRecurringRuleRequest request) {
        return rules.create(currentUserId.get(), request);
    }

    @Override
    public PenzRecurringRuleResponse updatePenzRecurringRule(UUID id, PenzRecurringRuleRequest request) {
        return rules.update(currentUserId.get(), id, request);
    }

    @Override
    public void deletePenzRecurringRule(UUID id) {
        rules.delete(currentUserId.get(), id);
    }

    /** The allowance engine lands in a later phase of L4 — declared in the contract, 501 until then. */
    @Override
    public PenzAllowanceResponse getPenzAllowance(LocalDate date) {
        currentUserId.get();
        throw PenzErrors.notImplemented();
    }

    @Override
    public List<PenzMonthCloseResponse> listPenzMonthCloses() {
        return monthCloses.listClosed(currentUserId.get());
    }

    @Override
    public List<PenzMonthCloseResponse> listOpenPenzMonths() {
        return monthCloses.listOpen(currentUserId.get());
    }

    @Override
    public PenzMonthCloseResponse closePenzMonth(String month, PenzMonthCloseRequest request) {
        return monthCloses.close(currentUserId.get(), month, request.getLeftoverAction());
    }
}
