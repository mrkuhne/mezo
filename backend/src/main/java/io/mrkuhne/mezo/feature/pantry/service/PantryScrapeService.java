package io.mrkuhne.mezo.feature.pantry.service;

import io.mrkuhne.mezo.api.dto.PantryScrapeResponse;
import io.mrkuhne.mezo.api.dto.PantryScrapeResult;
import io.mrkuhne.mezo.api.dto.PantrySource;
import io.mrkuhne.mezo.feature.pantry.config.PantryScrapeProperties;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import java.math.BigDecimal;
import java.net.URI;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;

/**
 * URL-scrape orchestration (mezo-8vum): fetch -> strip -> LLM extract -> validate.
 * Stateless — nothing persists until the user confirms via POST /api/pantry-import.
 * {@code source} is derived HERE from the URL domain (never trusted from any model output), and
 * {@code confidence} comes from the deterministic {@link ScrapeDraftValidator} (never the LLM).
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.PANTRY_SCRAPE_SWITCH, havingValue = "true")
public class PantryScrapeService {

    /** Known shop domains -> pantry source values; anything else is the generic 'web'. */
    static final Map<String, String> DOMAIN_SOURCES = Map.of(
        "myprotein.hu", "myprotein.hu", "www.myprotein.hu", "myprotein.hu",
        "gymbeam.hu", "gymbeam.hu", "www.gymbeam.hu", "gymbeam.hu",
        "kifli.hu", "kifli.hu", "www.kifli.hu", "kifli.hu",
        "tesco.hu", "tesco.hu", "auchan.hu", "auchan.hu");

    static final int MAX_PROMPT_CHARS = 24_000;

    private final WebPageClient pageClient;
    private final HtmlNutritionStripper stripper;
    private final ScrapeExtractionService extraction;
    private final ScrapeDraftValidator validator;
    private final PantryScrapeProperties props;

    public PantryScrapeResponse scrape(String url) {
        // Ask for the LLM port BEFORE the outbound fetch — companion-off degrades to a clean 503
        // without ever touching the network (PantryScrapeLlmUnavailableApiIT would otherwise fetch).
        extraction.requireAvailable();
        String html = pageClient.fetch(url);
        String text = stripper.strip(html, MAX_PROMPT_CHARS);
        ScrapeExtractionService.ExtractedDraft d = extraction.extract(text);
        if (d.kcal() == null || d.name() == null || d.name().isBlank()) {
            return new PantryScrapeResponse(); // honest empty: page carries no nutrition facts
        }
        double confidence = validator.confidence(d);
        PantryScrapeResult result = new PantryScrapeResult();
        result.setName(d.name().strip());
        result.setBrand(d.brand());
        result.setPer(d.per() == null ? BigDecimal.valueOf(100) : d.per());
        result.setUnit(d.unit() == null ? "g" : d.unit());
        result.setKcal(d.kcal());
        result.setProteinG(d.proteinG());
        result.setCarbsG(d.carbsG());
        result.setFatG(d.fatG());
        result.setFiberG(d.fiberG());
        result.setSugarG(d.sugarG());
        result.setSaltG(d.saltG());
        result.setSaturatedFatG(d.saturatedFatG());
        result.setNova(d.nova());
        result.setCategory(mapCategory(d.category()));
        result.setPriceHuf(d.priceHuf());
        result.setPriceUnit(d.priceUnit());
        result.setSource(PantrySource.fromValue(sourceFor(url)));
        result.setSourceUrl(url);
        result.setConfidence(BigDecimal.valueOf(confidence));
        // Boundary-inclusive: a draft AT or below the threshold lands as needs-review. The gross
        // Atwater-off fixture scores exactly the threshold (1.0 - 0.4 == 0.6 in IEEE754), and a
        // >30%-off draft must be reviewed — see the report's confidence-boundary note.
        result.setNeedsReview(confidence <= props.confidenceThreshold());
        PantryScrapeResponse resp = new PantryScrapeResponse();
        resp.setResult(result);
        return resp;
    }

    static String sourceFor(String url) {
        String host = URI.create(url.strip()).getHost();
        return host == null ? "web" : DOMAIN_SOURCES.getOrDefault(host.toLowerCase(), "web");
    }

    /** Unknown/typo category from the model degrades to null, never a 500 (mezo-w3o spirit). */
    private PantryScrapeResult.CategoryEnum mapCategory(String category) {
        return category == null ? null : PantryScrapeResult.CategoryEnum.fromValue(category);
    }
}
