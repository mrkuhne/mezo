package io.mrkuhne.mezo.feature.meal;

import io.mrkuhne.mezo.feature.meal.repository.MealItemRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Egyszeri adatjavítás (mezo-1f7b): a MÁR LOGOLT étkezések pantry-soraiba visszatölti a telített
 * zsír pillanatképét, most, hogy a katalógusban végre van ilyen adat.
 *
 * <p>A mezo-m6uv migráció mind a négy tápanyag-tényt befagyasztotta a pantry sorból — csakhogy a
 * katalógus 147 sorából 2-ben volt {@code saturated_fat_g} (rostból 144-ben), így ez az oszlop
 * gyakorlatilag mindenhol NULL maradt. Amíg a három tény EGY közös lefedettség-boolean mögött ült,
 * ez nem tűnt fel: a hiányzó telített zsír 0 g-ként összegződött, és a Zsírminőség 100 pontot
 * adott. A per-tény lefedettség ezt őszinte „nincs adat"-tá tette — ami viszont a MÚLTBELI
 * étkezéseken örökre az is maradna, mert a pontszám a fagyasztott pillanatképet olvassa, nem a
 * katalógust. Ez a runner tölti fel azt a pillanatképet.
 *
 * <p><b>Miért szabad hozzányúlni egy „fagyasztott" oszlophoz:</b> a fagyasztás szándéka
 * (ADR 0026) az, hogy egy MEGVÁLTOZOTT forrás ne írhassa át visszamenőleg egy étkezés pontszámát.
 * Itt nem erről van szó — az oszlop NULL-ja azt jelentette, „ezt sosem tudtuk", nem azt, hogy „a
 * forrás nullát mondott". Ugyanezt az „őszinte közelítés" döntést hozta meg a m6uv migráció is a
 * másik három tényre. Az {@code IS NULL} őr miatt a művelet idempotens, és soha nem ír felül egy
 * azóta beolvasott VALÓDI címkeértéket (OFF/scrape/foto import).
 *
 * <p>{@code @Order(205)}: a {@code PantryCatalogLoader} (50) UTÁN fut — különben még nem lenne mit
 * másolni —, és a {@link MealRescoreRunner} (210) ELŐTT, amely a
 * {@code FORMULA_VERSION} bump miatt úgyis újrapontoz minden envelope-ot, immár a feltöltött
 * pillanatképekkel. A sorrend a lényeg: fordítva egy teljes deploy-ciklussal késne a gyógyulás.
 * {@code @Profile("demodata")} — a prodban aktív profil (ugyanaz az őr, mint a testvérrunneren:
 * idegen IT-fixture-öket ne írjon át).
 */
@Slf4j
@Component
@Profile("demodata")
@Order(205)
@RequiredArgsConstructor
public class MealSaturatedFatBackfillRunner implements CommandLineRunner {

    private final MealItemRepository mealItemRepository;

    // @Transactional a BELÉPÉSI ponton is (a PantryCatalogLoader mintája): a `backfill()` innen
    // self-invocation, ami megkerüli a proxyt — a @Modifying query enélkül indulásnál
    // „No active transaction for update or delete query"-vel dobja el az egész kontextust.
    @Override
    @Transactional
    public void run(String... args) {
        backfill();
    }

    /** No-arg, transactional overload — az integrációs teszt belépési pontja. */
    @Transactional
    public int backfill() {
        int healed = mealItemRepository.backfillPantrySaturatedFat();
        if (healed > 0) {
            log.info("meal_item: {} pantry-sor kapott telítettzsír-pillanatképet a katalógusból "
                + "(mezo-1f7b); a MealRescoreRunner ezután pontoz újra", healed);
        }
        return healed;
    }
}
