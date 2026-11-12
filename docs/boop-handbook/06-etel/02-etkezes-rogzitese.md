---
cim: Étkezés rögzítése fotóval, szóval, vonalkóddal
szint: Funkció
terulet: Étel
allapot: Tervezve
hol: [iPhone app, Háttérrendszer, AI]
szulo: 00-attekintes
szakasz: [B4]
osszefoglalo: Lefotózod a tányért vagy elmondod, mit ettél, Boop vázlatot készít a saját kamrádból és receptjeidből, te pedig egy koppintással jóváhagyod.
---

## Mit csinál
Egy étkezést hatféleképpen lehet majd felvenni, a „+” lapról vagy az Étel szoba Ma füléről:

1. **Fotó** — lefotózod a tányért.
2. **Szöveg vagy hang** — beírod vagy elmondod: „ebéd, csirke rizzsel és salátával”.
3. **Vonalkód** — beolvasod a csomagolt termék vonalkódját (új a Boopban).
4. **Recept** — kiválasztod egy saját receptedet, adagszámmal.
5. **Alapanyag** — kiválasztasz tételeket a kamrából, mennyiséggel.
6. **Szokásosak** — a saját előzményeidből rangsorolt, gyakran evett étkezések.

Fotónál és szövegnél Boop egy **vázlatot** mutat (tételek, mennyiségek, kalória, makrók, és egy jelzés, ha bizonytalan).
Átírhatod, törölhetsz vagy hozzáadhatsz tételt. **Jóváhagyás nélkül semmi nem mentődik.**

## Hogyan működik
1. A telefon elküldi a fotót és/vagy a szöveget a háttérrendszernek.
2. A háttérrendszer egyetlen AI-hívást indít egy olcsó modellel. Az AI megkapja a te kamrád és receptjeid listáját,
   és megpróbálja a felismert ételeket ezekhez kötni. Ahol talál egyezést, a tápértéket **az adatbázisból** veszi, nem az
   AI-tól; ahol nem, ott „becsült” tételt ír.
3. Egy szabályalapú ellenőrző kiszámolja, mennyire biztos a vázlat, és megjelöli, ha átnézést kér (például 0,6 alatti
   biztonságnál).
4. Jóváhagyás után az étkezés elmentődik: minden tétel tápértéke **befagyasztva** kerül el (ha később a termék adatai
   változnak, a régi étkezés nem változik), és azonnal megkapja a pontszámát (lásd [Étkezés értékelése](03-etkezes-ertekelese.md)).
5. A vonalkód a háttérrendszer már meglévő, de eddig használatlan OpenFoodFacts-keresőjét hívja (nyílt
   élelmiszer-adatbázis); a webes appban ennek nincs gombja, a Boop lesz az első, ami használja.
6. Az, hogy a vázlatot elfogadtad, átírtad vagy elvetetted, visszajelzésként mentődik — ebből látszik, mennyire jó az AI.

## Miért így
- A webes appban a rögzítések nagyobb része már AI-val (szöveg vagy fotó) történik, ezért ez a fő út.
- A számok az adatbázisból jönnek, az AI csak párosít és becsül — így egy elírt AI-válasz nem ronthat el egy mért értéket.
- A vonalkód „olcsó nyereség”: a háttér kész, csak a kamera-felület hiányzik (spec §3.1 „Új”).

## Beállítások
| Beállítás | Mit állít | Alapérték |
|---|---|---|
| `mezo.feature.meal-ai-log.enabled` | Be/ki kapcsolja az AI-vázlatot (fotó/szöveg) | be |
| `mezo.meal-ai-log.max-photo-bytes` | A feltölthető fotó legnagyobb mérete | 5 MB |
| `mezo.meal-ai-log.allowed-mime-types` | Elfogadott képformátumok | JPEG, PNG, WebP |
| `mezo.meal-ai-log.confidence-threshold` | Ez alatti biztonságnál a vázlat „átnézést kér” | 0,6 |
| `mezo.meal-ai-log.max-items` | Legfeljebb ennyi tétel egy vázlatban | 12 |
| `mezo.feature.pantry-import.enabled` | Be/ki kapcsolja az OpenFoodFacts (vonalkód) keresőt | be |
| `mezo.pantry-import.base-url` | Az OpenFoodFacts címe | world.openfoodfacts.org |
| `mezo.pantry-import.timeout-ms` | Meddig várunk az OpenFoodFacts válaszára | 5000 ms |

## Adattáblák
| Tábla | Mit tárol |
|---|---|
| `meal` | Az étkezés feje: időpont, nap, étkezési alkalom, eredet (kézi / AI-szöveg / AI-fotó), pontszám |
| `meal_item` | Az étkezés tételei (recept, kamra-tétel vagy becslés), befagyasztott tápértékkel |
| `ai_draft_outcome` | Mi lett az AI-vázlatokkal: elfogadva, átírva, elvetve |
| `pantry_catalog` | A termékek, amelyekhez az AI a felismert ételeket köti |

## Mi jön még
- B4: a fenti hat út natívan; a „szokásosak” rangsor a webes felületből a háttérrendszerbe költözik.
- Siri / App Intents („rögzítsd: ebéd…”) abban a szakaszban, amelyik először igényli (spec §3.1 „Az appon kívül”).

## Mi marad ki
Nincs.
