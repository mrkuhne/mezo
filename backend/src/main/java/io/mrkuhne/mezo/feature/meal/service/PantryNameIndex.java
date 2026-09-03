package io.mrkuhne.mezo.feature.meal.service;

import io.mrkuhne.mezo.feature.pantry.entity.PantryItemEntity;
import java.text.Normalizer;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Strict, deterministic name -> pantry-row lookup for the AI meal draft (mezo-qrks). It is the
 * net UNDER the LLM's own catalog matching: when the model recognizes a food but leaves
 * {@code pantryItemId} null, {@link MealAiDraftService} asks this index before falling through to
 * an estimate line.
 *
 * <p>Deliberately unforgiving — a wrong match silently writes wrong macros into the log, while a
 * miss only costs convenience. Hence: normalized FULL-name equality (no substring, no similarity
 * score), an ambiguous key resolves to nothing, and the amount unit must agree with the row's
 * serving unit. Pure and Spring-free so the rules are unit-testable without a context.
 */
public final class PantryNameIndex {

    private static final Pattern DIACRITICS = Pattern.compile("\\p{M}+");
    private static final Pattern NON_ALPHANUMERIC = Pattern.compile("[^\\p{IsAlphabetic}\\p{IsDigit}]+");
    /** A trailing packaging size on the RAW name: "Zabpehely 500 g", "Kefir 1,5 l". */
    private static final Pattern PACK_SIZE =
            Pattern.compile("[\\s,;\\-]+\\d+(?:[.,]\\d+)?\\s*(?:g|dkg|kg|ml|cl|dl|l|db)\\s*$",
                    Pattern.CASE_INSENSITIVE);
    private static final Map<String, String> UNIT_SYNONYMS = Map.of(
            "gramm", "g", "gr", "g", "milliliter", "ml", "darab", "db", "piece", "db");
    // DIVERGES ON PURPOSE from the other two null-serving-unit sites, which both default to
    // "unit": MealAiDraftService.pantryItem (its `per`/unit fallback) and MealService (its
    // buildItem pantry arm). Mandated by the approved design spec and pinned by
    // PantryNameIndexTest#testMatch_shouldTreatNullServingUnitAsGrams; unreachable in practice
    // since the pantry contract requires a non-null serving unit. Ruled to stand as-is - do not
    // "fix" this into agreement with the other two without revisiting the spec.
    private static final String DEFAULT_SERVING_UNIT = "g";

    /** Keys that survived the ambiguity check; a key claimed by two different rows is dropped. */
    private final Map<String, PantryItemEntity> byKey;

    private PantryNameIndex(Map<String, PantryItemEntity> byKey) {
        this.byKey = byKey;
    }

    public static PantryNameIndex of(List<PantryItemEntity> items) {
        Map<String, PantryItemEntity> byKey = new HashMap<>();
        Set<String> ambiguous = new HashSet<>();
        for (PantryItemEntity item : items) {
            // Only kind="food" rows reach the composer's `usePantry().ingredients` list
            // (PantryService.getPantry splits food into ingredients, everything else into
            // stash) - matching a supplement/stim/med row here would return a source=pantry
            // line the frontend can't resolve, desyncing the displayed totals (0 kcal, falls
            // back to a missing ingredient) from what MealService actually snapshots on save.
            if (!"food".equals(item.getCatalog().getKind())) {
                continue;
            }
            for (String key : keysOf(item)) {
                PantryItemEntity previous = byKey.putIfAbsent(key, item);
                if (previous != null && !Objects.equals(previous.getId(), item.getId())) {
                    ambiguous.add(key);
                }
            }
        }
        ambiguous.forEach(byKey::remove);
        return new PantryNameIndex(Map.copyOf(byKey));
    }

    /** The row whose name (or brand+name, or pack-size-stripped name) equals {@code name}. */
    public Optional<PantryItemEntity> match(String name, String unit) {
        String key = normalize(name);
        if (key.isEmpty()) {
            return Optional.empty();
        }
        PantryItemEntity hit = byKey.get(key);
        if (hit == null || !unitsAgree(unit, hit.getCatalog().getServingUnit())) {
            return Optional.empty();
        }
        return Optional.of(hit);
    }

    private static Set<String> keysOf(PantryItemEntity item) {
        String name = item.getCatalog().getName() == null ? "" : item.getCatalog().getName();
        String brand = item.getCatalog().getBrand() == null ? "" : item.getCatalog().getBrand().trim();
        String stripped = PACK_SIZE.matcher(name).replaceFirst("");
        Set<String> keys = new LinkedHashSet<>();
        keys.add(normalize(name));
        keys.add(normalize(stripped));
        if (!brand.isEmpty()) {
            keys.add(normalize(brand + " " + name));
            keys.add(normalize(brand + " " + stripped));
        }
        keys.remove("");
        return keys;
    }

    /** Accent-free, punctuation-free, single-spaced lowercase — applied to BOTH sides. */
    private static String normalize(String raw) {
        if (raw == null) {
            return "";
        }
        String decomposed = Normalizer.normalize(raw, Normalizer.Form.NFD);
        String bare = DIACRITICS.matcher(decomposed).replaceAll("");
        return NON_ALPHANUMERIC.matcher(bare).replaceAll(" ").trim().toLowerCase(Locale.ROOT);
    }

    /** The draft's unit must be the row's serving unit; a blank draft unit never matches. */
    private static boolean unitsAgree(String draftUnit, String servingUnit) {
        String draft = canonicalUnit(draftUnit);
        if (draft.isEmpty()) {
            return false;
        }
        String serving = canonicalUnit(servingUnit);
        return draft.equals(serving.isEmpty() ? DEFAULT_SERVING_UNIT : serving);
    }

    private static String canonicalUnit(String raw) {
        String normalized = normalize(raw);
        return UNIT_SYNONYMS.getOrDefault(normalized, normalized);
    }
}
