---
cim: Napi keret, víz és heti kép
szint: Funkció
terulet: Étel
allapot: Tervezve
hol: [iPhone app, Háttérrendszer]
szulo: 00-attekintes
szakasz: [B4]
osszefoglalo: A Ma fül megmutatja, mennyi fér még bele a napba és mit egyél legközelebb; a Hét fül a hét napjait a célokhoz méri.
---

## Mit csinál
- **Napi keret:** a mai kalória-, fehérje-, szénhidrát- és zsírcél, mellette az eddig elfogyasztott, és hogy mennyi maradt.
- **„Következő étkezés” tipp:** a maradék keretből Boop konkrét javaslatot ad (például: „vacsorára egy fehérjedús tál fér
  bele, kb. 600 kcal”), lehetőleg a saját receptjeidből.
- **Víz:** egy koppintással rögzítesz egy pohár vizet, látod a napi vízcélt.
- **Hét fül:** a hét napjai a célhoz mérve — melyik nap volt a keretben, melyik alatta vagy felette.
- **Étrendi beállítások:** makróarány (kiegyensúlyozott, zsírszegény, szénhidrátszegény, szénhidrátdús vagy egyéni),
  fehérjeszint (alacsony / közepes / magas), napi víz- és rostcél.

## Hogyan működik
1. **A cél a súlycélból jön.** Az aktív súlycél (lásd a Terv részt) heti szakaszokra bontja a tervet. Egy adott napra a
   háttérrendszer így számol: alap energiaigény (a megtanult érték, vagy ha az még nincs, nyugalmi anyagcsere × életmód-szorzó)
   **+ a már rögzített edzések** energiája **± a cél szerinti napi többlet vagy hiány**. Soha nem megy a nyugalmi
   anyagcsere alá. Több edzés → több megengedett étel.
2. A fehérje a szakaszból jön (testsúly-kilogrammonként, a választott fehérjeszint szerint), a zsír a választott arányból,
   a szénhidrát kapja a maradékot.
3. Ha nincs aktív cél, egy rögzített tartalék napi cél érvényes.
4. Kímélő módban (betegség, utazás) a cél enyhül vagy eltűnik — lásd [Kihagyás és kímélő mód](08-kihagyas-kimelo.md).
5. **Új a B4-ben:** a napi étkezési terv (idősávok az ébredés, lefekvés és az edzések köré, kerettel sávonként, recept-javaslattal)
   ma csak a webes felület kódjában él. A Boophoz ez a háttérrendszerbe költözik, és onnan jön a „következő étkezés” tipp is.
6. Az étrendi beállítások mentése újraszámolja az aktív célt; mentés előtt élő előnézet mutatja az új számokat.

## Miért így
- „Egy kiszolgált cél” szabály: a hős-szám, a pontozás, az AI és a Boop összefoglaló ugyanazt a napi célt látja.
- A „következő étkezés” logikának a szerveren a helye, mert a későbbi élő javaslatok (B7) is erre épülnek (kutatás 02 §5).

## Beállítások
| Beállítás | Mit állít | Alapérték |
|---|---|---|
| `mezo.nutrition.*` | Tartalék napi kalória- és makrócél, ha nincs aktív súlycél | konfigurációban rögzített |
| `mezo.feature.diet-settings.enabled` | Be/ki kapcsolja az étrendi beállításokat | be |
| `mezo.diet-settings.default-split-preset` | Alapértelmezett makróarány | kiegyensúlyozott |
| `mezo.diet-settings.default-protein-tier` | Alapértelmezett fehérjeszint (1,6 / 2,0 / 2,2 g/testsúly-kg) | közepes |
| `mezo.diet-settings.default-water-ml` | Alapértelmezett napi vízcél | 4000 ml |
| `mezo.diet-settings.default-fiber-g` | Alapértelmezett napi rostcél | 30 g |
| `mezo.goal.diet.fat-share-*` | Zsír aránya az energiából a választott makróarány szerint | 0,20–0,40 |
| `mezo.goal.diet.fat-floor-g-per-kg` | Zsír alsó határa testsúly-kg-onként | 0,5 g |
| `mezo.feature.fuel-settings.enabled` | Be/ki kapcsolja az étkezési beállításokat | be |
| `mezo.fuel-settings.default-meals-per-day` | Alapértelmezett napi étkezésszám | 4 |
| `mezo.fuel-settings.default-caffeine-cutoff` | Eddig az időpontig javasolt koffein | 14:00 |

## Adattáblák
| Tábla | Mit tárol |
|---|---|
| `diet_settings` | Felhasználónként egy sor: makróarány, fehérjeszint, víz- és rostcél |
| `fuel_settings` | Napi étkezésszám, koffein-határidő |
| `water_log` | Vízfogyasztás bejegyzései |
| `goal` | Az aktív súlycél és heti szakaszai, ebből jön a napi cél |
| `meal` | Az elfogyasztott étkezések, ebből jön az „eddig” |

## Mi jön még
- B4: szerveroldali napi keret és „következő étkezés” tipp.
- B7: élő javaslatkártyák („Egyél ma +300 kalóriát — hosszabb lesz az edzés”), mindig jóváhagyással.

## Mi marad ki
Az étkezési idősáv-sablon szerkesztő nem kerül át — lásd [Ami kimarad](10-ami-kimarad.md).
