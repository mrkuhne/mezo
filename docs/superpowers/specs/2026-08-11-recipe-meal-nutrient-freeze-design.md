# Recept + étkezés tápérték-fagyasztás és megjelenítés — design spec

- **Dátum:** 2026-08-11
- **Driving bd:** `mezo-m6uv`
- **Kiváltó bejelentés (user, 4 Fuel-hiba):** (1) telített zsírsav / cukor / rost / só nem látszik a receptnél; (2) a listás recept-kártya az egész recept értékeit mutatja, nem az adagot; (3) recept logolásánál legyen szerkeszthető a hozzávaló-mennyiség; (4) webes/fotós importnál a visszaigazolásban csak a 3 alap makró látszik, pedig a telített/cukor/só is elmentődik.
- **Előzmény:** `mezo-bka` (OFF-import), `mezo-8vum` (Link-scrape), `mezo-d8tr` (fotó-extract) hozta be a négy tápértéket a `pantry_item`-re; `mezo-lns` a recept-aggregátumot a fagyott makró-snapshotokkal; `mezo-ormb` a log-time hozzávaló-override-okat; `mezo-7797` a WHO/zsírminőség scoring-dimenziókat, amelyek ezt a négy tényt **ma élő kamra-sorból** olvassák.
- **Döntés a brainstormból:** a négy tápérték **sorra fagyasztva**, a scoring pipeline is a fagyott értéket olvassa — egy igazságforrás (a „A · fagyasztás mindenhol" opció). A (3)-as pont tudatosan **kimaradt** ebből a körből → `mezo-og03`.

## 1. Cél és a hiba természete

A négy tápérték (`fiberG`, `sugarG`, `saltG`, `saturatedFatG`) a **kamra-tételen már létezik** — tárolva, szerkeszthető, meg is jelenik a `KamraItemDetailPage`-en. Ami hiányzik:

1. **A recept-kontraktus nem hordozza.** `RecipeMacros` / `RecipeContribution` csak `kcal/p/c/f`, és a `recipe_ingredient` is csak ezt a négy makrót fagyasztja le. A recept-oldalon tehát nincs mit kirajzolni.
2. **A számok mégis léteznek — csak a pontszám-szekcióba temetve.** A `RecipeService.fitLines` (`backend/.../recipe/service/RecipeService.java:105`) adagra vetítve kiszámolja mind a négyet, de **élő** kamra-sorból, és csak a breakdown-envelope-on keresztül látszik: Rost a mikro-dimenzióban, Cukor/Só a WHO-ban, telített a zsírminőségben. Ez pontszám-nyelv (`6 g / 8 g keret`), nem tápérték-kijelzés, és a breakdown hiányában (kcal nélküli recept, LLM/flag off) egyáltalán nem látszik.
3. **Az importnál az adat a draftban van, csak nem rajzoljuk ki** (`ImportItemSheet.tsx:444` és `:510` — négy `StatCell`, pedig a `PantryLookupItem`/`PantryScrapeDraft` mind a négy tápértéket hordozza).
4. **A listás recept-kártya egész-recept bázison mutat** (`RecipeCard.tsx:60`), miközben a recept-detail hero és az editor összesítője is `/adag` defaulttal megy.

A cél tehát kettős: **egy igazságforrást** csinálni a négy tápértékből (fagyasztás + a scoring átállítása), és **kirajzolni** ott, ahol a user kereste.

## 2. Adatmodell — a négy tápérték lefagyasztása

Két új oszlopcsoport, minden oszlop **nullable**: a „nincs adat" nem „0 g". Az OFF-találatok és a scrape-ek jó része nem hoz rostot, és egy hamis 0 a scoringban is hazugság (a mai `hasFacts` logika pont ezért létezik).

| tábla | új oszlopok | tartalom |
|---|---|---|
| `recipe_ingredient` | `snapshot_fiber_g`, `snapshot_sugar_g`, `snapshot_salt_g`, `snapshot_saturated_fat_g` (`numeric`, nullable) | a `pantry_item` per-basis értéke a recept mentésének pillanatában — ugyanott képződik, ahol a `snapshot_kcal` (`RecipeService.java:213` környéke) |
| `meal_item` | ugyanaz a négy oszlop | **recept-ág:** az egész-recept rollup ÷ adagszám (pontosan úgy, ahogy a makró-snapshot is: basis `adag`, `snapshot_per = 1`). **Kamra-ág:** a live `PantryItem` per-basis értéke (mint a `recipe_ingredient`-nél). |

**Migrációk** (`liquibase_conventions.md`, 12 jegyű UTC prefix + driving bd id):

- `202608111200_mezo-m6uv_recipe_ingredient_nutrient_snapshot.sql`
- `202608111210_mezo-m6uv_meal_item_nutrient_snapshot.sql`

Mindkettő `ADD COLUMN` + **best-effort backfill** a mai forrásokból:

- `recipe_ingredient` ← `pantry_item` a `pantry_item_id`-n keresztül (a per-basis érték változatlanul kerül át — ez ugyanaz a bázis, amit a `snapshot_per` jelent);
- `meal_item` kamra-ág ← `pantry_item` a `pantry_item_id`-n keresztül;
- `meal_item` recept-ág ← a recept `recipe_ingredient` (már backfillelt) sorainak összege ÷ `recipe.servings`, a sor `snapshot_per`-jével skálázva — azaz ugyanaz a képlet, amit a Java-oldal is futtat.

Ahol a forrás már törölt vagy fact-less: **NULL marad**. A backfill őszinte közelítés, nem történelmi rekonstrukció — a driftelt kamra-sorokra a *mai* értéket írja be, és ezt a spec + az ADR kimondja.

**Kerekítés:** a grammok **1 tizedesre**, HALF_UP. A makrók 0-tizedes szabálya (`RecipeMapper.scaled`) itt használhatatlan: a só tipikusan 0,4–1,8 g, egész számra kerekítve az információ nagy része elvész. A kcal/P/C/F kerekítése **változatlan** marad.

**Null-propagáció:** egy sor hiányzó értéke `null` és **nem** nulla; a rollup akkor és csak akkor `null`, ha minden sor `null` az adott mezőre, különben a meglévő sorok összege. Ez „részleges összeg" — vállalt, mert a hozzávaló-soronkénti kijelzés (§5) `—`-t ír a hiányzó sorokra, tehát a felület önmagát magyarázza.

## 3. Kontraktus

A `macros` objektumhoz **nem** nyúlunk: más a kerekítési szabálya, és minden fogyasztója (FE + backend) törne. Helyette sibling objektum, `nutrients` néven, minden mezője nullable `number`:

```yaml
# api/feature/recipe/recipe.yml
RecipeNutrients:
  type: object
  properties:
    fiberG:        { type: number, nullable: true }
    sugarG:        { type: number, nullable: true }
    saltG:         { type: number, nullable: true }
    saturatedFatG: { type: number, nullable: true }
```

- `recipe.yml`: `nutrients` a **`RecipeResponse`**-on (egész-recept rollup) **és** a **`RecipeIngredientResponse`**-on (soronkénti hozzájárulás a sor saját amountján).
- `meal.yml`: ugyanez a séma `Nutrients` néven → `nutrients` a **`MealResponse`**-on (étkezés-rollup) és a **`MealItemResponse`**-on (sor-hozzájárulás).

Mindkét mező **nem `required`** (a séma-objektum maga jelen van, a mezői lehetnek null-ok) — így egy régi kliens sem törik, és a `nutrients` teljes elhagyása is legális marad, ha a rollup minden mezője null.

Kontraktus-sorrend (`api_contract_conventions.md`): **először** a fragment-YAML, `cd api/generate && npm run generate:api`, aztán a backend implementáció és `cd frontend && pnpm generate:api`.

## 4. Backend — egy igazságforrás

### 4.1 Snapshot-képzés

- `RecipeService.snapshotFrom` (`:200`–`:219`): a négy új mező felvétele a live `PantryItemEntity`-ből, **`orDefault` NÉLKÜL** — a null null marad.
- `MealService` recept-ág (`:308` környéki `applyItem`): a négy érték az egész-recept rollupból ÷ `servings`, az override-okkal együtt (ugyanaz az út, amin a makró-snapshot is megy). Kamra-ág: a live `PantryItem` per-basis értéke.

### 4.2 Mapper — rollup és kontribúció

`RecipeMapper`-ben a négy tápérték a makrók mellé kerül, de **külön kerekítéssel** (`scaled1`, scale 1) és null-őrző összegzéssel:

- `contributionWithAmount` → `RecipeNutrients` is (a `factor` ugyanaz: `amount / snapshotPer`);
- `rollup(lines)` és `rollupWithOverrides(entity, overrides)` → a négy mező null-őrző Σ-ja.

Az **üres override-map identitása** (`rollupWithOverrides({}) == rollup`) továbbra is a regressziós őr — most nyolc mezőre.

### 4.3 A scoring átállítása fagyott értékre

Ez a lényeg, ezért választottuk az „A" opciót:

- **`RecipeService.fitLines` (`:105`):** a négy tény a **sor fagyott snapshotjából** jön, nem a `pantryById` élő sorból. `hasFacts` = a négy snapshot közül bármelyik nem null. Bónusz egyszerűsítés: a külön `factFactor` (ami a live `p.getServingAmount()`-tal skálázott) **eltűnik** — a fagyott bázis ugyanaz a `snapshotPer`, amit a makró-`factor` is használ, tehát egy faktor marad. A `gramAmount`/`servingScale` logika (absolute mass) változatlan.
- **`MealService.recipeFacts` (`:244`):** a recept fagyott sorait olvassa (a `lineOrder → amount` override-map-pel), nem a `pantryItemRepository`-t. A kamra-ág (`:185` környéki `itemFacts`) a `meal_item` saját snapshotjából.
- **NOVA és kategória marad élő** — a NOVA fagyasztása külön issue (`mezo-4tzf`), ebbe a körbe nem húzzuk be. Ezt a spec kimondja, hogy ne tűnjön feledésnek.

**Következmény, amit vállalunk:** a már cache-elt breakdown-envelope-ok értéke nem változik (azok jsonb-ben ülnek); az **újrageneráláskor** a fagyott számokból számol a pipeline. Ez csak ott ad más eredményt, ahol a kamra-sor a recept mentése óta driftelt — és pontosan ez a kívánt viselkedés: a recept kcal-ja eddig sem változott utólag, most már a rostja sem fog.

Egy pantry-tétel szerkesztése ezután **nem** írja át visszamenőleg a recept tápértékeit; aki friss értéket akar, az újramenti a receptet (ugyanaz a szabály, mint a makróknál — `RecipeService.java:166`: „Snapshots are re-resolved against the live pantry on every save"). A `useRecipeBreakdown` írás-vezérelt regenerálása (`mezo-b9gv`: egy használt pantry-tétel szerkesztése is triggereli) **marad**, de mostantól csak akkor mozdítja a számokat, ha a recept is újramentődött — ezt a viselkedést a feature-doc rögzíti.

## 5. Frontend

### 5.1 Típusok és számítás

- `types.ts`: új `Nutrients` típus (`{ fiberG: number | null; sugarG: number | null; saltG: number | null; saturatedFatG: number | null }`), felvéve a `Recipe`, `RecipeIngredientLine`, `FuelMeal` és `MealItem` alakokra `nutrients?` néven.
- `data/fuel/recipeMacros.ts`: `lineContribution`, `enrichLine`, `rescaleFrozen`, `computeRecipeMacros`, `computeRecipeMacrosWithOverrides` mind a nyolc mezőt viszi — **bitre a backend képletével** (1 tizedes a grammokra, null-őrzés, sorra kerekítés majd összegzés). Ez azért kritikus, mert a `LogMealSheet` override-preview-ja ezt a modult futtatja, és a preview-nak egyeznie kell azzal, amit a szerver ment.
- `data/fuel/recipeApi.ts` + `mealApi.ts`: a `nutrients` átmappelése; a mock seed (`data/fuel/fuel.ts` receptek + étkezések) kap értékeket, hogy mock módban ugyanaz a felület látszódjon.

### 5.2 Új komponens — `NutrientCells`

`frontend/src/features/fuel/components/NutrientCells.tsx` — a `MacroCells` halványabb testvére, ugyanazzal a chamfer-cella nyelvvel:

- négy cella, fix sorrendben: **TELÍTETT · CUKOR · ROST · SÓ** (a user felsorolásának sorrendje);
- **érték-formázás:** magyar tizedesvessző, legfeljebb 1 tizedes, a `,0` végződés elhagyva — `6` , `0,4` , `12,5`. (A tárolás és a wire scale-je marad 1; ez csak kijelzés.) `tabular-nums`;
- **`—` ha null** (nem 0);
- `size?: 'sm' | 'md'` + opcionális `perLabel` rail (a `MacroCells` API-jával egyezően);
- `empty?: 'hide' | 'dashes'` (default `hide`): ha **mind a négy** érték null, `hide` esetén a komponens `null`-t rendel (nincs üres, négy gondolatjeles sor), `dashes` esetén kirajzolja a négy `—`-t. A hero és az import `hide`-ot használ; a **hozzávaló-sorok `dashes`-t** — ott a `—` az információ (ez magyarázza a részleges rollupot).

Domain-specifikus (Fuel-tápérték), tehát `features/fuel/components/` a helye, nem `shared/ui` — a konvenció szerint.

### 5.3 Felületek

| # | felület | változás |
|---|---|---|
| 1 | `RecipeDetailPage` makró-hero | `NutrientCells` sor a négy `MacroHeroCell` alatt, **a `ServingToggle` bázisát követve** (`byBasis`, de 1 tizedessel) |
| 1 | `RecipeDetailPage` · Hozzávalók tab | soronként `NutrientCells` (`size="sm"`, `empty="dashes"`) a sor `MacroCells`-e alatt, a sor saját (főzési) amountján — a hiányzó adatú sor itt lesz `—`, ez magyarázza a részleges rollupot |
| 1 | `LogMealSheet` | soronként a `MacroCells` alatt, és az „EZ AZ ÉTKEZÉS" összesítőben; az override-ok újraszámolása a kiterjesztett `recipeMacros`-on keresztül |
| 4 | `ImportItemSheet` | mind a **három** preview-ágban (Keresés/OFF, Link, Fotó) egy `NutrientCells` sor a négy `StatCell` alatt — tiszta megjelenítés, az adat már a draftban van |
| 2 | `RecipeCard` | a makró-strip **`/adag` bázisra** (`recipe.macros` ÷ `servings`, egész számra), és `perLabel="/adag"` a bal railen, hogy a bázis expliciten látszódjon. Tápértéket a kártyára **nem** teszünk (a kártya már sűrű). |
| — | *bónusz* | `mealApi` a `nutrients.fiberG`-t átköti a `FuelMeal.fiberG`-re → a Fuel-hero **Rost gyűrűje** (`keretHero.ts:83`) real módban ma konstans 0, mert a wire nem hordozta; ezzel élővé válik, és a `fiberG` megszűnik mock-only mezőnek lenni (`mezo-c9t5` maradéka). |

### 5.4 Őszinte állapotok

Nincs kitalált szám: `null` → `—`; minden-null → nincs sor; a részleges rollup a soronkénti `—`-val magyarázza magát; a `/adag` bázis feliratozva jelenik meg, nem csendben osztunk.

## 6. Tesztek

**Backend (integration-first, `ApiIntegrationTest`/`AbstractIntegrationTest`):**

- recept-response `nutrients` — teljes adatú + fact-less sorral kevert recept (részleges Σ), és minden-null recept (mind a négy mező null);
- soronkénti `nutrients` a `RecipeIngredientResponse`-on, a sor amountján skálázva;
- `rollupWithOverrides` üres-map identitás **mind a nyolc mezőre** (regressziós őr), és egy override-olt sorral;
- meal-létrehozás: snapshot-capture mindkét ágon (recept ÷ servings, kamra per-basis), majd a `MealResponse.nutrients` visszaolvasása;
- scoring-parity: egy recept, aminek a kamra-sora a mentés **után** módosult → a breakdown a **fagyott** értékkel számol (ez az „egy igazságforrás" bizonyítéka);
- backfill-smoke: a migráció után egy régi (a teszt-populátorral írt) sor `nutrients`-e nem null.
- Új tábla-oszlop miatt a `ResetDatabase` TRUNCATE-lista nem változik (nincs új tábla), populátorok viszont kapnak tápérték-értékeket.

**Frontend:**

- `NutrientCells` unit: 1 tizedes formázás, `—` null-ra, minden-null → nem renderel;
- `recipeMacros` táblás teszt: null-propagáció, override-rescale, `rescaleFrozen` a nyolc mezőn, és az „üres override ≡ sima rollup" identitás;
- `RecipeDetailPage`: a tápérték-sor követi a `/adag ↔ egész` váltót;
- `RecipeCard`: `/adag` bázis (a meglévő, egész-receptre asszertáló tesztek javítása);
- `ImportItemSheet`: mindhárom ág preview-ja mutatja a négy tápértéket;
- `LogMealSheet`: override után az összesítő tápértékei is követik.

**Gate:** `cd backend && ./mvnw clean test` · `cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test` — majd self-PR → CI zöld → `--no-ff` merge (a CLAUDE.md flow).

## 7. Dokumentáció

- **ADR** (`docs/decisions/`): „A tápérték-tények is sorra fagyottak, mint a makrók" — a mai *live-facts* szabály tudatos felülírása; rögzíti a nullable-semantikát, az 1-tizedes kerekítést, a backfill őszintétlenségének korlátait, és hogy a NOVA szándékosan kimaradt (`mezo-4tzf`).
- `docs/features/fuel.md`: kontraktus-szekció (`nutrients` a recept- és meal-response-on), a snapshot/scoring szabály átírása live→frozen, a file map és az érintett felületek (recept-detail, LogMealSheet, ImportItemSheet, RecipeCard bázis).
- `docs/features/_platform-api-backend.md`: ha a kontraktus-táblája felsorolja a recept/meal sémákat, ott is.
- Zárás: `node scripts/lint-docs.mjs`.

## 8. Scope-on kívül (bd-be)

| mi | hova |
|---|---|
| hozzávaló-finomhangolás felfedezhetősége + beírható gramm-mező (a user 4. pontja, tudatosan félretéve) | `mezo-og03` (felvéve) |
| NOVA fagyasztása a `recipe_ingredient`-re | `mezo-4tzf` (létező) |
| nap-szintű tápérték-összegzés a Mai/Terv felületen (a Rost gyűrűn túl) | `mezo-kz8s` szomszédja — új issue az implementáció végén |
| tápértékek a Mai timeline-on / `MealScoreSheet` headerében | új issue az implementáció végén |
| a `pantry_item` négy tápértékének szerkeszthetősége az import-preview-ban (a brainstormban felajánlott „C" opció) | nem kérte — új issue, ha kell |
