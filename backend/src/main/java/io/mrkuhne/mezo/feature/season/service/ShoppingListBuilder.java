package io.mrkuhne.mezo.feature.season.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

/**
 * The shopping list of a menu week, pure (Boop B6 Évad S3, spec §5.8): every recipe ingredient × the meal's servings ÷
 * the recipe's own servings, merged per catalog item (else per name), in one base unit (kg → g, l → ml), grouped
 * into five shelves, with the recipes each line is for. No stock, no prices.
 */
public final class ShoppingListBuilder {

    public static final String SHELF_PRODUCE = "zoldseg";
    public static final String SHELF_MEAT = "hus";
    public static final String SHELF_DAIRY = "tej";
    public static final String SHELF_PANTRY = "kamra";
    public static final String SHELF_OTHER = "egyeb";
    /** Shelf order on the list. */
    public static final List<String> SHELVES = List.of(SHELF_PRODUCE, SHELF_MEAT, SHELF_DAIRY, SHELF_PANTRY, SHELF_OTHER);

    private ShoppingListBuilder() {
    }

    /** One planned meal's recipe and servings. */
    public record Use(UUID recipeId, BigDecimal servings) {
    }

    /** One ingredient line of a recipe ({@code recipeServings} = how many servings the recipe's amounts make). */
    public record Line(UUID recipeId, String recipeName, int recipeServings, UUID catalogId, String name,
                       BigDecimal amount, String unit, String category) {
    }

    /** One merged list line ({@code amount} in the base unit {@code g | ml | db} or the line's own unit). */
    public record Item(String key, UUID catalogId, String name, BigDecimal amount, String unit, String shelf,
                       List<String> forRecipes) {
    }

    public static List<Item> build(List<Use> uses, List<Line> lines) {
        Map<UUID, List<Line>> byRecipe = new LinkedHashMap<>();
        lines.forEach(l -> byRecipe.computeIfAbsent(l.recipeId(), k -> new ArrayList<>()).add(l));

        Map<String, Acc> acc = new LinkedHashMap<>();
        for (Use use : uses) {
            if (use.recipeId() == null || use.servings() == null) {
                continue; // an ingredient tip has no recipe to shop for
            }
            for (Line l : byRecipe.getOrDefault(use.recipeId(), List.of())) {
                if (l.amount() == null || l.amount().signum() <= 0) {
                    continue;
                }
                String unit = baseUnit(l.unit());
                BigDecimal amount = toBase(l.amount(), l.unit())
                    .multiply(use.servings())
                    .divide(BigDecimal.valueOf(Math.max(1, l.recipeServings())), 4, RoundingMode.HALF_UP);
                String key = (l.catalogId() != null ? l.catalogId().toString() : l.name().strip().toLowerCase(Locale.ROOT))
                    + "|" + unit;
                Acc a = acc.computeIfAbsent(key, k -> new Acc(key, l.catalogId(), l.name().strip(), unit, shelf(l.category())));
                a.amount = a.amount.add(amount);
                a.uses.merge(l.recipeName(), 1, Integer::sum);
            }
        }
        return acc.values().stream()
            .map(Acc::item)
            .sorted(Comparator.comparingInt((Item i) -> SHELVES.indexOf(i.shelf()))
                .thenComparing(i -> i.name().toLowerCase(Locale.forLanguageTag("hu"))))
            .toList();
    }

    /** The five shelf groups from the catalog's category; anything unknown is „Egyéb". */
    public static String shelf(String category) {
        if (category == null) {
            return SHELF_OTHER;
        }
        return switch (category) {
            case "vegetables", "fruits" -> SHELF_PRODUCE;
            case "meat", "fish", "eggs" -> SHELF_MEAT;
            case "dairy", "cheese" -> SHELF_DAIRY;
            case "legumes", "grains", "pasta", "bakery", "nuts_seeds", "oils_fats", "condiments", "snacks" -> SHELF_PANTRY;
            default -> SHELF_OTHER;
        };
    }

    /**
     * What he reads on the list: grams and millilitres rounded up (to 5 under 100, to 10 under 1000), from 1000 on
     * in kg / l with one decimal and a Hungarian comma („1,4 kg"), pieces whole („3 db"). Null amount → null.
     */
    public static String amountText(BigDecimal amount, String unit) {
        if (amount == null) {
            return null;
        }
        double v = amount.doubleValue();
        if ("g".equals(unit) || "ml".equals(unit)) {
            if (v >= 1000) {
                double big = Math.ceil(v / 100.0) / 10.0;
                String n = big == Math.floor(big) ? String.valueOf((long) big) : String.valueOf(big).replace('.', ',');
                return n + ("g".equals(unit) ? " kg" : " l");
            }
            long step = v < 100 ? 5 : 10;
            long rounded = Math.max(step, (long) (Math.ceil(v / step) * step));
            return rounded + " " + unit;
        }
        if ("db".equals(unit)) {
            return Math.max(1, (long) Math.ceil(v - 1e-9)) + " db";
        }
        String n = amount.setScale(1, RoundingMode.UP).stripTrailingZeros().toPlainString().replace('.', ',');
        return n + (unit == null ? "" : " " + unit);
    }

    static String baseUnit(String unit) {
        String u = unit == null ? "" : unit.strip().toLowerCase(Locale.ROOT);
        return switch (u) {
            case "g", "kg", "dkg" -> "g";
            case "ml", "l", "dl", "cl" -> "ml";
            case "db", "pcs", "piece", "darab" -> "db";
            default -> u.isEmpty() ? "db" : u;
        };
    }

    static BigDecimal toBase(BigDecimal amount, String unit) {
        String u = unit == null ? "" : unit.strip().toLowerCase(Locale.ROOT);
        return switch (u) {
            case "kg", "l" -> amount.multiply(BigDecimal.valueOf(1000));
            case "dkg" -> amount.multiply(BigDecimal.TEN);
            case "dl" -> amount.multiply(BigDecimal.valueOf(100));
            case "cl" -> amount.multiply(BigDecimal.TEN);
            default -> amount;
        };
    }

    private static final class Acc {
        final String key;
        final UUID catalogId;
        final String name;
        final String unit;
        final String shelf;
        BigDecimal amount = BigDecimal.ZERO;
        final Map<String, Integer> uses = new LinkedHashMap<>();

        Acc(String key, UUID catalogId, String name, String unit, String shelf) {
            this.key = key;
            this.catalogId = catalogId;
            this.name = name;
            this.unit = unit;
            this.shelf = shelf;
        }

        Item item() {
            List<String> forRecipes = uses.entrySet().stream()
                .map(e -> e.getValue() > 1 ? e.getKey() + " ×" + e.getValue() : e.getKey())
                .toList();
            return new Item(key, catalogId, name, amount.setScale(2, RoundingMode.HALF_UP), unit, shelf, forRecipes);
        }
    }
}
