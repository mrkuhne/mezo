package io.mrkuhne.mezo.feature.recipe.service;

import io.mrkuhne.mezo.api.dto.WorkshopDraft;
import io.mrkuhne.mezo.api.dto.WorkshopDraftLine;
import io.mrkuhne.mezo.feature.pantry.entity.PantryItemEntity;
import io.mrkuhne.mezo.feature.recipe.config.RecipeWorkshopProperties;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

/**
 * Deterministic sanitation of the LLM's workshop draft (mezo-92pb, mirror of the
 * MealAiDraftService mapping rules): the LLM proposes, this component decides. Pantry ids are
 * resolved through the injected lookup (owner-scoped repo call in production, lambda in unit
 * tests); a hallucinated/malformed id demotes the line to estimate — never a 500, never silent
 * corruption. Pantry lines get their NAME from the DB row and carry NO macros (the FE computes
 * them from pantry facts); estimate lines keep the LLM's totals for the stated amount.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class RecipeWorkshopValidator {

    private static final Set<String> CATEGORIES = Set.of("breakfast", "lunch", "dinner", "snack");

    private final RecipeWorkshopProperties props;

    /** LLM answer contract — ids as String so a malformed uuid demotes the line, not the call. */
    public record RawLine(String pantryItemId, String name, BigDecimal amount, String unit,
            BigDecimal kcal, BigDecimal proteinG, BigDecimal carbsG, BigDecimal fatG) {
    }

    public record RawDraft(String name, String category, Integer servings, List<String> steps,
            List<RawLine> lines) {
    }

    public WorkshopDraft sanitize(RawDraft raw, Function<UUID, Optional<PantryItemEntity>> pantryLookup) {
        WorkshopDraft out = new WorkshopDraft();
        out.setName(raw.name() == null || raw.name().isBlank() ? "Új recept" : raw.name().strip());
        out.setCategory(raw.category() != null && CATEGORIES.contains(raw.category()) ? raw.category() : "dinner");
        int servings = raw.servings() == null ? 1 : raw.servings();
        out.setServings(Math.max(1, Math.min(12, servings)));
        List<String> steps = raw.steps() == null ? List.of() : raw.steps();
        out.setSteps(steps.stream().filter(s -> s != null && !s.isBlank()).limit(props.maxSteps()).toList());

        List<WorkshopDraftLine> lines = new ArrayList<>();
        for (RawLine line : raw.lines() == null ? List.<RawLine>of() : raw.lines()) {
            if (lines.size() >= props.maxLines()) {
                log.warn("Workshop draft truncated at {} lines", props.maxLines());
                break;
            }
            WorkshopDraftLine mapped = mapLine(line, pantryLookup);
            if (mapped != null) {
                lines.add(mapped);
            }
        }
        out.setLines(lines);
        return out;
    }

    private WorkshopDraftLine mapLine(RawLine line, Function<UUID, Optional<PantryItemEntity>> pantryLookup) {
        UUID pantryId = parseUuid(line.pantryItemId());
        if (pantryId != null) {
            PantryItemEntity p = pantryLookup.apply(pantryId).orElse(null);
            if (p != null) {
                WorkshopDraftLine out = base(line);
                out.setSource("pantry");
                out.setPantryItemId(p.getId());
                out.setName(p.getCatalog().getName());          // DB name, never the LLM's
                out.setUnit(p.getCatalog().getServingUnit() == null || p.getCatalog().getServingUnit().isBlank()
                    ? "g" : p.getCatalog().getServingUnit());
                return out;                                     // macros stay null: FE computes
            }
            log.warn("Workshop draft: hallucinated pantry id {} demoted to estimate", pantryId);
        }
        if (line.kcal() == null || line.name() == null || line.name().isBlank()) {
            log.warn("Workshop draft: dropping macro-less estimate line '{}'", line.name());
            return null;
        }
        WorkshopDraftLine out = base(line);
        out.setSource("estimate");
        out.setName(line.name().strip());
        out.setKcal(line.kcal());
        out.setProteinG(zeroSafe(line.proteinG()));
        out.setCarbsG(zeroSafe(line.carbsG()));
        out.setFatG(zeroSafe(line.fatG()));
        return out;
    }

    private static WorkshopDraftLine base(RawLine line) {
        WorkshopDraftLine out = new WorkshopDraftLine();
        out.setAmount(line.amount() == null || line.amount().signum() <= 0 ? BigDecimal.ONE : line.amount());
        out.setUnit(line.unit() == null || line.unit().isBlank() ? "g" : line.unit());
        out.setName(line.name() == null ? "" : line.name());
        return out;
    }

    private static UUID parseUuid(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            return UUID.fromString(raw);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    private static BigDecimal zeroSafe(BigDecimal v) {
        return v == null ? BigDecimal.ZERO : v;
    }
}
