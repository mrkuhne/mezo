package io.mrkuhne.mezo.feature.recipe.service;

import io.mrkuhne.mezo.api.dto.RecipeImportAlternative;
import io.mrkuhne.mezo.api.dto.RecipeImportLine;
import io.mrkuhne.mezo.api.dto.RecipeImportMatch;
import io.mrkuhne.mezo.api.dto.WorkshopDraftLine;
import io.mrkuhne.mezo.feature.pantry.entity.PantryCatalogEntity;
import io.mrkuhne.mezo.feature.pantry.service.PantryUnits;
import io.mrkuhne.mezo.feature.recipe.service.RecipeJsonLdParser.ParsedIngredient;
import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * The ONE place a review row is built (mezo-r36n9.63), shared by the recipe import and „Ezt főztem" so
 * every entrance shows the same three faces and the same amount rule:
 *
 * <ul>
 *   <li>no food -> {@code missing} (confidence 0), the line keeps the amount and unit as said;</li>
 *   <li>a food -> the line's unit IS the food's basis unit and the amount is converted into it
 *       ({@link PantryUnits}); an exact name match is {@code matched} (confidence 1) unless the amount
 *       is doubtful, an AI pick is ALWAYS {@code confirm} (confidence 0.5).</li>
 * </ul>
 *
 * A row is never saved from here: the match carries the catalog id only, and nothing reaches the shelf
 * before the recipe save. Pure — no Spring, no repository.
 */
final class RecipeDraftLines {

    /** Confidence of an exact name match whose amount converted cleanly. */
    static final double MATCHED = 1.0;
    /** The AI's pick, or an exact match whose amount is doubtful: the owner confirms. */
    static final double CONFIRM = 0.5;

    private RecipeDraftLines() {
    }

    /**
     * @param base        the sanitised draft line (amount/unit as parsed, macros null)
     * @param src         the parsed source line (what was said, whether an amount was stated)
     * @param food        the matched catalog food, or null
     * @param exact       true for a deterministic full-name match; false for an AI pick
     * @param onShelf     whether {@code food} is already on the owner's shelf
     * @param alternatives other foods the row could be (≤ 3 are sent)
     * @param threshold   at/below this confidence the row needs review
     */
    static RecipeImportLine line(WorkshopDraftLine base, ParsedIngredient src, PantryCatalogEntity food,
            boolean exact, boolean onShelf, List<PantryCatalogEntity> alternatives, double threshold) {
        RecipeImportMatch match = new RecipeImportMatch();
        RecipeImportLine out = new RecipeImportLine();
        double confidence;
        if (food == null) {
            confidence = 0.0;
            match.setState(RecipeImportMatch.StateEnum.MISSING);
            match.setOnShelf(false);
            match.setAmountDoubt(false);
            match.setBasisUnit(null);
            out.setSource("estimate");
            out.setName(base.getName());
            out.setAmount(base.getAmount());
            out.setUnit(base.getUnit());
        } else {
            PantryUnits.Resolved resolved = PantryUnits.toBasis(
                src.amountStated() ? src.amount() : null, src.unit(), food.getServingUnit());
            boolean clean = exact && !resolved.doubt();
            confidence = clean ? MATCHED : CONFIRM;
            match.setState(clean ? RecipeImportMatch.StateEnum.MATCHED : RecipeImportMatch.StateEnum.CONFIRM);
            match.setOnShelf(onShelf);
            match.setAmountDoubt(resolved.doubt());
            match.setBasisUnit(resolved.unit());
            out.setSource("pantry");
            out.setName(food.getName()); // the DB name, never the model's
            out.setAmount(resolved.amount());
            out.setUnit(resolved.unit());
            // What the matched food says about allergens, so the review can warn BEFORE the save.
            Map<String, String> states = new LinkedHashMap<>();
            food.getAllergens().forEach((key, state) -> states.put(key, state.wire()));
            out.setAllergens(states);
        }
        match.setCatalogId(food == null ? null : food.getId());
        match.setConfidence(BigDecimal.valueOf(confidence));
        // Boundary-inclusive like the scrape: at or below the threshold the row is flagged.
        match.setNeedsReview(confidence <= threshold);
        match.setAlternatives(alternatives.stream().limit(3).map(RecipeDraftLines::alternative).toList());
        out.setPantryItemId(null); // a preview never creates the shelf row; see match.catalogId
        out.setKcal(base.getKcal());
        out.setProteinG(base.getProteinG());
        out.setCarbsG(base.getCarbsG());
        out.setFatG(base.getFatG());
        out.setMatch(match);
        out.setSourceText(src.sourceText());
        return out;
    }

    private static RecipeImportAlternative alternative(PantryCatalogEntity food) {
        RecipeImportAlternative a = new RecipeImportAlternative();
        a.setCatalogId(food.getId());
        a.setName(food.getName());
        a.setBrand(food.getBrand());
        a.setBasisUnit(food.getServingUnit() == null || food.getServingUnit().isBlank() ? "g" : food.getServingUnit().strip());
        return a;
    }
}
