---
cim: Receptek és receptműhely
szint: Funkció
terulet: Étel
allapot: Tervezve
hol: [iPhone app, Háttérrendszer, AI]
szulo: 00-attekintes
szakasz: [B4]
osszefoglalo: A saját receptjeid egy helyen, pontszámmal; az AI-val beszélgetve új receptet raksz össze a kamrádból, vagy behúzol egyet egy weboldalról.
---

## Mit csinál
A **Receptek** fülön:

- a saját receptjeid listája (név, kategória: reggeli / ebéd / vacsora / nasi, adagszám, elkészítési idő, kedvencnek jelölés);
- minden recept kap egy **sablon-értékelést**: mennyire illik a céljaidhoz, mire jó (például „edzés utánra”), és mit lehetne javítani;
- a **receptműhely**: beszélgetsz Boopal („legyen fehérjedúsabb, edzés előtti reggeli”), ő pedig minden körben visszaadja a
  teljes, frissített receptet — csak a kamrádban lévő alapanyagokból, nem kitalált tételekből;
- **új a Boopban:** recept behúzása egy weboldalról (link beillesztése → vázlat → jóváhagyás);
- egy recept előzményei: mikor etted.

## Hogyan működik
1. A recept hozzávalói a kamra tételeihez kötődnek, tápérték-pillanatképpel. Ha egy receptet rögzítesz étkezésként, a
   pontozás hozzávalónként számol, nem egyetlen „átlag-ételként”.
2. A sablon-értékelés számai szabályokból jönnek; a szöveget (összefoglaló, „mire jó”, javítások) az AI írja, lustán, az első
   megnyitáskor.
3. A receptműhely „állapot nélküli” beszélgetés: a telefon minden körben elküldi az eddigi beszélgetést és az aktuális vázlatot,
   az AI visszaadja a szöveget és a teljes új vázlatot. Egy ellenőrző kiszűri a hibás vagy nem létező tételeket. Mentés a szokásos
   recept-mentéssel történik.
4. Célirányok, amiket a műhely ismer: fehérjedús, edzés előtti, edzés utáni, lefekvés előtti, reggeli.
5. A weboldalas recept-behúzás **ma még nem létezik** (csak termék-behúzás van); a B4 építi meg, a termékoldal-behúzás mintájára.

## Miért így
- A receptkönyvtár ma kicsi; a műhely a természetes módja a bővítésnek, és a B6 étrendi tervhez („csak ezek a receptek”)
  is innen jön az alapanyag.
- Az AI nem találhat ki alapanyagot — csak a kamrából választhat, így a tápértékek mindig mért adatból jönnek.

## Beállítások
| Beállítás | Mit állít | Alapérték |
|---|---|---|
| `mezo.feature.recipe-workshop.enabled` | Be/ki kapcsolja a receptműhelyt (a receptek maradnak) | be |
| `mezo.recipe-workshop.max-lines` | Legfeljebb ennyi hozzávaló egy vázlatban | 30 |
| `mezo.recipe-workshop.max-steps` | Legfeljebb ennyi elkészítési lépés | 20 |
| `mezo.recipe-workshop.max-history-turns` | Ennyi korábbi kört lát az AI | 20 |
| `mezo.feature.recipe-ai-score.enabled` | Be/ki kapcsolja a recept szöveges értékelését (a szám marad) | be |

## Adattáblák
| Tábla | Mit tárol |
|---|---|
| `recipe` | A recept: név, kategória, adagszám, idők, címkék, kedvenc, szerep (edzés előtti/utáni), értékelés |
| `recipe_ingredient` | A recept hozzávalói, kamra-tételhez kötve, tápérték-pillanatképpel |

## Mi jön még
- B4: recept behúzása weboldalról; allergén-összesítés a receptre a hozzávalókból (lásd [Allergének](07-allergenek.md)).
- B6: „csak ezek a receptek N hétig” étrendi terv és bevásárlólista.

## Mi marad ki
Nincs.
