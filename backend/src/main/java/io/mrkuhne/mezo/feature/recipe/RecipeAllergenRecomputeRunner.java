package io.mrkuhne.mezo.feature.recipe;

import io.mrkuhne.mezo.feature.nutrition.service.AllergenState;
import io.mrkuhne.mezo.feature.pantry.entity.PantryCatalogEntity;
import io.mrkuhne.mezo.feature.pantry.entity.PantryItemEntity;
import io.mrkuhne.mezo.feature.pantry.repository.PantryItemRepository;
import io.mrkuhne.mezo.feature.recipe.entity.RecipeEntity;
import io.mrkuhne.mezo.feature.recipe.entity.RecipeIngredientEntity;
import io.mrkuhne.mezo.feature.recipe.repository.RecipeRepository;
import io.mrkuhne.mezo.feature.recipe.service.RecipeAllergenRollup;
import io.mrkuhne.mezo.feature.recipe.service.RecipeAllergenRollup.LineFacts;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Egyszeri adatjavítás (mezo-r36n9.48): a recept allergén-összegzése csak mentéskor íródik, ezért a
 * már elmentett receptek az ÜRES katalógus idejéből származó összegzést hordozzák — a két halas
 * vacsora és a tojásos reggelik „allergénmentesként". Ez a futó a feltöltött katalógusból számolja
 * újra mindegyiket, pontosan ugyanazzal a {@link RecipeAllergenRollup}-pal, amit a mentés használ,
 * tehát a két út nem tud szétcsúszni.
 *
 * <p>Csak akkor ír, ha az eredmény más, mint ami a soron van, és sosem állít semmit saját jogon: a
 * lefedetlen alapanyag továbbra is „nincs adat", ami minden olvasónál figyelmeztetést jelent, nem
 * felmentést.
 *
 * <p>{@code @Order(53)}: a {@link io.mrkuhne.mezo.feature.pantry.PantryCatalogAllergenBaselineRunner}
 * (52) UTÁN — előbb legyen mit összegezni.
 */
@Slf4j
@Component
@Profile("demodata")
@Order(53)
@RequiredArgsConstructor
public class RecipeAllergenRecomputeRunner implements CommandLineRunner {

    private final RecipeRepository recipeRepository;
    private final PantryItemRepository itemRepository;

    // @Transactional a belépési ponton is: a `recompute()` innen self-invocation, ami megkerüli a proxyt.
    @Override
    @Transactional
    public void run(String... args) {
        recompute();
    }

    /** No-arg, tranzakciós overload — az integrációs teszt belépési pontja. Visszaadja az újraírt receptek számát. */
    @Transactional
    public int recompute() {
        int changed = 0;
        for (RecipeEntity recipe : recipeRepository.findAll()) {
            List<LineFacts> facts = factsOf(recipe);
            Map<String, AllergenState> rolled = RecipeAllergenRollup.rollup(facts);
            Boolean lactoseFree = RecipeAllergenRollup.lactoseFree(facts);
            if (Objects.equals(rolled, recipe.getAllergens())
                && Objects.equals(lactoseFree, recipe.getLactoseFree())) {
                continue;
            }
            recipe.setAllergens(rolled);
            recipe.setLactoseFree(lactoseFree);
            recipeRepository.save(recipe);
            changed++;
        }
        if (changed > 0) {
            recipeRepository.flush(); // same reason as the catalog runner: readable before commit
            log.info("recipe: {} recept allergén-összegzése újraszámolva a feltöltött katalógusból "
                + "(mezo-r36n9.48)", changed);
        }
        return changed;
    }

    /**
     * A recept sorainak katalógus-tényei. Egy sor, amelynek a kamra-eleme eltűnt, kimarad — nem
     * „semmit nem tartalmaz", hanem egyszerűen nincs mit mondania, és a többi sor állítása áll.
     */
    private List<LineFacts> factsOf(RecipeEntity recipe) {
        List<UUID> itemIds = recipe.getLines().stream()
            .map(RecipeIngredientEntity::getPantryItemId)
            .filter(Objects::nonNull)
            .toList();
        List<LineFacts> facts = new ArrayList<>();
        for (PantryItemEntity item : itemRepository.findAllById(itemIds)) {
            PantryCatalogEntity c = item.getCatalog();
            if (c != null) {
                facts.add(new LineFacts(c.getAllergens(), c.isLactoseFree()));
            }
        }
        return facts;
    }
}
