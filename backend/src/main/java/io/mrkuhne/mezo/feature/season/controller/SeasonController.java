package io.mrkuhne.mezo.feature.season.controller;

import io.mrkuhne.mezo.api.controller.SeasonApi;
import io.mrkuhne.mezo.api.dto.SeasonApply;
import io.mrkuhne.mezo.api.dto.SeasonDraft;
import io.mrkuhne.mezo.api.dto.SeasonOverview;
import io.mrkuhne.mezo.api.dto.SeasonPreview;
import io.mrkuhne.mezo.api.dto.SeasonResponse;
import io.mrkuhne.mezo.api.dto.SeasonRules;
import io.mrkuhne.mezo.feature.season.service.SeasonApiService;
import io.mrkuhne.mezo.techcore.security.CurrentUserId;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.RestController;

/** Boop B6 Évad (mezo-r36n9.16) — thin delegation; ownership from the principal. */
@RestController
@RequiredArgsConstructor
public class SeasonController implements SeasonApi {

    private final SeasonApiService service;
    private final CurrentUserId currentUserId;

    @Override
    public List<SeasonResponse> listSeasons() {
        return service.list(currentUserId.get());
    }

    @Override
    public SeasonDraft getFirstSeasonDraft() {
        return service.firstDraft(currentUserId.get());
    }

    @Override
    public SeasonPreview previewSeasonDraft(SeasonDraft seasonDraft) {
        return service.previewDraft(currentUserId.get(), seasonDraft);
    }

    @Override
    public SeasonResponse createSeason(SeasonDraft seasonDraft) {
        return service.create(currentUserId.get(), seasonDraft);
    }

    @Override
    public SeasonResponse activateSeason(UUID id) {
        return service.activate(currentUserId.get(), id);
    }

    @Override
    public SeasonResponse closeSeason(UUID id) {
        return service.close(currentUserId.get(), id);
    }

    @Override
    public SeasonPreview previewSeason(UUID id, SeasonDraft seasonDraft) {
        return service.preview(currentUserId.get(), id, seasonDraft);
    }

    @Override
    public SeasonResponse applySeason(UUID id, SeasonApply seasonApply) {
        return service.apply(currentUserId.get(), id, seasonApply);
    }

    @Override
    public SeasonOverview getSeasonOverview() {
        return service.overview(currentUserId.get());
    }

    @Override
    public SeasonResponse putSeasonRules(UUID id, SeasonRules seasonRules) {
        return service.putRules(currentUserId.get(), id, seasonRules);
    }
}
