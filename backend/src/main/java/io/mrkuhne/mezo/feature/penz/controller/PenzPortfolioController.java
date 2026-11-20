package io.mrkuhne.mezo.feature.penz.controller;

import io.mrkuhne.mezo.api.controller.PenzPortfolioApi;
import io.mrkuhne.mezo.api.dto.PenzHoldingEventRequest;
import io.mrkuhne.mezo.api.dto.PenzHoldingEventResponse;
import io.mrkuhne.mezo.api.dto.PenzHoldingRequest;
import io.mrkuhne.mezo.api.dto.PenzHoldingResponse;
import io.mrkuhne.mezo.api.dto.PenzInvestTxnRequest;
import io.mrkuhne.mezo.api.dto.PenzInvestTxnResponse;
import io.mrkuhne.mezo.api.dto.PenzPortfolioResponse;
import io.mrkuhne.mezo.feature.penz.service.PenzHoldingEventService;
import io.mrkuhne.mezo.feature.penz.service.PenzHoldingService;
import io.mrkuhne.mezo.feature.penz.service.PenzInvestTxnService;
import io.mrkuhne.mezo.feature.penz.service.PenzPortfolioService;
import io.mrkuhne.mezo.techcore.security.CurrentUserId;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.RestController;

/** The Pénz portfolio (Boop Pénz L6, mezo-r36n9.104, tag PenzPortfolio) — thin delegation, owner from the principal. */
@RestController
@RequiredArgsConstructor
public class PenzPortfolioController implements PenzPortfolioApi {

    private final PenzHoldingService holdings;
    private final PenzInvestTxnService transactions;
    private final PenzHoldingEventService events;
    private final PenzPortfolioService portfolio;
    private final CurrentUserId currentUserId;

    @Override
    public List<PenzHoldingResponse> listPenzHoldings() {
        return holdings.list(currentUserId.get());
    }

    @Override
    public PenzHoldingResponse createPenzHolding(PenzHoldingRequest request) {
        return holdings.create(currentUserId.get(), request);
    }

    @Override
    public PenzHoldingResponse updatePenzHolding(UUID id, PenzHoldingRequest request) {
        return holdings.update(currentUserId.get(), id, request);
    }

    @Override
    public void deletePenzHolding(UUID id) {
        holdings.delete(currentUserId.get(), id);
    }

    @Override
    public List<PenzInvestTxnResponse> listPenzInvestTransactions(UUID id) {
        return transactions.list(currentUserId.get(), id);
    }

    @Override
    public PenzInvestTxnResponse createPenzInvestTransaction(PenzInvestTxnRequest request) {
        return transactions.create(currentUserId.get(), request);
    }

    @Override
    public void deletePenzInvestTransaction(UUID id) {
        transactions.delete(currentUserId.get(), id);
    }

    @Override
    public List<PenzHoldingEventResponse> listPenzHoldingEvents(LocalDate from) {
        return events.list(currentUserId.get(), from);
    }

    @Override
    public PenzHoldingEventResponse createPenzHoldingEvent(PenzHoldingEventRequest request) {
        return events.create(currentUserId.get(), request);
    }

    @Override
    public void deletePenzHoldingEvent(UUID id) {
        events.delete(currentUserId.get(), id);
    }

    @Override
    public PenzPortfolioResponse getPenzPortfolio(LocalDate date) {
        return portfolio.portfolio(currentUserId.get(), date);
    }
}
