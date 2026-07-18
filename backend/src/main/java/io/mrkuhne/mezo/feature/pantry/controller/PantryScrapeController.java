package io.mrkuhne.mezo.feature.pantry.controller;

import io.mrkuhne.mezo.api.controller.PantryScrapeApi;
import io.mrkuhne.mezo.api.dto.PantryScrapeRequest;
import io.mrkuhne.mezo.api.dto.PantryScrapeResponse;
import io.mrkuhne.mezo.feature.pantry.service.PantryScrapeService;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.web.bind.annotation.RestController;

/** URL-scrape draft endpoint (mezo-8vum). Switch off -> the whole path 404s. */
@RestController
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.PANTRY_SCRAPE_SWITCH, havingValue = "true")
public class PantryScrapeController implements PantryScrapeApi {

    private final PantryScrapeService scrapeService;

    @Override
    public PantryScrapeResponse scrapePantryItem(PantryScrapeRequest req) {
        return scrapeService.scrape(req.getUrl());
    }
}
