package io.mrkuhne.mezo.feature.pantry.controller;

import io.mrkuhne.mezo.api.controller.PantryScrapeApi;
import io.mrkuhne.mezo.api.dto.PantryScrapeRequest;
import io.mrkuhne.mezo.api.dto.PantryScrapeResponse;
import io.mrkuhne.mezo.feature.auth.service.CurrentUser;
import io.mrkuhne.mezo.feature.pantry.service.PantryScrapeService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.web.bind.annotation.RestController;

/**
 * URL-scrape draft endpoint (mezo-8vum). Switch off -> the whole path 404s.
 *
 * <p>mezo-qw37.1 review Finding 3: this is one of only two authenticated controllers that never
 * touched {@link CurrentUser}/{@code CurrentUserId} — a DISABLED account's still-valid 30-day JWT
 * could keep hitting this endpoint and burning Gemini quota after revocation. {@link
 * CurrentUser#get()} runs the per-request status check; nothing about the loaded entity is
 * otherwise needed here.
 */
@RestController
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.PANTRY_SCRAPE_SWITCH, havingValue = "true")
public class PantryScrapeController implements PantryScrapeApi {

    private final PantryScrapeService scrapeService;
    private final CurrentUser currentUser;

    @Override
    public PantryScrapeResponse scrapePantryItem(PantryScrapeRequest req) {
        currentUser.get(); // auth gate only (DISABLED check) — nothing persisted or read per-user
        return scrapeService.scrape(req.getUrl());
    }
}
