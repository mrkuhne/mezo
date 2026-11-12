---
cim: Kamra és termék-behúzás
szint: Funkció
terulet: Étel
allapot: Tervezve
hol: [iPhone app, Háttérrendszer, AI]
szulo: 00-attekintes
szakasz: [B4]
osszefoglalo: Az alapanyagaid és termékeid listája; újat egy termékoldal linkjéből, a címke lefotózásából vagy a vonalkódból veszel fel.
---

## Mit csinál
A **Kamra** fülön a saját alapanyagaid és termékeid vannak (név, márka, kategória, adag, tápérték 100 grammra).
Új tételt négyféleképpen veszel fel:

1. **Katalógusból** — a közös termékkatalógusban keresel, és hozzáadod a sajátodhoz.
2. **Termékoldal linkjéből** — beilleszted egy webshop termékoldalának címét, Boop kiolvassa a tápértéket.
3. **Címkefotóból** — lefotózod a tápérték-táblázatot (és ha kell, az elejét).
4. **Vonalkódból** — új a Boopban, az OpenFoodFacts nyílt adatbázisból.

Mindhárom automatikus útnál vázlat jön, biztonsági jelzéssel; jóváhagyás után kerül a kamrába.

## Hogyan működik
1. **Két réteg:** van egy közös katalógus (a beépített alap-termékek és a saját behúzásaid) és a saját kamrád.
2. **Link-behúzás:** a háttérrendszer letölti az oldalt (csak nyilvános címekről, átirányítás nélkül, méretkorláttal — ez véd
   attól, hogy valaki belső rendszerekre irányítsa), kivonatolja a tápérték-részt, majd az AI kiolvassa: 100 g/ml-re vetítve,
   „soha ne találj ki adatot”, becsült feldolgozottsági osztállyal. Egy ellenőrző megnézi, hogy a kalória összhangban van-e a
   makrókkal, és ebből számol biztonságot. Ismert boltoknál (például kifli, tesco, auchan) a forrás nevét is eltárolja.
3. **Címkefotó:** ugyanez, fotóból.
4. **Vonalkód:** 8 vagy több számjegy esetén vonalkódként, egyébként szövegként keres az OpenFoodFacts-ban. A háttér kész, csak
   a webes appban nem volt gombja.
5. Minden behúzás naplózódik.

## Miért így
- A tulajdonos termékeinek egy része már így, weboldalról került be; ez az út bevált.
- A vonalkód a leggyorsabb csomagolt termékeknél, és a háttér már megvan (spec §3.1 „Új”).

## Beállítások
| Beállítás | Mit állít | Alapérték |
|---|---|---|
| `mezo.feature.pantry-scrape.enabled` | Be/ki kapcsolja a link-behúzást | be |
| `mezo.pantry-scrape.timeout-ms` | Meddig várunk a termékoldalra | 8000 ms |
| `mezo.pantry-scrape.max-body-bytes` | Legfeljebb ekkora oldalt tölt le | 2 MB |
| `mezo.pantry-scrape.confidence-threshold` | Ez alatt „átnézést kér” | 0,6 |
| `mezo.pantry-scrape.allow-private-hosts` | Belső hálózati címek engedése (biztonsági kapcsoló) | ki |
| `mezo.feature.pantry-photo.enabled` | Be/ki kapcsolja a címkefotós behúzást | be |
| `mezo.pantry-photo.max-photo-bytes` | Legnagyobb fotóméret | 5 MB |
| `mezo.feature.pantry-import.enabled` | Be/ki kapcsolja az OpenFoodFacts (vonalkód) keresést | be |
| `mezo.pantry-import.search-page-size` | Legfeljebb ennyi találat egy keresésre | 8 |

## Adattáblák
| Tábla | Mit tárol |
|---|---|
| `pantry_catalog` | Közös termékkatalógus: fajta (étel / kiegészítő / stimuláns / gyógyszer), név, márka, forrás, kategória, adag, tápérték, NOVA |
| `pantry_item` | A saját kamrád tételei |
| `pantry_import` | A behúzások naplója |
| `pantry_item_definition_archive` | Archivált tétel-definíciók (régi változatok megőrzése) |

## Mi jön még
B4: allergén-jelölés a termékeken; az OpenFoodFacts allergén-adatai és az AI-behúzások is ezt töltik (lásd [Allergének](07-allergenek.md)).

## Mi marad ki
Kamra árak, készlet, lejárat és az „olcsóbb alternatíva” javaslatok — lásd [Ami kimarad](10-ami-kimarad.md).
