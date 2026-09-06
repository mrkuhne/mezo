package io.mrkuhne.mezo.feature.pantry;

import io.mrkuhne.mezo.feature.pantry.repository.PantryCatalogRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Egyszeri adatjavítás (mezo-mxmh S3): a katalógus hiányzó telítettzsír-értékeit MÁSOLJA oda,
 * ahol az érték már létezik egy makró-azonos testvérsoron — nem becsli.
 *
 * <p>A seed-javítás (mezo-1f7b) a 147 master sort érte el, az élő katalógus viszont 413 soros: a
 * maradék a felhasználó saját felvitele, és abból 134-ben volt zsír telített zsír nélkül. A
 * mintázat kiderült: ugyanaz a katalógus szerepel kétszer, angol (seed) és magyar (saját) néven,
 * bájtra azonos makrókkal — „Olívaolaj"/„Olive oil", „Kacsazsír"/„Duck fat". 134-ből 121-nek van
 * ilyen ikre, és egynek sincs ütköző ikre, tehát az értéket át lehet VINNI ahelyett, hogy újra
 * modelleznénk. Egy átvitt érték szigorúan jobb egy újrabecsültnél: ugyanaz a szám marad a két
 * soron, tehát ugyanaz az étel nem kaphat két különböző pontszámot attól függően, melyik
 * néven logolták.
 *
 * <p>A biztonság a lekérdezésben van: egy makró-aláírás, amiről két sor MÁST mond, teljesen
 * kimarad — nem „az egyiket választjuk". A zsírmentes sorok nullája külön lépés, mert az nem
 * becslés, hanem számtan.
 *
 * <p><b>Ami szándékosan marad {@code null}:</b> 13 nyers zöldség/gyümölcs sor (cukkini, jégsaláta,
 * spárga…) 0,07–0,46 g összzsírral, aminek a forrása maga sem hordozott telítettzsír-adatot. Ott
 * egy „kicsi szám" kitalálása pontosan az a fabrikálás lenne, amit ez az egész munka kiszedett —
 * és 0,4 g zsíron a különbség a pontszámban nem is látszik.
 *
 * <p>{@code @Order(51)}: a {@link PantryCatalogLoader} (50) UTÁN — előtte nem lenne mit másolni —,
 * és jóval a {@code MealSaturatedFatBackfillRunner} (205) ELŐTT, amely az így feltöltött katalógusból
 * gyógyítja a már logolt étkezések pillanatképeit, majd a {@code MealRescoreRunner} (210)
 * újrapontoz. Egy indulás, teljes lánc.
 */
@Slf4j
@Component
@Profile("demodata")
@Order(51)
@RequiredArgsConstructor
public class PantryTwinSaturatedFatRunner implements CommandLineRunner {

    private final PantryCatalogRepository repository;

    // @Transactional a belépési ponton is: a `backfill()` innen self-invocation, ami megkerüli a
    // proxyt, és a @Modifying query enélkül indulásnál dobja el a kontextust (mezo-1f7b tanulsága).
    @Override
    @Transactional
    public void run(String... args) {
        backfill();
    }

    /** No-arg, tranzakciós overload — az integrációs teszt belépési pontja. */
    @Transactional
    public int backfill() {
        int fromTwin = repository.backfillSaturatedFatFromMacroTwin();
        int zeroFat = repository.backfillZeroSaturatedFatOnFatFreeRows();
        if (fromTwin > 0 || zeroFat > 0) {
            log.info("pantry catalog: {} sor kapott telített zsírt makró-azonos ikertől, {} zsírmentes "
                + "sor kapott 0-t (mezo-mxmh)", fromTwin, zeroFat);
        }
        return fromTwin + zeroFat;
    }
}
