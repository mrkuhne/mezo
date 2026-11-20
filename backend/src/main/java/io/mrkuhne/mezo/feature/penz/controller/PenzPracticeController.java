package io.mrkuhne.mezo.feature.penz.controller;

import io.mrkuhne.mezo.api.controller.PenzPracticeApi;
import io.mrkuhne.mezo.api.dto.PenzPaperTrade;
import io.mrkuhne.mezo.api.dto.PenzPaperTradeCloseRequest;
import io.mrkuhne.mezo.api.dto.PenzPaperTradeLastCloseRequest;
import io.mrkuhne.mezo.api.dto.PenzPaperTradeOpenRequest;
import io.mrkuhne.mezo.api.dto.PenzPaperTradeRequest;
import io.mrkuhne.mezo.api.dto.PenzPracticeOverview;
import io.mrkuhne.mezo.feature.penz.service.PenzPracticeService;
import io.mrkuhne.mezo.techcore.security.CurrentUserId;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.RestController;

/** Gyakorlás (Boop Pénz L7, mezo-r36n9.105, tag PenzPractice) — thin delegation, owner from the principal. */
@RestController
@RequiredArgsConstructor
public class PenzPracticeController implements PenzPracticeApi {

    private final PenzPracticeService practice;
    private final CurrentUserId currentUserId;

    @Override
    public PenzPracticeOverview getPenzPractice(LocalDate date) {
        return practice.overview(currentUserId.get(), date);
    }

    @Override
    public List<PenzPaperTrade> listPenzPaperTrades(LocalDate from, LocalDate to) {
        return practice.list(currentUserId.get(), from, to);
    }

    @Override
    public PenzPaperTrade createPenzPaperTrade(PenzPaperTradeRequest request) {
        return practice.create(currentUserId.get(), request);
    }

    @Override
    public PenzPaperTrade updatePenzPaperTrade(UUID id, PenzPaperTradeRequest request) {
        return practice.update(currentUserId.get(), id, request);
    }

    @Override
    public void deletePenzPaperTrade(UUID id) {
        practice.delete(currentUserId.get(), id);
    }

    @Override
    public PenzPaperTrade openPenzPaperTrade(UUID id, PenzPaperTradeOpenRequest request) {
        return practice.open(currentUserId.get(), id, request);
    }

    @Override
    public PenzPaperTrade closePenzPaperTrade(UUID id, PenzPaperTradeCloseRequest request) {
        return practice.close(currentUserId.get(), id, request);
    }

    @Override
    public PenzPaperTrade setPenzPaperTradeLastClose(UUID id, PenzPaperTradeLastCloseRequest request) {
        return practice.lastClose(currentUserId.get(), id, request);
    }

    @Override
    public PenzPaperTrade cancelPenzPaperTrade(UUID id) {
        return practice.cancel(currentUserId.get(), id);
    }
}
