package io.mrkuhne.mezo.feature.recipe.service;

import io.mrkuhne.mezo.api.dto.RecipeImportDraft;
import io.mrkuhne.mezo.api.dto.RecipeImportLine;
import io.mrkuhne.mezo.api.dto.WorkshopDraft;
import io.mrkuhne.mezo.feature.pantry.entity.PantryCatalogEntity;
import io.mrkuhne.mezo.feature.pantry.repository.PantryCatalogRepository;
import io.mrkuhne.mezo.feature.pantry.repository.PantryItemRepository;
import io.mrkuhne.mezo.feature.pantry.service.PantryMatcher;
import io.mrkuhne.mezo.feature.pantry.service.PantryNameIndex;
import io.mrkuhne.mezo.feature.recipe.config.RecipeCookedProperties;
import io.mrkuhne.mezo.feature.recipe.config.RecipeImportProperties;
import io.mrkuhne.mezo.feature.recipe.config.RecipeWorkshopProperties;
import io.mrkuhne.mezo.feature.recipe.service.RecipeCookedExtraction.Extracted;
import io.mrkuhne.mezo.feature.recipe.service.RecipeCookedSelection.Open;
import io.mrkuhne.mezo.feature.recipe.service.RecipeCookedSelection.Pick;
import io.mrkuhne.mezo.feature.recipe.service.RecipeJsonLdParser.ParsedIngredient;
import io.mrkuhne.mezo.feature.recipe.service.RecipeWorkshopValidator.RawDraft;
import io.mrkuhne.mezo.feature.recipe.service.RecipeWorkshopValidator.RawLine;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import io.mrkuhne.mezo.techcore.message.UserMessages;
import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

/**
 * „Ezt főztem" (Boop Étel, mezo-r36n9.63): the owner says, types or photographs what he cooked from;
 * the answer is a review draft in the recipe-import shape with every ingredient matched against his
 * pantry. Stateless: nothing is saved, the shelf is not touched (a food reaches it at recipe save, or
 * by the owner's own „+ Kamrába" tap), and the photos are only ever shown to the AI.
 *
 * <p>The LLM proposes, deterministic code decides:
 * <ol>
 *   <li>one vision call TRANSCRIBES the capture into lines ({@link RecipeCookedExtraction});</li>
 *   <li>each line is parsed by the recipe import's own ingredient parser;</li>
 *   <li>exact, normalised full-name match ({@link PantryNameIndex}) over the verified foods plus the
 *       owner's own drafts -> {@code matched};</li>
 *   <li>every other line gets a lexical shortlist ({@link PantryMatcher});</li>
 *   <li>one text call picks among exactly those ids ({@link RecipeCookedSelection}) — an accepted
 *       pick is ALWAYS {@code confirm}, never bound without the owner's tap; no pick -> {@code missing};</li>
 *   <li>the amount is converted into the matched food's basis unit ({@link RecipeDraftLines}).</li>
 * </ol>
 * If the pick call fails, the draft is still returned with those lines {@code missing} (degrade, do
 * not fail): the owner can still link them by hand.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.RECIPE_COOKED_SWITCH, havingValue = "true")
public class RecipeCookedService {

    /** How many shortlist rows a `missing` line offers under „Másik" when the AI named no runner-up. */
    private static final int FALLBACK_ALTERNATIVES = 3;

    private final RecipeCookedExtraction extraction;
    private final RecipeCookedSelection selection;
    private final RecipeWorkshopValidator validator;
    private final RecipeWorkshopProperties workshopProps;
    private final RecipeImportProperties importProps;
    private final RecipeCookedProperties props;
    private final PantryCatalogRepository pantryCatalogRepository;
    private final PantryItemRepository pantryItemRepository;
    private final UserMessages messages;

    /** The draft, or {@code null} when no ingredient could be read from the capture (honest empty). */
    public RecipeImportDraft fromCapture(UUID userId, String text, List<MultipartFile> photos) {
        String note = text == null ? "" : text.strip();
        List<MultipartFile> files = photos == null ? List.of() : photos;
        if (note.isEmpty() && files.isEmpty()) {
            throw invalid("text"); // at least one of the two
        }
        if (note.length() > props.maxTextChars()) {
            throw invalid("text");
        }
        List<RecipeCookedLlm.Image> images = toImages(files);
        RecipeCookedLlm port = extraction.requireAvailable();

        Extracted read = extraction.extract(note, images);
        List<ParsedIngredient> ingredients = new ArrayList<>();
        for (RecipeCookedExtraction.Line line : read.lines()) {
            ParsedIngredient p = RecipeJsonLdParser.parseIngredient(line.ingredient());
            if (p.name().isEmpty() || ingredients.size() >= workshopProps.maxLines()) {
                continue;
            }
            // The row shows what the owner SAID, not the rewritten "amount unit name" form.
            String said = line.sourceText() == null || line.sourceText().isBlank()
                ? p.sourceText() : line.sourceText().strip();
            ingredients.add(new ParsedIngredient(p.name(), p.amount(), p.unit(), p.amountStated(), said));
        }
        if (ingredients.isEmpty()) {
            return null;
        }

        List<PantryCatalogEntity> pool = pantryCatalogRepository.findLiveFoodsVisibleTo(userId);
        Map<UUID, PantryCatalogEntity> byId = pool.stream()
            .collect(Collectors.toMap(PantryCatalogEntity::getId, Function.identity()));
        Set<UUID> shelfIds = pantryItemRepository.findByCreatedByAndDeletedFalseOrderByNameAsc(userId).stream()
            .map(item -> item.getCatalog().getId()).collect(Collectors.toSet());
        PantryNameIndex index = PantryNameIndex.of(pool);
        PantryMatcher matcher = PantryMatcher.of(pool, shelfIds);

        Map<Integer, PantryCatalogEntity> exact = new HashMap<>();
        List<Open> open = new ArrayList<>();
        for (int i = 0; i < ingredients.size(); i++) {
            String said = ingredients.get(i).name();
            Optional<PantryCatalogEntity> hit = index.matchByName(said);
            if (hit.isPresent()) {
                exact.put(i, hit.get());
            } else {
                open.add(new Open(i, said, matcher.shortlist(said, props.shortlistSize())));
            }
        }
        Map<Integer, Pick> picks = pick(port, open);

        List<RawLine> raw = ingredients.stream()
            .map(i -> new RawLine(null, i.name(), i.amount(), i.unit(), null, null, null, null))
            .toList();
        String name = read.name() == null || read.name().isBlank()
            ? messages.text("RECIPE_COOKED_DEFAULT_NAME") : read.name().strip();
        // No pantry matching inside the validator (nothing may be written): every line comes back as a
        // kept, macro-less estimate row and is overlaid with its match below.
        WorkshopDraft shared = validator.sanitize(new RawDraft(name, null, read.servings(), read.steps(), raw),
            id -> Optional.empty(), (n, u) -> Optional.empty(), true);

        Map<Integer, Open> openByIndex = open.stream().collect(Collectors.toMap(Open::index, Function.identity()));
        List<RecipeImportLine> lines = new ArrayList<>();
        boolean anyReview = false;
        for (int i = 0; i < shared.getLines().size(); i++) {
            ParsedIngredient src = ingredients.get(i);
            RecipeImportLine line;
            if (exact.containsKey(i)) {
                PantryCatalogEntity food = exact.get(i);
                line = RecipeDraftLines.line(shared.getLines().get(i), src, food, true,
                    shelfIds.contains(food.getId()), List.of(), importProps.confidenceThreshold());
            } else {
                Pick pick = picks.getOrDefault(i, Pick.none());
                PantryCatalogEntity food = pick.chosen() == null ? null : byId.get(pick.chosen());
                List<PantryCatalogEntity> alternatives = pick.runnersUp().stream().map(byId::get).toList();
                if (food == null && alternatives.isEmpty()) {
                    // The AI named nothing (or was not reachable): „Másik" still offers the lexical best.
                    alternatives = openByIndex.get(i).shortlist().stream()
                        .limit(FALLBACK_ALTERNATIVES).map(PantryMatcher.Candidate::food).toList();
                }
                line = RecipeDraftLines.line(shared.getLines().get(i), src, food, false,
                    food != null && shelfIds.contains(food.getId()), alternatives, importProps.confidenceThreshold());
            }
            anyReview |= line.getMatch().getNeedsReview();
            lines.add(line);
        }

        RecipeImportDraft draft = new RecipeImportDraft();
        draft.setName(shared.getName());
        draft.setCategory(shared.getCategory());
        draft.setServings(shared.getServings());
        draft.setSteps(shared.getSteps());
        draft.setLines(lines);
        draft.setSourceUrl(null);
        draft.setCookedWeightG(null);
        draft.setStructured(false);
        draft.setNeedsReview(anyReview);
        return draft;
    }

    /** One pick call for the lines that have candidates; a failure degrades to "none" for all of them. */
    private Map<Integer, Pick> pick(RecipeCookedLlm port, List<Open> open) {
        List<Open> withCandidates = open.stream().filter(o -> !o.shortlist().isEmpty()).toList();
        if (withCandidates.isEmpty()) {
            return Map.of();
        }
        try {
            return selection.select(port, withCandidates);
        } catch (RuntimeException e) {
            log.warn("'Ezt főztem' pick call failed — the open lines stay unmatched", e);
            return Map.of();
        }
    }

    /** Count, type, per-photo and total size checks (message-bearing 400s). The photos only go to the AI. */
    private List<RecipeCookedLlm.Image> toImages(List<MultipartFile> files) {
        if (files.size() > props.maxPhotos()) {
            throw invalid("photos");
        }
        long total = 0;
        List<RecipeCookedLlm.Image> images = new ArrayList<>();
        for (MultipartFile f : files) {
            if (f == null || f.isEmpty() || f.getSize() > importProps.maxPhotoBytes()
                    || f.getContentType() == null || !importProps.allowedMimeTypes().contains(f.getContentType())) {
                throw invalid("photos");
            }
            total += f.getSize();
            if (total > props.maxTotalBytes()) {
                throw invalid("photos");
            }
            try {
                images.add(new RecipeCookedLlm.Image(f.getBytes(), f.getContentType()));
            } catch (IOException e) {
                throw invalid("photos");
            }
        }
        return images;
    }

    private static SystemRuntimeErrorException invalid(String field) {
        return new SystemRuntimeErrorException(
            SystemMessage.field("VALIDATION_INVALID_VALUE", field).build(), HttpStatus.BAD_REQUEST);
    }
}
