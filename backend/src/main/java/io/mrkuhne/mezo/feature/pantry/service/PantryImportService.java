package io.mrkuhne.mezo.feature.pantry.service;

import io.mrkuhne.mezo.api.dto.PantryImportRequest;
import io.mrkuhne.mezo.api.dto.PantryItemResponse;
import io.mrkuhne.mezo.api.dto.PantryLookupResponse;
import io.mrkuhne.mezo.api.dto.PantryLookupResult;
import io.mrkuhne.mezo.feature.pantry.config.PantryScrapeProperties;
import io.mrkuhne.mezo.feature.pantry.entity.PantryImportEntity;
import io.mrkuhne.mezo.feature.pantry.entity.PantryItemEntity;
import io.mrkuhne.mezo.feature.pantry.mapper.PantryMapper;
import io.mrkuhne.mezo.feature.pantry.repository.PantryImportRepository;
import io.mrkuhne.mezo.feature.pantry.repository.PantryItemRepository;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * OpenFoodFacts lookup + confirmed-draft import (Fuel P6, mezo-bka). Only exists when
 * {@code mezo.feature.pantry-import.enabled} is on (follows its OffClient dependency).
 */
@Service
@ConditionalOnBean(OffClient.class)
@RequiredArgsConstructor
public class PantryImportService {

    /** OFF nutriments are per-100 basis (g or ml); the draft pins per=100. */
    private static final BigDecimal PER_BASIS = BigDecimal.valueOf(100);
    private static final String SOURCE_OPENFOODFACTS = "openfoodfacts";
    private static final String SOURCE_PHOTO = "photo";

    private final OffClient offClient;
    private final PantryItemRepository itemRepository;
    private final PantryImportRepository importRepository;
    private final PantryMapper mapper;
    /**
     * Always present — {@code PantryScrapeProperties} is registered unconditionally by
     * {@code @ConfigurationPropertiesScan}, so {@code getIfAvailable()} never returns null here.
     * Kept as an ObjectProvider purely as belt-and-suspenders (manual-review still hinges on the
     * request carrying a confidence, not on the bean's presence).
     */
    private final ObjectProvider<PantryScrapeProperties> scrapeProps;

    /**
     * All-digit queries of at least 8 chars are barcodes (EAN-8/UPC/EAN-13), everything else is a
     * text search. Results without a usable name or kcal are dropped — they cannot become a
     * valid food draft (kcal is required by the manual create path too).
     */
    public PantryLookupResponse lookup(String query) {
        String q = query.strip();
        List<OffClient.OffProduct> products = q.matches("\\d{8,}") ? offClient.byBarcode(q) : offClient.search(q);
        return PantryLookupResponse.builder()
            .results(products.stream()
                .filter(p -> p.productName() != null && !p.productName().isBlank())
                .filter(p -> p.nutriments() != null && p.nutriments().kcal100g() != null)
                .map(this::toResult)
                .toList())
            .build();
    }

    /** Persists a confirmed draft: the pantry_item (kind food, source openfoodfacts) + the feed row. */
    @Transactional
    public PantryItemResponse importItem(UUID userId, PantryImportRequest req) {
        if (req.getKcal() == null) {
            throw new SystemRuntimeErrorException(
                SystemMessage.field("VALIDATION_INVALID_VALUE", "kcal").build(), HttpStatus.BAD_REQUEST);
        }
        // Three-armed source derivation: a scraped draft carries its origin URL -> derive from the
        // URL host (never the client); a photo draft carries the origin marker (mezo-d8tr) -> the
        // 'photo' provenance; a plain OFF confirm has neither and stays 'openfoodfacts'.
        String source = req.getSourceUrl() != null
            ? PantryScrapeService.sourceFor(req.getSourceUrl())
            : "photo".equals(req.getOrigin()) ? SOURCE_PHOTO : SOURCE_OPENFOODFACTS;

        PantryItemEntity item = new PantryItemEntity();
        item.setCreatedBy(userId); // server-side ownership — never from the client
        item.setKind("food");
        item.setSource(source);
        item.setName(req.getName());
        item.setBrand(req.getBrand());
        item.setCategory(req.getCategory() == null ? null : req.getCategory().getValue());
        item.setServingAmount(req.getPer());
        item.setServingUnit(req.getUnit());
        item.setKcal(req.getKcal());
        item.setProteinG(req.getProteinG());
        item.setCarbsG(req.getCarbsG());
        item.setFatG(req.getFatG());
        item.setFiberG(req.getFiberG());
        item.setSugarG(req.getSugarG());
        item.setSaltG(req.getSaltG());
        item.setSaturatedFatG(req.getSaturatedFatG());
        item.setPriceHuf(req.getPriceHuf());
        item.setPriceUnit(req.getPriceUnit());
        item.setNova(req.getNova() == null ? null : req.getNova().shortValue());
        item = itemRepository.save(item);

        PantryImportEntity feed = new PantryImportEntity();
        feed.setCreatedBy(userId);
        feed.setSource(source);
        feed.setItemName(item.getName());
        feed.setItemCount(1);
        feed.setStatus(isManualReview(req.getConfidence()) ? "manual-review" : "synced");
        feed.setBarcode(req.getBarcode());
        feed.setSourceUrl(req.getSourceUrl());
        feed.setPantryItemId(item.getId());
        feed.setImportedAt(Instant.now());
        importRepository.save(feed);

        return mapper.toItemResponse(item);
    }

    /**
     * A confirmed scraped draft whose deterministic confidence is at or below the scrape threshold
     * lands as {@code manual-review} (a >30%-off Atwater draft scores exactly the threshold).
     * OFF/manual imports send no confidence (and none exist while the scrape switch is off), so a
     * null confidence always stays {@code synced}.
     */
    private boolean isManualReview(BigDecimal confidence) {
        if (confidence == null) {
            return false;
        }
        PantryScrapeProperties props = scrapeProps.getIfAvailable();
        return props != null && confidence.doubleValue() <= props.confidenceThreshold();
    }

    private PantryLookupResult toResult(OffClient.OffProduct p) {
        OffClient.OffNutriments n = p.nutriments();
        return PantryLookupResult.builder()
            .name(p.productName().strip())
            .brand(firstBrand(p.brands()))
            .barcode(p.code())
            .per(PER_BASIS)
            .unit("g")
            .kcal(n.kcal100g())
            .proteinG(n.proteins100g())
            .carbsG(n.carbohydrates100g())
            .fatG(n.fat100g())
            .fiberG(n.fiber100g())
            .sugarG(n.sugars100g())
            .saltG(n.salt100g())
            .saturatedFatG(n.saturatedFat100g())
            .nova(p.novaGroup())
            .build();
    }

    /** OFF `brands` is a comma-separated list; the first entry is the display brand. */
    private String firstBrand(String brands) {
        if (brands == null || brands.isBlank()) return null;
        return brands.split(",")[0].strip();
    }
}
