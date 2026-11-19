package io.mrkuhne.mezo.feature.recipe.service;

import io.mrkuhne.mezo.api.dto.RecipeImportDraft;
import io.mrkuhne.mezo.api.dto.RecipeImportLine;
import io.mrkuhne.mezo.api.dto.WorkshopDraft;
import io.mrkuhne.mezo.api.dto.WorkshopDraftLine;
import io.mrkuhne.mezo.feature.pantry.entity.PantryCatalogEntity;
import io.mrkuhne.mezo.feature.pantry.repository.PantryCatalogRepository;
import io.mrkuhne.mezo.feature.pantry.repository.PantryItemRepository;
import io.mrkuhne.mezo.feature.pantry.service.HtmlNutritionStripper;
import io.mrkuhne.mezo.feature.pantry.service.PantryNameIndex;
import io.mrkuhne.mezo.feature.pantry.service.WebPageClient;
import io.mrkuhne.mezo.feature.recipe.config.RecipeImportProperties;
import io.mrkuhne.mezo.feature.recipe.config.RecipeWorkshopProperties;
import io.mrkuhne.mezo.feature.recipe.service.RecipeJsonLdParser.ParsedIngredient;
import io.mrkuhne.mezo.feature.recipe.service.RecipeJsonLdParser.ParsedRecipe;
import io.mrkuhne.mezo.feature.recipe.service.RecipeWorkshopValidator.RawDraft;
import io.mrkuhne.mezo.feature.recipe.service.RecipeWorkshopValidator.RawLine;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.io.IOException;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.jsoup.Jsoup;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

/**
 * Recipe import (Boop B4, owner decisions 13 and 16): a web page, a photo or pasted text becomes a
 * DRAFT in the Receptműhely draft shape — stateless, nothing is saved here. Every route ends in the
 * review screen, so each ingredient row carries what it matched; a row that matched nothing, or only
 * weakly, is flagged and never dropped (a silent wrong match is the failure mode this exists to avoid).
 *
 * <p>Order of preference for a URL: the page's own schema.org recipe (no AI), then an AI read of the
 * stripped page text. The fetch is {@link WebPageClient}'s SSRF-guarded one, untouched. Matching to the
 * pantry, units, confidence and {@code needsReview} are all deterministic; the model's answer is only
 * ever data and can never supply a pantry id.
 */
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.RECIPE_IMPORT_SWITCH, havingValue = "true")
public class RecipeImportService {

    private final PantryItemRepository pantryItemRepository;
    private final ObjectProvider<WebPageClient> pageClient;
    private final HtmlNutritionStripper stripper;
    private final RecipeJsonLdParser jsonLdParser;
    private final RecipeExtractionService extraction;
    private final RecipeWorkshopValidator validator;
    private final RecipeWorkshopProperties workshopProps;
    private final RecipeImportProperties props;
    private final PantryCatalogRepository pantryCatalogRepository;

    /** The draft, or {@code null} when the page carries no readable recipe (honest empty). */
    public RecipeImportDraft fromUrl(UUID userId, String url) {
        WebPageClient client = pageClient.getIfAvailable();
        if (client == null) {
            throw new SystemRuntimeErrorException(
                SystemMessage.error("RECIPE_IMPORT_FETCH_UNAVAILABLE").build(), HttpStatus.SERVICE_UNAVAILABLE);
        }
        String sourceUrl = url.strip();
        String html = client.fetch(sourceUrl);
        Optional<ParsedRecipe> structured = jsonLdParser.parse(html);
        if (structured.isPresent()) {
            return toDraft(userId, structured.get(), null, sourceUrl, true);
        }
        extraction.requireAvailable(); // the page has no recipe of its own: only the AI can read it
        String text = pageTitle(html) + stripper.strip(html, props.maxPromptChars());
        return fromExtracted(userId, extraction.extractFromText(text), sourceUrl);
    }

    public RecipeImportDraft fromText(UUID userId, String text) {
        extraction.requireAvailable();
        String bounded = text.length() <= props.maxPromptChars() ? text : text.substring(0, props.maxPromptChars());
        return fromExtracted(userId, extraction.extractFromText(bounded), null);
    }

    public RecipeImportDraft fromPhoto(UUID userId, MultipartFile photo) {
        extraction.requireAvailable();
        return fromExtracted(userId, extraction.extractFromPhoto(toImage(photo)), null);
    }

    private RecipeImportDraft fromExtracted(UUID userId, RecipeExtractionService.Extracted e, String sourceUrl) {
        if (e.name() == null || e.name().isBlank() || e.ingredients() == null) {
            return null;
        }
        List<ParsedIngredient> ingredients = new ArrayList<>();
        for (String line : e.ingredients()) {
            ParsedIngredient p = RecipeJsonLdParser.parseIngredient(line);
            if (!p.name().isEmpty() && ingredients.size() < RecipeJsonLdParser.MAX_INGREDIENTS) {
                ingredients.add(p);
            }
        }
        if (ingredients.isEmpty()) {
            return null; // a name with no ingredients is not a recipe we can offer
        }
        List<String> steps = e.steps() == null ? List.of() : e.steps();
        Integer servings = e.servings() == null ? null : (int) Math.round(Math.max(0, Math.min(1000, e.servings())));
        ParsedRecipe parsed = new ParsedRecipe(e.name().strip(), servings, e.category(), ingredients, steps);
        return toDraft(userId, parsed, positive(e.cookedWeightG()), sourceUrl, false);
    }

    /**
     * Matches the lines to the catalog BY NAME and wraps the shared workshop draft with the review facts.
     * Read-only: nothing reaches the owner's shelf at preview — the match carries the catalog id and the
     * recipe save puts the food on the shelf (RecipeService), where the owner has committed.
     */
    private RecipeImportDraft toDraft(UUID userId, ParsedRecipe parsed, BigDecimal cookedWeightG, String sourceUrl,
            boolean structured) {
        List<ParsedIngredient> ingredients = parsed.ingredients().size() <= workshopProps.maxLines()
            ? parsed.ingredients() : parsed.ingredients().subList(0, workshopProps.maxLines());
        List<RawLine> raw = ingredients.stream()
            .map(i -> new RawLine(null, i.name(), i.amount(), i.unit(), null, null, null, null))
            .toList();
        RawDraft rawDraft = new RawDraft(parsed.name(), parsed.category(), parsed.servings(),
            parsed.steps(), raw);
        PantryNameIndex index = PantryNameIndex.of(
            pantryCatalogRepository.findByDeletedFalseAndStatusOrderByNameAsc(PantryCatalogEntity.STATUS_VERIFIED));

        // No pantry matching inside the validator (nothing may be written): every line comes back as a
        // kept, macro-less estimate row and is overlaid with its name match below.
        WorkshopDraft shared = validator.sanitize(rawDraft, id -> Optional.empty(), (n, u) -> Optional.empty(), true);

        Set<UUID> shelfIds = pantryItemRepository.findByCreatedByAndDeletedFalseOrderByNameAsc(userId).stream()
            .map(item -> item.getCatalog().getId()).collect(Collectors.toSet());
        List<RecipeImportLine> lines = new ArrayList<>();
        boolean anyReview = false;
        for (int i = 0; i < shared.getLines().size(); i++) {
            RecipeImportLine line = withMatch(shared.getLines().get(i), ingredients.get(i), index, shelfIds);
            anyReview |= line.getMatch().getNeedsReview();
            lines.add(line);
        }
        RecipeImportDraft draft = new RecipeImportDraft();
        draft.setName(shared.getName());
        draft.setCategory(shared.getCategory());
        draft.setServings(shared.getServings());
        draft.setSteps(shared.getSteps());
        draft.setLines(lines);
        draft.setSourceUrl(sourceUrl);
        draft.setCookedWeightG(cookedWeightG);
        draft.setStructured(structured);
        draft.setNeedsReview(anyReview);
        return draft;
    }

    /**
     * Name match (normalised full-name equality) fills in the food; the unit decides the confidence:
     * the amount decides the confidence. Since mezo-r36n9.63 the row is built by {@link RecipeDraftLines}
     * — the builder „Ezt főztem" uses too — so once a row has a food its unit IS that food's basis unit
     * and the amount is converted into it; an amount that does not convert cleanly, or was not stated, is
     * flagged ({@code amountDoubt}, confidence 0.5, state {@code confirm}) for the owner to check. No
     * match = 0 / {@code missing}, kept as an estimate row with the amount and unit as the source wrote
     * them. This route offers no alternatives.
     */
    private RecipeImportLine withMatch(WorkshopDraftLine l, ParsedIngredient src, PantryNameIndex index,
            Set<UUID> shelfIds) {
        PantryCatalogEntity hit = index.matchByName(src.name()).orElse(null);
        return RecipeDraftLines.line(l, src, hit, true, hit != null && shelfIds.contains(hit.getId()),
            List.of(), props.confidenceThreshold());
    }

    private static String pageTitle(String html) {
        String title = Jsoup.parse(html).title().strip();
        return title.isEmpty() ? "" : "PAGE TITLE: " + title + "\n";
    }

    private static BigDecimal positive(BigDecimal v) {
        return v != null && v.signum() > 0 && v.compareTo(new BigDecimal("100000")) <= 0 ? v : null;
    }

    /** Size and type checks (message-bearing 400s). The photo is only ever shown to the AI. */
    private RecipeImportLlm.Image toImage(MultipartFile f) {
        if (f == null || f.isEmpty() || f.getSize() > props.maxPhotoBytes()
                || f.getContentType() == null || !props.allowedMimeTypes().contains(f.getContentType())) {
            throw invalidPhoto();
        }
        try {
            return new RecipeImportLlm.Image(f.getBytes(), f.getContentType());
        } catch (IOException e) {
            throw invalidPhoto();
        }
    }

    private static SystemRuntimeErrorException invalidPhoto() {
        return new SystemRuntimeErrorException(
            SystemMessage.field("VALIDATION_INVALID_VALUE", "photo").build(), HttpStatus.BAD_REQUEST);
    }
}
