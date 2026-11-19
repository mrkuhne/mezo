package io.mrkuhne.mezo.feature.pantry.service;

import io.mrkuhne.mezo.api.dto.PantryBreakdownResponse;
import io.mrkuhne.mezo.feature.nutrition.entity.MealBreakdownJson;
import io.mrkuhne.mezo.feature.nutrition.mapper.BreakdownDtoMapper;
import io.mrkuhne.mezo.feature.nutrition.service.MealScoringService;
import io.mrkuhne.mezo.feature.nutrition.service.MealScoringService.ScoredLine;
import io.mrkuhne.mezo.feature.pantry.entity.PantryCatalogEntity;
import io.mrkuhne.mezo.feature.pantry.repository.PantryCatalogRepository;
import io.mrkuhne.mezo.feature.pantry.repository.PantryItemRepository;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * A pantry food's OWN score (mezo-r36n9.63, owner request): every food shows the score it earns by
 * itself and the dimensions it is judged on — computed by the same engine that scores meals and
 * recipes ({@link MealScoringService#foodBreakdown}), never by a second formula here. This class only
 * turns a definition into the engine's input line and serves the two reads.
 *
 * <p>Computed on every read from the live definition (pure math, nothing persisted): a facts edit —
 * a „Pontosítom" on an estimated food — is reflected at once. Honest nulls end to end: a fact the
 * definition does not carry reaches the engine as {@code null} (that dimension degrades), and a food
 * with no energy data, or a non-food entry, has no score at all.
 *
 * <p>The engine lives in {@code feature/nutrition}, which pantry already depends on (allergen states);
 * recipe reaches it the same way, so pantry needs neither {@code feature/recipe} nor {@code feature/meal}.
 */
@Service
@RequiredArgsConstructor
public class PantryFoodScoreService {

    private static final BigDecimal HUNDRED = BigDecimal.valueOf(100);

    private final MealScoringService scoring;
    private final PantryItemRepository itemRepository;
    private final PantryCatalogRepository catalogRepository;

    /** The total 0..1 per definition, in order; {@code null} where there is no score. One language lookup. */
    public List<BigDecimal> scores(List<PantryCatalogEntity> definitions) {
        return scoring.foodBreakdowns(definitions.stream().map(PantryFoodScoreService::lineOf).toList())
            .stream().map(b -> b == null ? null : b.value()).toList();
    }

    /** The breakdown of one food on the caller's shelf; a missing or foreign shelf row is the usual 404. */
    @Transactional(readOnly = true)
    public PantryBreakdownResponse forItem(UUID userId, UUID itemId) {
        PantryCatalogEntity food = itemRepository.findByIdAndCreatedByAndDeletedFalse(itemId, userId)
            .orElseThrow(PantryFoodScoreService::notFound).getCatalog();
        return response(food);
    }

    /**
     * The breakdown of one shared definition. Visibility is the shelf's add-from-catalog gate: a live
     * entry that is verified or the caller's own; anything else is indistinguishable from "unknown".
     */
    @Transactional(readOnly = true)
    public PantryBreakdownResponse forCatalog(UUID userId, UUID catalogId) {
        PantryCatalogEntity food = catalogRepository.findById(catalogId)
            .filter(c -> !c.isDeleted())
            .filter(c -> !PantryCatalogEntity.STATUS_DRAFT.equals(c.getStatus()) || userId.equals(c.getCreatedBy()))
            .orElseThrow(PantryFoodScoreService::notFound);
        return response(food);
    }

    private PantryBreakdownResponse response(PantryCatalogEntity food) {
        ScoredLine line = lineOf(food);
        MealBreakdownJson breakdown = line == null ? null : scoring.foodBreakdown(line);
        return PantryBreakdownResponse.builder()
            .breakdown(breakdown == null ? null : BreakdownDtoMapper.toDto(breakdown))
            .build();
    }

    /**
     * The engine's input for ONE food, or {@code null} for a non-food entry (a supplement is not judged
     * as food).
     *
     * <p>A food measured in grams or millilitres is scored per 100 g/ml whatever its own basis amount
     * is — every dimension but energy density is scale-free, and energy density needs a meal-sized mass
     * to mean anything, so a "per 30 g" row is not dropped from it for being light. A food counted in
     * pieces (or with no basis amount) is scored per its own basis and simply has no gram mass, so
     * energy density degrades for it. A missing fact stays {@code null}; nothing is filled in.
     */
    static ScoredLine lineOf(PantryCatalogEntity c) {
        if (!"food".equals(c.getKind())) {
            return null;
        }
        String unit = PantryNameIndex.canonicalUnit(c.getServingUnit());
        BigDecimal per = c.getServingAmount();
        boolean measured = ("g".equals(unit) || "ml".equals(unit)) && per != null && per.signum() > 0;
        BigDecimal basis = measured ? per : null; // null = as stored (per the food's own basis)
        String label = measured ? "100 " + unit
            : (per == null ? "1" : per.stripTrailingZeros().toPlainString())
                + " " + (c.getServingUnit() == null || c.getServingUnit().isBlank() ? "db" : c.getServingUnit().strip());
        return new ScoredLine(c.getName(), label,
            scaled(c.getKcal(), basis), scaled(c.getProteinG(), basis),
            scaled(c.getCarbsG(), basis), scaled(c.getFatG(), basis),
            c.getNova(),
            scaled(c.getFiberG(), basis), scaled(c.getSugarG(), basis),
            scaled(c.getSaltG(), basis), scaled(c.getSaturatedFatG(), basis),
            c.getCategory(),
            measured ? HUNDRED : null);
    }

    /** {@code v} per {@code per} g/ml -> per 100 (multiply first, so 111.6 per 30 g is exactly 372); null stays null. */
    private static BigDecimal scaled(BigDecimal v, BigDecimal per) {
        if (v == null || per == null) {
            return v;
        }
        return v.multiply(HUNDRED).divide(per, 6, RoundingMode.HALF_UP);
    }

    private static SystemRuntimeErrorException notFound() {
        return new SystemRuntimeErrorException(
            SystemMessage.error("RESOURCE_NOT_FOUND").build(), HttpStatus.NOT_FOUND);
    }
}
