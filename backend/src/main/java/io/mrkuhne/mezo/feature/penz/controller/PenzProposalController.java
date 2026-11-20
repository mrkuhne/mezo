package io.mrkuhne.mezo.feature.penz.controller;

import io.mrkuhne.mezo.api.controller.PenzCatalogApi;
import io.mrkuhne.mezo.api.controller.PenzProposalApi;
import io.mrkuhne.mezo.api.dto.PenzProduct;
import io.mrkuhne.mezo.api.dto.PenzProductRequest;
import io.mrkuhne.mezo.api.dto.PenzProposal;
import io.mrkuhne.mezo.api.dto.PenzProposalAcceptRequest;
import io.mrkuhne.mezo.api.dto.PenzProposalRequest;
import io.mrkuhne.mezo.api.dto.PenzProposalStepRequest;
import io.mrkuhne.mezo.api.dto.PenzStrategy;
import io.mrkuhne.mezo.feature.penz.service.PenzCatalogService;
import io.mrkuhne.mezo.feature.penz.service.PenzProposalService;
import io.mrkuhne.mezo.feature.penz.service.PenzStrategyService;
import io.mrkuhne.mezo.techcore.security.CurrentUserId;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.RestController;

/**
 * The Pénz catalog, proposals and monthly strategy (Boop Pénz L7, mezo-r36n9.105, tags PenzCatalog + PenzProposal)
 * — thin delegation, owner from the principal.
 */
@RestController
@RequiredArgsConstructor
public class PenzProposalController implements PenzProposalApi, PenzCatalogApi {

    private final PenzCatalogService catalog;
    private final PenzProposalService proposals;
    private final PenzStrategyService strategy;
    private final CurrentUserId currentUserId;

    @Override
    public List<PenzProduct> listPenzProducts() {
        return catalog.list(currentUserId.get());
    }

    @Override
    public PenzProduct createPenzProduct(PenzProductRequest request) {
        return catalog.create(currentUserId.get(), request);
    }

    @Override
    public PenzProduct updatePenzProduct(UUID id, PenzProductRequest request) {
        return catalog.update(currentUserId.get(), id, request);
    }

    @Override
    public PenzProduct approvePenzProduct(UUID id) {
        return catalog.approve(currentUserId.get(), id);
    }

    @Override
    public PenzProduct declinePenzProduct(UUID id) {
        return catalog.decline(currentUserId.get(), id);
    }

    @Override
    public PenzStrategy getPenzStrategy(LocalDate date) {
        return strategy.strategy(currentUserId.get(), date);
    }

    @Override
    public PenzProposal createPenzProposal(PenzProposalRequest request) {
        return proposals.create(currentUserId.get(), request);
    }

    @Override
    public List<PenzProposal> listPenzProposals(String status) {
        return proposals.list(currentUserId.get(), status);
    }

    @Override
    public PenzProposal getPenzProposal(UUID id) {
        return proposals.get(currentUserId.get(), id);
    }

    @Override
    public PenzProposal acceptPenzProposal(UUID id, PenzProposalAcceptRequest request) {
        return proposals.accept(currentUserId.get(), id, request);
    }

    @Override
    public PenzProposal dismissPenzProposal(UUID id) {
        return proposals.dismiss(currentUserId.get(), id);
    }

    @Override
    public PenzProposal setPenzProposalStep(UUID id, Integer index, PenzProposalStepRequest request) {
        return proposals.step(currentUserId.get(), id, index, Boolean.TRUE.equals(request.getDone()));
    }
}
