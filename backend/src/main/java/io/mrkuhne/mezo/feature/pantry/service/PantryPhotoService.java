package io.mrkuhne.mezo.feature.pantry.service;

import io.mrkuhne.mezo.api.dto.PantryScrapeResponse;
import io.mrkuhne.mezo.api.dto.PantryScrapeResult;
import io.mrkuhne.mezo.api.dto.PantrySource;
import io.mrkuhne.mezo.feature.pantry.config.PantryPhotoProperties;
import io.mrkuhne.mezo.feature.pantry.service.ScrapeExtractionService.ExtractedDraft;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import tools.jackson.databind.ObjectMapper;

/**
 * Label-photo extraction (mezo-d8tr): validate upload → ONE multimodal LLM call → parse →
 * deterministic confidence. Stateless — the photos are ephemeral (multipart → memory → LLM →
 * dropped) and nothing persists until the user confirms via POST /api/pantry-import.
 *
 * <p>Reuses the scrape slice's {@link ExtractedDraft} TYPE and {@link ScrapeDraftValidator}, but
 * NOT the scrape beans — they vanish when the independent scrape switch is off. The draft basis is
 * hard-set to per-100 g / grams here (mezo-y9ga made structural), regardless of the model answer:
 * the prompt demands that basis and the numbers are validated by Atwater, so overriding per/unit
 * never silently rescales — it only pins the declared basis.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.PANTRY_PHOTO_SWITCH, havingValue = "true")
public class PantryPhotoService {

    static final String SYSTEM_PROMPT = """
        You extract packaged-food data from photos of a product's nutrition label
        (and optionally the front of the package). Labels may be Hungarian or English.
        Answer with ONE JSON object and nothing else, using exactly these keys:
        {"name":string|null, "brand":string|null, "per":100, "unit":"g", "kcal":number|null,
         "proteinG":number|null, "carbsG":number|null, "fatG":number|null, "fiberG":number|null,
         "sugarG":number|null, "saltG":number|null, "saturatedFatG":number|null,
         "nova":1|2|3|4|null, "category":string|null, "priceHuf":null, "priceUnit":null}
        Rules:
        - ALL nutrition values MUST be on the per-100 g (or per-100 ml) basis. If the label only
          shows a per-serving column, convert to per-100 using the stated serving size.
        - NEVER invent a number. A value not legible on the photos is null.
        - If no nutrition table is legible at all, set kcal to null.
        - name: the product name; prefer the front-of-pack photo when present; null if not visible.
        - nova is YOUR classification estimate of the NOVA processing group (1-4).
        - category must be one of: vegetables, fruits, meat, fish, eggs, dairy, cheese, legumes,
          grains, pasta, bakery, nuts_seeds, oils_fats, condiments, snacks, beverages, supplement, other.
        - priceHuf and priceUnit are always null (labels carry no price).
        """;

    private final ObjectProvider<PhotoExtractLlm> llm;
    private final ScrapeDraftValidator validator;
    private final PantryPhotoProperties props;
    private final ObjectMapper objectMapper;

    public PantryScrapeResponse extract(MultipartFile photo, MultipartFile photo2) {
        PhotoExtractLlm port = requireAvailable();
        List<PhotoExtractLlm.Image> images = new ArrayList<>();
        images.add(toImage(photo)); // contract-required part
        if (photo2 != null && !photo2.isEmpty()) {
            images.add(toImage(photo2));
        }
        String answer = port.complete(SYSTEM_PROMPT, "", images);
        ExtractedDraft d = parse(answer);
        if (d.kcal() == null || d.name() == null || d.name().isBlank()) {
            return new PantryScrapeResponse(); // honest empty: no legible nutrition facts
        }
        double confidence = validator.confidence(d);
        PantryScrapeResult result = new PantryScrapeResult();
        result.setName(d.name().strip());
        result.setBrand(d.brand());
        result.setPer(BigDecimal.valueOf(100)); // mezo-y9ga: basis is ALWAYS per-100 g
        result.setUnit("g");
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
        result.setPriceHuf(null); // labels carry no price
        result.setPriceUnit(null);
        result.setSource(PantrySource.PHOTO);
        result.setSourceUrl(null);
        result.setConfidence(BigDecimal.valueOf(confidence));
        // Boundary-inclusive like the scrape (PantryScrapeService.java:72-75).
        result.setNeedsReview(confidence <= props.confidenceThreshold());
        PantryScrapeResponse resp = new PantryScrapeResponse();
        resp.setResult(result);
        return resp;
    }

    private PhotoExtractLlm requireAvailable() {
        PhotoExtractLlm port = llm.getIfAvailable();
        if (port == null) {
            throw new SystemRuntimeErrorException(
                SystemMessage.error("PANTRY_PHOTO_LLM_UNAVAILABLE").build(), HttpStatus.SERVICE_UNAVAILABLE);
        }
        return port;
    }

    /** Size/mime service-level checks (message-bearing 400s; the container caps are the safety net). */
    private PhotoExtractLlm.Image toImage(MultipartFile f) {
        if (f == null || f.isEmpty()) {
            throw new SystemRuntimeErrorException(
                SystemMessage.field("VALIDATION_INVALID_VALUE", "photo").build(), HttpStatus.BAD_REQUEST);
        }
        if (f.getSize() > props.maxPhotoBytes()) {
            throw new SystemRuntimeErrorException(
                SystemMessage.field("VALIDATION_INVALID_VALUE", "photo").build(), HttpStatus.BAD_REQUEST);
        }
        String mime = f.getContentType();
        if (mime == null || !props.allowedMimeTypes().contains(mime)) {
            throw new SystemRuntimeErrorException(
                SystemMessage.field("VALIDATION_INVALID_VALUE", "photo").build(), HttpStatus.BAD_REQUEST);
        }
        try {
            return new PhotoExtractLlm.Image(f.getBytes(), mime);
        } catch (Exception e) {
            throw new SystemRuntimeErrorException(
                SystemMessage.field("VALIDATION_INVALID_VALUE", "photo").build(), HttpStatus.BAD_REQUEST);
        }
    }

    /** Same brace-window parse as the scrape, with photo-owned error semantics (502). */
    private ExtractedDraft parse(String answer) {
        try {
            String json = answer.substring(answer.indexOf('{'), answer.lastIndexOf('}') + 1);
            return objectMapper.readValue(json, ExtractedDraft.class);
        } catch (Exception e) {
            log.warn("Photo extraction unparseable: {}", answer, e);
            throw new SystemRuntimeErrorException(
                SystemMessage.error("PANTRY_PHOTO_EXTRACT_FAILED").build(), HttpStatus.BAD_GATEWAY);
        }
    }

    /** Unknown/typo category from the model degrades to null, never a 500 (mezo-w3o spirit). */
    private PantryScrapeResult.CategoryEnum mapCategory(String category) {
        return category == null ? null : PantryScrapeResult.CategoryEnum.fromValue(category);
    }
}
