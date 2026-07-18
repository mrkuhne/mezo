package io.mrkuhne.mezo.feature.pantry.service;

import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.math.BigDecimal;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import tools.jackson.databind.ObjectMapper;

/**
 * One cheap-tier {@link ScrapeLlm} call turning stripped product-page text into a nutrition draft
 * (mezo-8vum). The LLM never invents numbers (nulls allowed everywhere except name+kcal) and never
 * derives source/confidence — those are deterministic ({@link PantryScrapeService} +
 * {@link ScrapeDraftValidator}).
 *
 * <p>{@link ScrapeLlm} is the pantry-owned port; the companion feature provides the adapter, so
 * pantry never imports {@code feature.companion} (the ArchUnit slice-cycle check stays closed). The
 * port is reached through {@link ObjectProvider} because the scrape switch is independent of the
 * companion switch: with the companion off there is no adapter bean, so an import degrades to a
 * clean 503 ({@link #requireAvailable()}) rather than a 500. Callers ask {@link #requireAvailable()}
 * BEFORE any outbound page fetch so the no-LLM path never touches the network.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.PANTRY_SCRAPE_SWITCH, havingValue = "true")
public class ScrapeExtractionService {

    /** The LLM's JSON contract. kcal==null (or blank name) -> "page carries no facts" upstream. */
    public record ExtractedDraft(
        String name, String brand, BigDecimal per, String unit, BigDecimal kcal,
        BigDecimal proteinG, BigDecimal carbsG, BigDecimal fatG, BigDecimal fiberG,
        BigDecimal sugarG, BigDecimal saltG, BigDecimal saturatedFatG,
        Integer nova, String category, Integer priceHuf, String priceUnit) {
    }

    static final String SYSTEM_PROMPT = """
        You extract packaged-food data from Hungarian or English webshop product pages.
        Answer with ONE JSON object and nothing else, using exactly these keys:
        {"name":string, "brand":string|null, "per":number, "unit":"g"|"ml", "kcal":number|null,
         "proteinG":number|null, "carbsG":number|null, "fatG":number|null, "fiberG":number|null,
         "sugarG":number|null, "saltG":number|null, "saturatedFatG":number|null,
         "nova":1|2|3|4|null, "category":string|null, "priceHuf":integer|null, "priceUnit":string|null}
        Rules:
        - All nutrition values are per the "per"+"unit" basis; prefer the per-100g/100ml column.
        - NEVER invent a number. A value not present on the page is null.
        - If the page shows no nutrition facts at all, set kcal to null.
        - nova is YOUR classification estimate of the NOVA processing group (1-4).
        - category must be one of: vegetables, fruits, meat, fish, eggs, dairy, cheese, legumes,
          grains, pasta, bakery, nuts_seeds, oils_fats, condiments, snacks, beverages, supplement, other.
        - priceHuf is the product price in HUF if shown; priceUnit like "/kg" or "/db" if shown.
        """;

    private final ObjectProvider<ScrapeLlm> llm;
    private final ObjectMapper objectMapper;

    /**
     * Returns the LLM port, or fails with a clean 503 when the companion switch is off (no adapter
     * bean). Called first in {@link PantryScrapeService#scrape(String)} so the no-LLM path never
     * fetches.
     */
    public ScrapeLlm requireAvailable() {
        ScrapeLlm port = llm.getIfAvailable();
        if (port == null) {
            throw new SystemRuntimeErrorException(
                SystemMessage.error("PANTRY_SCRAPE_LLM_UNAVAILABLE").build(), HttpStatus.SERVICE_UNAVAILABLE);
        }
        return port;
    }

    public ExtractedDraft extract(String pageText) {
        String answer = requireAvailable().complete(SYSTEM_PROMPT, pageText);
        try {
            String json = answer.substring(answer.indexOf('{'), answer.lastIndexOf('}') + 1);
            return objectMapper.readValue(json, ExtractedDraft.class);
        } catch (Exception e) {
            log.warn("Scrape extraction unparseable: {}", answer, e);
            throw new SystemRuntimeErrorException(
                SystemMessage.error("PANTRY_SCRAPE_EXTRACT_FAILED").build(), HttpStatus.BAD_GATEWAY);
        }
    }
}
