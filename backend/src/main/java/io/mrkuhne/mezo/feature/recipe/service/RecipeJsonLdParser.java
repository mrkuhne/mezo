package io.mrkuhne.mezo.feature.recipe.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import lombok.extern.slf4j.Slf4j;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.select.Elements;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Reads a page's OWN machine-readable recipe — schema.org/Recipe as JSON-LD first, then microdata —
 * without any AI. The page is untrusted data: nothing here is executed or followed, every string is
 * length-capped, broken markup or JSON simply yields "no recipe", and the walk through the JSON is
 * depth-bounded. Ingredient lines are turned into amount/unit/name by a deterministic parser
 * ({@link #parseIngredient}) that is shared with the AI route (which is asked to copy the lines
 * verbatim), so both routes convert units the same way.
 */
@Slf4j
@Component
public class RecipeJsonLdParser {

    static final int MAX_LINE_CHARS = 200;
    static final int MAX_NAME_CHARS = 120;
    static final int MAX_STEP_CHARS = 2000;
    static final int MAX_STEPS = 50;
    static final int MAX_INGREDIENTS = 60;
    private static final int MAX_DEPTH = 6;

    /** One ingredient line read from the source. {@code amountStated} is false when the source gave no quantity. */
    public record ParsedIngredient(String name, BigDecimal amount, String unit, boolean amountStated, String sourceText) {
    }

    /** What a source says about a recipe; {@code category} is a hint ({@code null} when it says nothing usable). */
    public record ParsedRecipe(String name, Integer servings, String category,
            List<ParsedIngredient> ingredients, List<String> steps) {
    }

    private final JsonMapper json = JsonMapper.builder().build();

    public Optional<ParsedRecipe> parse(String html) {
        if (html == null || html.isBlank()) {
            return Optional.empty();
        }
        Document doc;
        try {
            doc = Jsoup.parse(html);
        } catch (RuntimeException e) {
            return Optional.empty();
        }
        for (Element script : doc.select("script[type~=(?i)ld\\+json]")) {
            try {
                JsonNode root = json.readTree(script.data());
                Optional<ParsedRecipe> hit = fromJsonLd(root, 0);
                if (hit.isPresent()) {
                    return hit;
                }
            } catch (RuntimeException e) {
                log.debug("Unreadable JSON-LD block skipped: {}", e.getMessage());
            }
        }
        return fromMicrodata(doc);
    }

    // ---- JSON-LD ----

    private Optional<ParsedRecipe> fromJsonLd(JsonNode node, int depth) {
        if (node == null || depth > MAX_DEPTH) {
            return Optional.empty();
        }
        if (node.isArray()) {
            for (JsonNode item : node) {
                Optional<ParsedRecipe> hit = fromJsonLd(item, depth + 1);
                if (hit.isPresent()) {
                    return hit;
                }
            }
            return Optional.empty();
        }
        if (!node.isObject()) {
            return Optional.empty();
        }
        if (isRecipeType(node.path("@type"))) {
            Optional<ParsedRecipe> own = fromRecipeNode(node);
            if (own.isPresent()) {
                return own;
            }
        }
        return fromJsonLd(node.path("@graph"), depth + 1);
    }

    private static boolean isRecipeType(JsonNode type) {
        if (type.isArray()) {
            for (JsonNode t : type) {
                if (isRecipeType(t)) {
                    return true;
                }
            }
            return false;
        }
        return type.isString() && (type.asString().equals("Recipe") || type.asString().endsWith("/Recipe"));
    }

    private Optional<ParsedRecipe> fromRecipeNode(JsonNode r) {
        String name = singleLine(r.path("name").asString(""), MAX_NAME_CHARS);
        List<ParsedIngredient> ingredients = new ArrayList<>();
        JsonNode ing = r.has("recipeIngredient") ? r.path("recipeIngredient") : r.path("ingredients");
        for (JsonNode i : ing.isArray() ? ing : List.of(ing)) {
            addIngredient(ingredients, i.isString() ? i.asString() : "");
        }
        if (name.isEmpty() || ingredients.isEmpty()) {
            return Optional.empty();
        }
        List<String> steps = new ArrayList<>();
        collectSteps(r.path("recipeInstructions"), steps, 0);
        return Optional.of(new ParsedRecipe(name, servingsOf(textOf(r.path("recipeYield"))),
            categoryOf(textOf(r.path("recipeCategory"))), ingredients, steps));
    }

    private void collectSteps(JsonNode node, List<String> out, int depth) {
        if (node == null || depth > MAX_DEPTH || out.size() >= MAX_STEPS) {
            return;
        }
        if (node.isString()) {
            for (String line : lines(node.asString())) {
                addStep(out, line);
            }
        } else if (node.isArray()) {
            for (JsonNode item : node) {
                collectSteps(item, out, depth + 1);
            }
        } else if (node.isObject()) {
            if (node.has("itemListElement")) {
                collectSteps(node.path("itemListElement"), out, depth + 1);
            } else if (node.path("text").isString()) {
                collectSteps(node.path("text"), out, depth + 1);
            } else if (node.path("name").isString()) {
                collectSteps(node.path("name"), out, depth + 1);
            }
        }
    }

    // ---- microdata ----

    private Optional<ParsedRecipe> fromMicrodata(Document doc) {
        Element recipe = doc.selectFirst("[itemtype~=(?i)schema\\.org/Recipe\\b]");
        if (recipe == null) {
            return Optional.empty();
        }
        Element nameEl = recipe.selectFirst("[itemprop=name]");
        String name = nameEl == null ? "" : singleLine(propText(nameEl), MAX_NAME_CHARS);
        List<ParsedIngredient> ingredients = new ArrayList<>();
        for (Element i : recipe.select("[itemprop=recipeIngredient], [itemprop=ingredients]")) {
            addIngredient(ingredients, propText(i));
        }
        if (name.isEmpty() || ingredients.isEmpty()) {
            return Optional.empty();
        }
        List<String> steps = new ArrayList<>();
        for (Element block : recipe.select("[itemprop=recipeInstructions]")) {
            Elements items = block.select("li, p");
            if (items.isEmpty()) {
                for (String line : lines(block.html())) {
                    addStep(steps, line);
                }
            } else {
                for (Element item : items) {
                    for (String line : lines(item.html())) {
                        addStep(steps, line);
                    }
                }
            }
        }
        Element yield = recipe.selectFirst("[itemprop=recipeYield]");
        Element cat = recipe.selectFirst("[itemprop=recipeCategory]");
        return Optional.of(new ParsedRecipe(name, yield == null ? null : servingsOf(propText(yield)),
            cat == null ? null : categoryOf(propText(cat)), ingredients, steps));
    }

    private static String propText(Element e) {
        return e.hasAttr("content") ? e.attr("content") : e.text();
    }

    // ---- shared helpers ----

    private static void addIngredient(List<ParsedIngredient> out, String raw) {
        if (out.size() >= MAX_INGREDIENTS) {
            return;
        }
        ParsedIngredient p = parseIngredient(raw);
        if (!p.name().isEmpty()) {
            out.add(p);
        }
    }

    private static void addStep(List<String> out, String step) {
        if (out.size() < MAX_STEPS && !step.isBlank()) {
            out.add(step.length() <= MAX_STEP_CHARS ? step : step.substring(0, MAX_STEP_CHARS));
        }
    }

    private static String textOf(JsonNode n) {
        if (n.isArray()) {
            StringBuilder sb = new StringBuilder();
            for (JsonNode i : n) {
                sb.append(i.isString() || i.isNumber() ? i.asString() : "").append(' ');
            }
            return sb.toString();
        }
        return n.isString() || n.isNumber() ? n.asString() : "";
    }

    /** Markup-free text of an HTML-ish fragment, one entry per line break / paragraph / list item. */
    static List<String> lines(String fragment) {
        String withBreaks = fragment.replaceAll("(?i)<br\\s*/?>|</p>|</li>|</div>", "\n");
        String plain = Jsoup.parse(withBreaks).wholeText();
        List<String> out = new ArrayList<>();
        for (String line : plain.split("\\R")) {
            String t = line.replaceAll("\\s+", " ").strip();
            if (!t.isEmpty()) {
                out.add(t);
            }
        }
        return out;
    }

    private static String singleLine(String raw, int max) {
        String t = Jsoup.parse(raw == null ? "" : raw).text().strip();
        return t.length() <= max ? t : t.substring(0, max);
    }

    private static final Pattern FIRST_INT = Pattern.compile("\\d+");

    private static Integer servingsOf(String yield) {
        Matcher m = FIRST_INT.matcher(yield == null ? "" : yield);
        if (!m.find() || m.group().length() > 4) {
            return null;
        }
        int n = Integer.parseInt(m.group());
        return n < 1 ? null : n;
    }

    private static String categoryOf(String raw) {
        String c = raw == null ? "" : raw.toLowerCase(Locale.ROOT);
        if (c.matches(".*(reggeli|breakfast|brunch).*")) {
            return "breakfast";
        }
        if (c.matches(".*(snack|desszert|dessert|süt|uzsonna|előétel|appetizer|starter).*")) {
            return "snack";
        }
        if (c.matches(".*(ebéd|lunch).*")) {
            return "lunch";
        }
        if (c.matches(".*(vacsora|dinner|főétel|main).*")) {
            return "dinner";
        }
        return null;
    }

    // ---- ingredient line ----

    private record Unit(String canonical, BigDecimal factor) {
    }

    private static final Map<String, Unit> UNITS = unitTable();

    private static Map<String, Unit> unitTable() {
        java.util.HashMap<String, Unit> m = new java.util.HashMap<>();
        put(m, "g", "1", "g", "gr", "gramm", "gram", "grams");
        put(m, "g", "10", "dkg", "dag", "deka");
        put(m, "g", "1000", "kg", "kilo", "kilogramm");
        put(m, "g", "0.001", "mg");
        put(m, "ml", "1", "ml", "milliliter");
        put(m, "ml", "10", "cl");
        put(m, "ml", "100", "dl");
        put(m, "ml", "1000", "l", "liter", "lit", "litre");
        put(m, "ml", "15", "ek", "evőkanál", "tbsp", "tablespoon", "tablespoons");
        put(m, "ml", "5", "tk", "teáskanál", "tsp", "teaspoon", "teaspoons");
        put(m, "ml", "240", "cup", "cups", "csésze");
        put(m, "g", "28.35", "oz", "ounce", "ounces");
        put(m, "g", "453.6", "lb", "lbs", "pound", "pounds");
        // Counted things keep their own word; the amount is left as written.
        put(m, "db", "1", "db", "darab", "szem", "pcs", "piece", "pieces");
        put(m, "gerezd", "1", "gerezd", "clove", "cloves");
        put(m, "szelet", "1", "szelet", "slice", "slices");
        put(m, "csipet", "1", "csipet", "pinch");
        put(m, "csokor", "1", "csokor", "bunch");
        put(m, "fej", "1", "fej", "head");
        put(m, "csomag", "1", "csomag", "csomagocska", "pack", "package");
        put(m, "doboz", "1", "doboz", "dobozka", "can", "tin");
        return Map.copyOf(m);
    }

    private static void put(Map<String, Unit> m, String canonical, String factor, String... words) {
        for (String w : words) {
            m.put(w, new Unit(canonical, new BigDecimal(factor)));
        }
    }

    private static final String FRACS = "½¼¾⅓⅔⅛";
    private static final Map<Character, BigDecimal> FRAC_VALUE = Map.of(
        '½', new BigDecimal("0.5"), '¼', new BigDecimal("0.25"), '¾', new BigDecimal("0.75"),
        '⅓', new BigDecimal("0.333"), '⅔', new BigDecimal("0.667"), '⅛', new BigDecimal("0.125"));

    private static final Pattern QTY = Pattern.compile(
        "^(?:(\\d+)\\s*([" + FRACS + "])"          // 1½
            + "|(\\d+)\\s+(\\d+)/(\\d+)"             // 1 1/2
            + "|(\\d+)/(\\d+)"                      // 1/2
            + "|([" + FRACS + "])"                  // ½
            + "|(\\d+(?:[.,]\\d+)?))"               // 200, 1,5
            + "(?:\\s*[-–]\\s*\\d+(?:[.,]\\d+)?)?"); // 2-3 -> the first
    private static final Pattern WORD = Pattern.compile("^\\p{L}+\\.?");

    /** "200 g csirkemell" -> 200 g "csirkemell"; units are normalised to g / ml where they are a mass or volume. */
    public static ParsedIngredient parseIngredient(String raw) {
        String text = raw == null ? "" : Jsoup.parse(raw).text().replaceAll("\\s+", " ").strip();
        if (text.length() > MAX_LINE_CHARS) {
            text = text.substring(0, MAX_LINE_CHARS);
        }
        BigDecimal amount = null;
        String rest = text;
        Matcher q = QTY.matcher(text);
        if (q.find()) {
            amount = quantity(q);
            rest = text.substring(q.end()).strip();
        }
        String unit = "db";
        if (amount != null) {
            Matcher w = WORD.matcher(rest);
            if (w.find()) {
                Unit u = UNITS.get(w.group().replaceAll("\\.$", "").toLowerCase(Locale.ROOT));
                if (u != null) {
                    amount = amount.multiply(u.factor()).setScale(3, RoundingMode.HALF_UP).stripTrailingZeros();
                    unit = u.canonical();
                    rest = rest.substring(w.end()).strip();
                }
            }
        }
        String name = rest.replaceFirst("(?i)^(of|from)\\s+", "").split("[,(;]", 2)[0].strip();
        if (name.length() > MAX_NAME_CHARS) {
            name = name.substring(0, MAX_NAME_CHARS);
        }
        boolean stated = amount != null && amount.signum() > 0;
        if (!stated) {
            amount = BigDecimal.ONE;
        }
        if (amount.compareTo(new BigDecimal("100000")) > 0) {
            amount = new BigDecimal("100000");
        }
        return new ParsedIngredient(name, amount.setScale(Math.max(0, amount.scale()), RoundingMode.HALF_UP),
            unit, stated, text);
    }

    private static BigDecimal quantity(Matcher q) {
        if (q.group(1) != null) {
            return new BigDecimal(q.group(1)).add(FRAC_VALUE.get(q.group(2).charAt(0)));
        }
        if (q.group(3) != null) {
            return new BigDecimal(q.group(3)).add(fraction(q.group(4), q.group(5)));
        }
        if (q.group(6) != null) {
            return fraction(q.group(6), q.group(7));
        }
        if (q.group(8) != null) {
            return FRAC_VALUE.get(q.group(8).charAt(0));
        }
        return new BigDecimal(q.group(9).replace(',', '.'));
    }

    private static BigDecimal fraction(String num, String den) {
        BigDecimal d = new BigDecimal(den);
        return d.signum() == 0 ? BigDecimal.ZERO : new BigDecimal(num).divide(d, 3, RoundingMode.HALF_UP);
    }
}
