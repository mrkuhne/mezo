# Étkezés tényleges ideje naplózáskor — design

- **bd:** `mezo-yhhvg`
- **Date:** 2026-09-30
- **Domain:** Fuel, új étkezés naplózása
- **Status:** működés jóváhagyva a tulajdonossal; kattintható minta és megvalósítási terv készül

## 1. Cél és döntés

A később rögzített étkezés a tényleges evési idővel és az ahhoz tartozó napi ablakban jelenjen meg. A tulajdonos jóváhagyta, hogy az időpont megadása opcionális legyen, minden naplózási módban működjön, és az átírt idő automatikusan a tényleges idő szerinti ablakba sorolja az étkezést.

## 2. Felület és működés

- Az új étkezés megerősítő részében, közvetlenül a mentés előtt egy „Mikor ettél?” sor mutatja az alapértelmezett időt. Koppintásra nyílik az időválasztó; „Most” visszaállítja a mai nap alapidejét. Az időválasztás a Fotó, Kamra, Recept és Szokásosak utakból létrejött piszkozatnál ugyanaz a közös vezérlő.
- Ma a gyors mentés alapja a jelenlegi idő. Korábbi napon a megnyitott ablak javasolt ideje, ablak nélküli indulásnál az adott napszak eddigi alapideje marad. Az alapérték megjelenik; a használónak nem kell külön állítania.
- A kiválasztott nap + idő a bejegyzés tényleges időpontja. Az idő szerinti tervezett ablak neve a mező mellett frissül. Ha egyetlen ablak sem fedi az időt, az előnézet „Ablakon kívül” értéket mutat. A mentés ugyanide helyezi a bejegyzést; a megnyitó ablak nem írja felül a szándékosan átírt időt.
- Mai napon jövőbeli idő nem menthető; a mezőn rövid, érthető hiba jelenik meg. A legfeljebb hét napos visszamenőleges napválasztás változatlan. A már rögzített étkezés időpontja továbbra is javítható.
- Ha a mentés hibázik, a kiválasztott idő a piszkozatban marad az újrapróbáláshoz.

## 3. Adatút

Az étkezés API-ja már fogad időpontot, a szerver ezt tárolja és a pontozáshoz használja. A változás a közös naplózóban állítja elő a választott nap és helyi idő eltolással ellátott értékét. Az ablak hozzárendeléséhez a nap meglévő tervezett ablakaiból választ; a mentett ablak-kontekstuális adatoknak és a dátumnak ugyanazt a választást kell tükrözniük. Új szervermező vagy adatbázis-migráció nem indokolt, amennyiben a megvalósítási vizsgálat ezt megerősíti.

## 4. Előzmények és kódbázis

- **Korábbi példa:** a közös naplózó egy már mentett étkezés javításakor már mutat „Mikor ettél?” időmezőt. A korábbi napra pótlás már támogatott; az időt ma rejtett alapérték adja. A prototípus a négy bejáratot és a napi ablakokat már ábrázolja.
- **Érintett felület:** `FuelLogNewPage` a napot és a megnyitott ablakot adja tovább; `MealComposer` kezeli a közös megerősítést és az időponttal elküldött étkezést. A `buildDayPlan` a bejegyzéseket napszak és tárolt ablak alapján rendezi, ezért az átírt időnél az ablak-kontekstuális adatot is egyeztetni kell.
- **Minta:** `docs/design_2.0/prototypes/elo/fuel.html` meglévő `#log` és `#mai` útjai, új ikon nélkül.

## 5. Ellenőrzés

Példák: változatlan gyors mentés; reggel elfogyasztott, délután felvitt étel; másik ablakból indított és átírt idő; ablakon kívüli idő; korábbi nap; négy hozzáadási mód; jövőbeli mai idő; sikertelen mentés utáni újrapróbálás. A megvalósítás előtt a tulajdonos a kattintható mintát, majd az ellenőrizhető tervet jóváhagyja.
