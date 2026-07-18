package io.mrkuhne.mezo.feature.meal.service;

import io.mrkuhne.mezo.api.dto.MealAiDraftItem;
import io.mrkuhne.mezo.api.dto.MealAiDraftResponse;
import io.mrkuhne.mezo.api.dto.RecipeMacros;
import io.mrkuhne.mezo.feature.meal.config.MealAiLogProperties;
import io.mrkuhne.mezo.feature.pantry.entity.PantryItemEntity;
import io.mrkuhne.mezo.feature.pantry.repository.PantryItemRepository;
import io.mrkuhne.mezo.feature.recipe.entity.RecipeEntity;
import io.mrkuhne.mezo.feature.recipe.mapper.RecipeMapper;
import io.mrkuhne.mezo.feature.recipe.repository.RecipeRepository;
import io.mrkuhne.mezo.techcore.configuration.FeaturesConfiguration;
import io.mrkuhne.mezo.techcore.exception.SystemMessage;
import io.mrkuhne.mezo.techcore.exception.SystemRuntimeErrorException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import tools.jackson.databind.ObjectMapper;

/**
 * Stateless AI meal-draft extraction (mezo-78rn): one cheap-tier LLM call parses the user's
 * free text / photo AND matches against the owner's pantry + recipe catalog. Matched lines get
 * their macros from the DB row (the LLM only picks id + amount); unknown/malformed ids are demoted
 * to estimate lines (never 500, never silent corruption). Nothing is persisted here — the confirmed
 * draft is written later via {@link MealService#create}.
 *
 * <p>{@link MealDraftLlm} is the meal-owned port; the companion feature provides the adapter, so
 * meal never imports {@code feature.companion} (ADR 0012 — the ArchUnit slice-cycle rule stays
 * closed). The port is reached through {@link ObjectProvider} because the meal-ai-log switch is
 * independent of the companion switch: companion off -> no adapter bean -> a clean 503 via
 * {@link #requireAvailable()} rather than a 500. {@code confidence} + {@code needsReview} are
 * deterministic ({@link MealAiDraftValidator}) — never the LLM's self-assessment.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(name = FeaturesConfiguration.MEAL_AI_LOG_SWITCH, havingValue = "true")
public class MealAiDraftService {

    private static final Set<String> SLOTS = Set.of("breakfast", "lunch", "dinner", "snack");

    private final ObjectProvider<MealDraftLlm> llm;
    private final PantryItemRepository pantryItemRepository;
    private final RecipeRepository recipeRepository;
    private final RecipeMapper recipeMapper;
    private final MealAiLogProperties props;
    private final MealAiDraftValidator validator;
    private final ObjectMapper objectMapper;

    /** LLM answer contract — ids as String so a malformed uuid demotes the line, not the call. */
    record ExtractedLine(String pantryItemId, String recipeId, String name, BigDecimal amount,
            String unit, BigDecimal kcal, BigDecimal proteinG, BigDecimal carbsG, BigDecimal fatG) {
    }

    record ExtractedMeal(String slot, String title, String note, List<ExtractedLine> items) {
    }

    /**
     * Returns the LLM port, or fails with a clean 503 when the companion switch is off (no adapter
     * bean). Public so Task 7's controller can gate the request before reading the multipart body.
     */
    public MealDraftLlm requireAvailable() {
        MealDraftLlm port = llm.getIfAvailable();
        if (port == null) {
            throw new SystemRuntimeErrorException(
                    SystemMessage.error("MEAL_AI_LLM_UNAVAILABLE").build(), HttpStatus.SERVICE_UNAVAILABLE);
        }
        return port;
    }

    // Read-only tx spans the whole call: the recipe arm's per-serving rollup walks the LAZY
    // recipe.lines through RecipeMapper (open-in-view is false). Single-user app, so holding one
    // pooled connection across the LLM call is acceptable (cf. MealService's method-level txns).
    @Transactional(readOnly = true)
    public MealAiDraftResponse draft(UUID userId, LocalDate date, String text, MultipartFile photo) {
        MealDraftLlm port = requireAvailable();
        validateInput(text, photo);

        String systemPrompt = buildSystemPrompt(userId);
        String userMessage = text == null ? "" : text;

        String answer;
        if (photo != null && !photo.isEmpty()) {
            answer = port.complete(systemPrompt, userMessage, readBytes(photo), photo.getContentType());
        } else {
            answer = port.complete(systemPrompt, userMessage);
        }

        ExtractedMeal extracted = parse(answer);
        return toResponse(userId, extracted);
    }

    private void validateInput(String text, MultipartFile photo) {
        boolean hasText = text != null && !text.isBlank();
        boolean hasPhoto = photo != null && !photo.isEmpty();
        if (!hasText && !hasPhoto) {
            throw new SystemRuntimeErrorException(
                    SystemMessage.error("MEAL_AI_INPUT_REQUIRED").build(), HttpStatus.BAD_REQUEST);
        }
        if (hasPhoto) {
            if (photo.getSize() > props.maxPhotoBytes()) {
                throw new SystemRuntimeErrorException(
                        SystemMessage.field("VALIDATION_INVALID_VALUE", "photo").build(), HttpStatus.BAD_REQUEST);
            }
            String mime = photo.getContentType();
            if (mime == null || !props.allowedMimeTypes().contains(mime)) {
                throw new SystemRuntimeErrorException(
                        SystemMessage.field("VALIDATION_INVALID_VALUE", "photo").build(), HttpStatus.BAD_REQUEST);
            }
        }
    }

    private byte[] readBytes(MultipartFile photo) {
        try {
            return photo.getBytes();
        } catch (Exception e) {
            throw new SystemRuntimeErrorException(
                    SystemMessage.field("VALIDATION_INVALID_VALUE", "photo").build(), HttpStatus.BAD_REQUEST);
        }
    }

    private String buildSystemPrompt(UUID userId) {
        StringBuilder sb = new StringBuilder("""
            You extract ONE meal log from Hungarian free text and/or a food photo.
            Answer with ONE JSON object and nothing else, exactly these keys:
            {"slot":"breakfast"|"lunch"|"dinner"|"snack","title":string|null,"note":string|null,
             "items":[{"pantryItemId":string|null,"recipeId":string|null,"name":string,
                       "amount":number,"unit":string,
                       "kcal":number,"proteinG":number,"carbsG":number,"fatG":number}]}
            Rules:
            - Match a food against the CATALOG below only when it is clearly the same item; then copy
              the EXACT id into pantryItemId or recipeId. NEVER invent or alter an id.
            - For a pantry match give amount in the row's serving unit; for a recipe match amount = servings.
            - ALWAYS fill name + kcal/proteinG/carbsG/fatG as your estimate for the stated amount,
              matched lines included (they are a fallback only).
            - Unknown / restaurant / street food: both ids null.
            - Nothing edible recognized: "items":[].
            - title: short Hungarian meal title; note: only genuinely useful remarks, else null.

            PANTRY CATALOG (id | name | brand | serving):
            """);
        for (PantryItemEntity p : pantryItemRepository.findByCreatedByAndDeletedFalseOrderByNameAsc(userId)) {
            sb.append(p.getId()).append(" | ").append(p.getName()).append(" | ")
              .append(p.getBrand() == null ? "-" : p.getBrand()).append(" | ")
              .append(p.getServingAmount() == null ? "100" : p.getServingAmount())
              .append(' ').append(p.getServingUnit() == null ? "g" : p.getServingUnit()).append('\n');
        }
        sb.append("\nRECIPES (id | name):\n");
        for (RecipeEntity r : recipeRepository.findByCreatedByAndDeletedFalseOrderByCreatedAtDesc(userId)) {
            sb.append(r.getId()).append(" | ").append(r.getName()).append('\n');
        }
        return sb.toString();
    }

    private ExtractedMeal parse(String answer) {
        try {
            String json = answer.substring(answer.indexOf('{'), answer.lastIndexOf('}') + 1);
            return objectMapper.readValue(json, ExtractedMeal.class);
        } catch (Exception e) {
            log.warn("Meal AI extraction unparseable: {}", answer, e);
            throw new SystemRuntimeErrorException(
                    SystemMessage.error("MEAL_AI_EXTRACT_FAILED").build(), HttpStatus.BAD_GATEWAY);
        }
    }

    private MealAiDraftResponse toResponse(UUID userId, ExtractedMeal extracted) {
        MealAiDraftResponse res = new MealAiDraftResponse();
        res.setSlot(extracted.slot() != null && SLOTS.contains(extracted.slot()) ? extracted.slot() : "snack");
        res.setTitle(extracted.title());
        res.setNote(extracted.note());

        List<MealAiDraftItem> items = new ArrayList<>();
        for (ExtractedLine line : extracted.items() == null ? List.<ExtractedLine>of() : extracted.items()) {
            if (items.size() >= props.maxItems()) {
                log.warn("Meal AI draft truncated at {} items", props.maxItems());
                break;
            }
            MealAiDraftItem item = mapLine(userId, line);
            if (item != null) {
                items.add(item);
            }
        }
        res.setItems(items);
        return res;
    }

    private MealAiDraftItem mapLine(UUID userId, ExtractedLine line) {
        UUID pantryId = parseUuid(line.pantryItemId());
        UUID recipeId = parseUuid(line.recipeId());

        if (pantryId != null) {
            PantryItemEntity p = pantryItemRepository.findByIdAndCreatedByAndDeletedFalse(pantryId, userId)
                    .orElse(null);
            if (p != null) {
                return pantryItem(p, line);
            }
            log.warn("Meal AI draft: hallucinated pantry id {} demoted to estimate", pantryId);
            return estimateItem(line, true);
        }
        if (recipeId != null) {
            RecipeEntity r = recipeRepository.findByIdAndCreatedByAndDeletedFalse(recipeId, userId)
                    .orElse(null);
            if (r != null) {
                return recipeItem(r, line);
            }
            log.warn("Meal AI draft: hallucinated recipe id {} demoted to estimate", recipeId);
            return estimateItem(line, true);
        }
        return estimateItem(line, false);
    }

    private static UUID parseUuid(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return UUID.fromString(raw);
        } catch (IllegalArgumentException e) {
            return null; // malformed id == no id -> estimate
        }
    }

    /** Matched pantry line: snapshot numbers from the DB row, never the LLM. */
    private MealAiDraftItem pantryItem(PantryItemEntity p, ExtractedLine line) {
        MealAiDraftItem item = new MealAiDraftItem();
        item.setSource("pantry");
        item.setPantryItemId(p.getId());
        item.setName(p.getName());
        BigDecimal per = p.getServingAmount() == null ? BigDecimal.ONE : p.getServingAmount();
        String basisUnit = p.getServingUnit() == null ? "unit" : p.getServingUnit();
        item.setPer(per);
        item.setBasisUnit(basisUnit);
        item.setAmount(positiveOr(line.amount(), per));
        item.setUnit(basisUnit);
        item.setKcal(zeroSafe(p.getKcal()));
        item.setProteinG(zeroSafe(p.getProteinG()));
        item.setCarbsG(zeroSafe(p.getCarbsG()));
        item.setFatG(zeroSafe(p.getFatG()));
        item.setNova(p.getNova() == null ? null : p.getNova().intValue());
        item.setConfidence(BigDecimal.ONE);
        item.setNeedsReview(false);
        return item;
    }

    /** Matched recipe line: per-serving snapshot exactly like MealService's recipe arm (basis 1 adag). */
    private MealAiDraftItem recipeItem(RecipeEntity r, ExtractedLine line) {
        MealAiDraftItem item = new MealAiDraftItem();
        item.setSource("recipe");
        item.setRecipeId(r.getId());
        item.setName(r.getName());
        item.setPer(BigDecimal.ONE);
        item.setBasisUnit("adag");
        item.setAmount(positiveOr(line.amount(), BigDecimal.ONE));
        item.setUnit("adag");
        RecipeMacros macros = recipeMapper.toResponse(r).getMacros(); // same whole-recipe rollup MealService reuses
        BigDecimal servings = BigDecimal.valueOf(
                r.getServings() == null || r.getServings() < 1 ? 1 : r.getServings());
        // per-serving = whole / servings, scale 6 — the shared MealService.perServing rollup
        item.setKcal(MealService.perServing(macros.getKcal(), servings));
        item.setProteinG(MealService.perServing(macros.getP(), servings));
        item.setCarbsG(MealService.perServing(macros.getC(), servings));
        item.setFatG(MealService.perServing(macros.getF(), servings));
        item.setNova(r.getNovaDominant() == null ? null : r.getNovaDominant().intValue());
        item.setConfidence(BigDecimal.ONE);
        item.setNeedsReview(false);
        return item;
    }

    /** Estimate (or demoted) line: LLM macros for the stated portion; per = amount. */
    private MealAiDraftItem estimateItem(ExtractedLine line, boolean demoted) {
        if (line.kcal() == null || line.name() == null || line.name().isBlank()) {
            log.warn("Meal AI draft: dropping macro-less line '{}'", line.name());
            return null;
        }
        MealAiDraftItem item = new MealAiDraftItem();
        item.setSource("estimate");
        item.setName(line.name());
        BigDecimal amount = positiveOr(line.amount(), BigDecimal.ONE);
        item.setAmount(amount);
        item.setUnit(line.unit() == null || line.unit().isBlank() ? "adag" : line.unit());
        item.setPer(amount);               // factor 1: snapshots carry the portion totals
        item.setBasisUnit(item.getUnit());
        item.setKcal(line.kcal());
        item.setProteinG(zeroSafe(line.proteinG()));
        item.setCarbsG(zeroSafe(line.carbsG()));
        item.setFatG(zeroSafe(line.fatG()));
        item.setNova(null);
        double confidence = validator.confidence(line.kcal(), line.proteinG(), line.carbsG(), line.fatG());
        item.setConfidence(BigDecimal.valueOf(confidence));
        // boundary-INCLUSIVE threshold (mezo-8vum deviation note); demotion always forces review
        item.setNeedsReview(demoted || confidence <= props.confidenceThreshold());
        return item;
    }

    private static BigDecimal positiveOr(BigDecimal v, BigDecimal fallback) {
        return v == null || v.signum() <= 0 ? fallback : v;
    }

    private static BigDecimal zeroSafe(BigDecimal v) {
        return v == null ? BigDecimal.ZERO : v;
    }
}
