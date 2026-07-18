package io.mrkuhne.mezo.feature.pantry.controller;

import io.mrkuhne.mezo.api.controller.PantryScrapeApi;
import io.mrkuhne.mezo.api.dto.PantryScrapeRequest;
import io.mrkuhne.mezo.api.dto.PantryScrapeResponse;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.RestController;

/** URL-scrape draft endpoint (mezo-8vum). Switch off -> the whole path 404s. */
@RestController
@ConditionalOnProperty(name = FeaturesConfiguration.PANTRY_SCRAPE_SWITCH, havingValue = "true")
public class PantryScrapeController implements PantryScrapeApi {

    @Override
    public PantryScrapeResponse scrapePantryItem(PantryScrapeRequest req) {
        // Task 6 replaces this with the injected PantryScrapeService call.
        throw new SystemRuntimeErrorException(
            SystemMessage.error("PANTRY_SCRAPE_LLM_UNAVAILABLE").build(), HttpStatus.SERVICE_UNAVAILABLE);
    }
}
