# AI ételnaplózás: determinisztikus kamra-névpárosító — design

**Dátum:** 2026-09-01 · **Státusz:** jóváhagyott design · **bd:** mezo-qrks
**Hatókör:** backend (`feature/meal` AI-draft ág) + egy FE copy-módosítás. Kontraktus (`api/feature/meal/meal.yml`) **nem** változik.

## Probléma

Az AI ételnaplózás (`POST /api/meal/ai-draft`, mezo-78rn) a kamra-párosítást
kizárólag az LLM-re bízza: a kamra + recept katalógus a system promptba van
fűzve (`MealAiDraftService.buildSystemPrompt`), és ugyanaz az egy olcsó-tier
hívás végzi a felismerést és a párosítást is. A backend utána már csak az
id-t oldja fel (`mapLine`) — determinisztikus háló nincs alatta.

Következmény: ha a modell nem köti össze a felismert ételt a kamra-tétellel
(pl. „rizs" vs. a kamrában lévő „Basmati rizs"), a sor azonnal becslés lesz,
LLM-tippelte makrókkal, és semmi nem javítja ki. Fotós logolásnál ez
gyakoribb, mert a modellnek egyszerre kell felismernie és párosítania.

## Vezérelv

**A téves párosítás rosszabb, mint a becslés.** Egy hibás kamra-találat
csendben rossz makrókat ír a naplóba; egy elszalasztott találat csak
kényelmetlen. Ezért minden döntési ponton a szigorúbb változat nyer, és
minden determinisztikus találat felül van vizsgálatra jelölve.

## Végállapot

### Sorrend

```
LLM-találat (pantryItemId / recipeId)  → kamra- vagy recept-sor      [ma is]
    ↓ nincs / hallucinált id
determinisztikus névpárosítás          → kamra-sor, needsReview=true [ÚJ]
    ↓ nincs találat
becslés                                 → LLM-makrók                 [ma is]
```

A **lefokozott** sorok (az LLM hallucinált id-t adott, a sor nem létezik a
DB-ben) is átmennek a párosítón, mielőtt becslés lennének. Ott a
`needsReview = true` a mai szabály szerint amúgy is kényszerített.

### `PantryNameIndex` (új)

Spring-mentes, tisztán tesztelhető osztály a
`backend/src/main/java/io/mrkuhne/mezo/feature/meal/service/`-ben. Egy
`List<PantryItemEntity>`-ből épül, és egyetlen műveletet kínál:

```java
Optional<PantryItemEntity> match(String name, String unit)
```

**Normalizálás** (mind az indexkulcsokra, mind a lekérdezett névre):
kisbetűsítés · NFD + `\p{M}` levágás (ékezet) · írásjelek szóközzé ·
szóközök összevonása · trim.

**Indexkulcsok** kamra-tételenként:

1. a normalizált `name`
2. a normalizált `brand + " " + name` (ha van márka)
3. a **kiszerelés nélküli** név — csak akkor, ha a név mértékegységgel
   lezárt számmal végződik: `\d+([.,]\d+)?\s*(g|dkg|kg|ml|cl|dl|l|db)$`.
   Így a `Zabpehely 500 g` → `zabpehely` is bekerül, de a `Tej 1,5%`
   **nem** csonkolódik (`%`-ra végződik), tehát az 1,5%-os és a 2,8%-os
   tej nem mosódik össze.

**Egyezés:** a keresett normalizált név *pontosan egyenlő* egy indexkulccsal.
Nincs részszöveg-keresés, nincs hasonlósági küszöb, nincs tokenhalmaz.

**Kétértelműség kizár:** ha egy kulcs két *különböző* kamra-tételre mutatna,
az a kulcs kiesik az indexből. (`Tej 1 l` és `Tej 2 l` mindkettő „tej" →
egyik sem nyer; a teljes nevükkel viszont továbbra is párosíthatók.)

**Egység-kapu:** a találat csak akkor él, ha a keresett egység megegyezik a
kamra-tétel alap-egységével (`servingUnit`, null esetén `g`), egy szűk
szinonima-normalizálás után:

| kanonikus | elfogadott alakok |
|---|---|
| `g` | `g`, `gramm`, `gr` |
| `ml` | `ml`, `milliliter` |
| `db` | `db`, `darab`, `piece` |

Ami nincs a táblában, az önmagára normalizálódik (kisbetűsítve, trimelve) —
így az `adag`, `dl`, `szelet` is összehasonlítható marad. Eltérő egység →
nincs párosítás, a sor becslés marad. Mivel az egységek megegyeznek, a
becslés mennyisége változtatás nélkül átvihető a kamra-sorba.

### `MealAiDraftService` változásai

- A kamra-lista **egyszer** kerül lekérdezésre a `draft()` elején
  (`findByCreatedByAndDeletedFalseOrderByNameAsc`), és ugyanaz szolgálja ki
  a system prompt katalógusát, az id-feloldást (`Map<UUID, PantryItemEntity>`)
  és a `PantryNameIndex`-et. Ez kiváltja a mai per-sor
  `findByIdAndCreatedByAndDeletedFalse` hívásokat is; a tulajdonlás-ellenőrzés
  változatlanul él, mert a lista eleve `createdBy` + `deleted=false` szűrt.
  A recept-ág lekérdezései változatlanok.
- `mapLine` a becslés-ág előtt megkérdezi az indexet a
  `line.name()` + `line.unit()` párossal.
- Találat esetén a sor a **meglévő** `pantryItem(p, line)` úton épül fel
  (makrók, `per`, `basisUnit`, `nova` a DB sorból), két eltéréssel:
  `needsReview = true`, a `confidence` viszont marad `BigDecimal.ONE` — a
  makrók a DB-ből pontosak, a bizonytalanság az azonosításban van, azt a
  `needsReview` hordozza. Ehhez a `pantryItem` privát metódus kap egy
  `boolean needsReview` paramétert (az LLM-ág `false`-t ad).
- Naplózás: `log.info` szinten egy sor a determinisztikus találatról
  (keresett név → kamra-tétel id), hogy az llm-usage naplók mellett ez is
  visszakövethető legyen.

### Frontend

**1. A forrás-címke igazat mond (a valódi tünet).** Ma
[`MealComposer.tsx:86`](../../../frontend/src/features/fuel/components/MealComposer.tsx)
minden AI-ból származó sort `becslés`-nek címkéz, akkor is, ha valódi
kamra-találat DB-makrókkal:

```ts
const tag = l.fromAi ? 'becslés' : l.source === 'recipe' ? 'recept' : 'kamra'
```

Ez szándékos egyszerűsítés volt (design 2.0 iterations §7), de a felhasználó
számára letagadja a működő párosítást — nagy eséllyel ez az eredeti panasz
oka. Az új szabály a `source`-ból származzon:

| sor | címke |
|---|---|
| AI, `pantry` | `kamra ✨` |
| AI, `recipe` | `recept ✨` |
| AI, `estimate` | `becslés` |
| kézi | `kamra` / `recept` (változatlan) |

A `logflow-lntag` stílusa a `data-tag` attribútumra épül
(`prototype.css:6742–6743`: `[data-tag="kamra"]`, `[data-tag="becslés"]`),
ezért a `✨` **nem** kerülhet a `data-tag`-be. A `lineMeta` két mezőt ad
vissza: `tag` (szemantikus, `data-tag`-be és a CSS-nek) és `tagLabel`
(megjelenített szöveg, a `✨`-gal). A JSX a `data-tag={meta.tag}` mellett
`{meta.tagLabel}`-t renderel.

A `LogFlowPage.test.tsx` mai asszerciója (két AI-sorból mindkettő
`becslés`) ezzel együtt frissül: a mock-draft kamra-sora `kamra ✨` lesz.

**2. A review-üzenet copy-ja.** A mai szöveg

> ✨ Az AI nem teljesen biztos ebben a sorban — nézd át a mennyiséget.

kamra-soron félrevezető: ott a *tétel azonossága* a kérdés. A szöveg a sor
`source`-ából származzon:

- `estimate` → változatlan mai szöveg
- `pantry` / `recipe` → „✨ Ezt a kamrádból párosítottuk név alapján —
  ellenőrizd, hogy tényleg ez a tétel."

Kontraktus-változás nincs: ma egy kamra-sor `needsReview=true`-val csak az
új párosítóból származhat (a hallucinált id-s sorok becsléssé fokozódnak le).

## Hibakezelés

- Üres vagy csak szóközből álló `name` → nincs párosítás (a becslés-ág mai
  `name`-ellenőrzése változatlanul eldobja a makró nélküli sorokat).
- Üres kamra → üres index, minden hívás `Optional.empty()`.
- Az index felépítése tiszta memóriaművelet, nem dobhat: a normalizálás
  minden bemenetre definiált, a null `brand` / `servingUnit` kezelt.

## Tesztelés

**Unit (`PantryNameIndexTest`, Spring nélkül):**

- normalizálás: kisbetű, ékezet (`Zabpehely` ↔ `zabpehely`, `Túró` ↔ `turo`),
  írásjel, többes szóköz
- márka-kulcs: `Rizspont Basmati rizs` megtalálja a `Basmati rizs` tételt
- kiszerelés-csonkolás: `Zabpehely 500 g` tétel megtalálható `zabpehely`-ként
- **nem** csonkol: `Tej 1,5%` marad teljes; `tej` nem találja meg
- kétértelműség: két „tej"-re csonkoló tétel → `tej` nem ad találatot, de a
  teljes nevük igen
- egység-kapu: egyező egység → találat; `db` vs. `g` → üres; szinonimák
  (`gramm` ↔ `g`) → találat
- üres index / üres név → üres

**Integráció (`MealAiDraftServiceIT`, a meglévő fake LLM-mel):**

- a fake válasz `pantryItemId: null`, de a `name` egy kamra-tétel neve és az
  egység egyezik → a draft sora `source=pantry`, a makrók a DB sorból, a
  `pantryItemId` ki van töltve, `needsReview=true`
- ütköző egységnél (`db` vs. `g`) a sor `source=estimate` marad, LLM-makrókkal
- hallucinált `pantryItemId` + egyező név → a lefokozott sor is
  kamra-sorrá párosul, `needsReview=true`

**FE:** a `LogFlowPage.test.tsx` mai vegyes-forrás tesztje frissül — a
mock-draft kamra-sora `kamra ✨`, a becslés-sora `becslés`, a kézi sor
`kamra`. Új asszerció egy kamra-forrású, `needsReview=true` sorra az
azonosság-szövegre.

## Hatókörön kívül

- **Receptek névpárosítása.** A kérés a kamráról szólt, és a recept-sorok
  `adag` alap-egysége miatt az egység-kapu szinte mindig zárna.
- Hasonlósági (trigram / Levenshtein) párosítás. Ha a szigorú egyezés
  kevésnek bizonyul, az egy külön, mérésre alapozott slice.
- Új konfigurációs kapcsoló. A viselkedés nem kapcsolható; a párosító
  szigorúsága kódban rögzített.
