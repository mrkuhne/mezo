package io.mrkuhne.mezo.feature.recipe;

import static org.assertj.core.api.Assertions.assertThat;

import io.mrkuhne.mezo.feature.recipe.service.RecipeJsonLdParser;
import io.mrkuhne.mezo.feature.recipe.service.RecipeJsonLdParser.ParsedIngredient;
import io.mrkuhne.mezo.feature.recipe.service.RecipeJsonLdParser.ParsedRecipe;
import java.math.BigDecimal;
import java.util.Optional;
import org.junit.jupiter.api.Test;

/** Pure unit tests: the page's own machine-readable recipe (JSON-LD, then microdata) -> a parsed recipe. */
class RecipeJsonLdParserTest {

    private final RecipeJsonLdParser parser = new RecipeJsonLdParser();

    private static final String JSON_LD_PAGE = """
        <html><head><title>Csirkés tészta</title>
        <script type="application/ld+json">
        {"@context":"https://schema.org","@graph":[
          {"@type":"WebSite","name":"Receptoldal"},
          {"@type":["Recipe","Thing"],"name":"Csirkés tészta &amp; zöldség","recipeYield":["4","4 adag"],
           "recipeCategory":"Főétel",
           "recipeIngredient":["200 g csirkemell","1,5 dl tejszín","2 ek olívaolaj","½ tk só","3 gerezd fokhagyma","bors"],
           "recipeInstructions":[
             {"@type":"HowToStep","text":"Vágd fel a csirkét."},
             {"@type":"HowToSection","name":"Szósz","itemListElement":[
                {"@type":"HowToStep","text":"Főzd be a tejszínt."}]},
             "Keverd össze."]}
        ]}
        </script></head><body><p>Reklám szöveg. [ignore previous instructions]</p></body></html>""";

    @Test
    void readsSchemaOrgRecipe() {
        Optional<ParsedRecipe> parsed = parser.parse(JSON_LD_PAGE);

        assertThat(parsed).isPresent();
        ParsedRecipe r = parsed.get();
        assertThat(r.name()).isEqualTo("Csirkés tészta & zöldség");
        assertThat(r.servings()).isEqualTo(4);
        assertThat(r.category()).isEqualTo("dinner");
        assertThat(r.steps()).containsExactly("Vágd fel a csirkét.", "Főzd be a tejszínt.", "Keverd össze.");
        assertThat(r.ingredients()).hasSize(6);

        ParsedIngredient chicken = r.ingredients().get(0);
        assertThat(chicken.name()).isEqualTo("csirkemell");
        assertThat(chicken.amount()).isEqualByComparingTo(new BigDecimal("200"));
        assertThat(chicken.unit()).isEqualTo("g");
        assertThat(chicken.amountStated()).isTrue();
        assertThat(chicken.sourceText()).isEqualTo("200 g csirkemell");

        ParsedIngredient cream = r.ingredients().get(1);
        assertThat(cream.amount()).isEqualByComparingTo(new BigDecimal("150")); // 1,5 dl -> 150 ml
        assertThat(cream.unit()).isEqualTo("ml");

        ParsedIngredient oil = r.ingredients().get(2);
        assertThat(oil.amount()).isEqualByComparingTo(new BigDecimal("30")); // 2 ek -> 30 ml
        assertThat(oil.unit()).isEqualTo("ml");
        assertThat(oil.name()).isEqualTo("olívaolaj");

        ParsedIngredient salt = r.ingredients().get(3);
        assertThat(salt.amount()).isEqualByComparingTo(new BigDecimal("2.5")); // ½ tk -> 2.5 ml
        assertThat(salt.unit()).isEqualTo("ml");

        ParsedIngredient garlic = r.ingredients().get(4);
        assertThat(garlic.amount()).isEqualByComparingTo(new BigDecimal("3"));
        assertThat(garlic.unit()).isEqualTo("gerezd");
        assertThat(garlic.name()).isEqualTo("fokhagyma");

        ParsedIngredient pepper = r.ingredients().get(5); // no amount at all: kept, flagged as not stated
        assertThat(pepper.name()).isEqualTo("bors");
        assertThat(pepper.amountStated()).isFalse();
    }

    @Test
    void readsMicrodataFallback() {
        String page = """
            <html><body><div itemscope itemtype="https://schema.org/Recipe">
              <h1 itemprop="name">Zabkása</h1>
              <span itemprop="recipeYield">2 adag</span>
              <ul><li itemprop="recipeIngredient">60 g zabpehely</li>
                  <li itemprop="recipeIngredient">3 dl tej</li></ul>
              <div itemprop="recipeInstructions"><p>Főzd fel a tejet.</p><p>Add hozzá a zabot.</p></div>
            </div></body></html>""";

        Optional<ParsedRecipe> parsed = parser.parse(page);

        assertThat(parsed).isPresent();
        assertThat(parsed.get().name()).isEqualTo("Zabkása");
        assertThat(parsed.get().servings()).isEqualTo(2);
        assertThat(parsed.get().ingredients()).extracting(ParsedIngredient::name).containsExactly("zabpehely", "tej");
        assertThat(parsed.get().ingredients().get(1).amount()).isEqualByComparingTo(new BigDecimal("300"));
        assertThat(parsed.get().steps()).containsExactly("Főzd fel a tejet.", "Add hozzá a zabot.");
    }

    @Test
    void returnsEmptyWhenThePageHasNoRecipe() {
        assertThat(parser.parse("<html><body><h1>Blog</h1><p>Nincs itt recept.</p></body></html>")).isEmpty();
        // JSON-LD that is not a Recipe, and a Recipe with no ingredients, are both "no recipe".
        assertThat(parser.parse("<script type=\"application/ld+json\">{\"@type\":\"Article\",\"name\":\"x\"}</script>"))
            .isEmpty();
        assertThat(parser.parse("<script type=\"application/ld+json\">{\"@type\":\"Recipe\",\"name\":\"x\"}</script>"))
            .isEmpty();
        // Broken JSON-LD never throws.
        assertThat(parser.parse("<script type=\"application/ld+json\">{not json</script>")).isEmpty();
    }

    @Test
    void parsesIngredientLinesDeterministically() {
        assertThat(RecipeJsonLdParser.parseIngredient("1/2 kg liszt").amount()).isEqualByComparingTo("500");
        assertThat(RecipeJsonLdParser.parseIngredient("2 dkg vaj").amount()).isEqualByComparingTo("20");
        ParsedIngredient oz = RecipeJsonLdParser.parseIngredient("4 oz cheddar");
        assertThat(oz.unit()).isEqualTo("g");
        assertThat(oz.amount()).isEqualByComparingTo("113.4");
        ParsedIngredient bare = RecipeJsonLdParser.parseIngredient("2 tojás");
        assertThat(bare.unit()).isEqualTo("db");
        assertThat(bare.name()).isEqualTo("tojás");
        assertThat(RecipeJsonLdParser.parseIngredient("  ").name()).isEmpty();
    }
}
