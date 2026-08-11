# Recept + étkezés tápérték-fagyasztás és megjelenítés — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A négy tápérték (telített zsírsav, cukor, rost, só) lefagyasztása a `recipe_ingredient` és `meal_item` sorokra, a scoring pipeline átállítása a fagyott értékekre (egy igazságforrás), és kirajzolása a recept-detailen, a log-sheeten és az import-visszaigazolásban — plusz a listás recept-kártya `/adag` bázisra.

**Architecture:** A négy érték ugyanazt az utat járja, mint a makrók: mentéskor a live `pantry_item`-ből befagyasztva a sor snapshotjába, onnan skálázva a sor amountjával (`amount / snapshot_per`), null-őrzően összegezve. Egy új, fragmentek közt megosztott `Nutrients` kontraktus-séma jelenik meg a recept- és meal-válaszokon; a frontend egy új `NutrientCells` komponenssel rajzolja ki, a `recipeMacros.ts` képletei pedig bitre követik a backend mapperét, hogy a log-sheet override-preview ne térjen el a mentett értéktől.

**Tech Stack:** Spring Boot 4 / Java 21 / Maven / PostgreSQL 16 / Liquibase (SQL changelog) / MapStruct / Lombok · OpenAPI contract-first (`api/` fragmentek) · React 19 / Vite / TypeScript / Vitest.

**Spec:** [`docs/superpowers/specs/2026-08-11-recipe-meal-nutrient-freeze-design.md`](../specs/2026-08-11-recipe-meal-nutrient-freeze-design.md)
**Driving bd:** `mezo-m6uv` · **Branch:** `feat/fuel-nutrient-freeze` (már létezik, a spec-commit rajta van)

## Global Constraints

- **Négy mező, fix nevek mindenhol:** `fiberG`, `sugarG`, `saltG`, `saturatedFatG` (wire + FE); DB: `snapshot_fiber_g`, `snapshot_sugar_g`, `snapshot_salt_g`, `snapshot_saturated_fat_g`; entity: `snapshotFiberG`, `snapshotSugarG`, `snapshotSaltG`, `snapshotSaturatedFatG`.
- **Kijelzési sorrend mindenhol:** TELÍTETT · CUKOR · ROST · SÓ.
- **`null` ≠ `0`.** Minden új oszlop és minden DTO-mező nullable. Ahol a forrás nem hordozott értéket, ott `null` marad, és a felület `—`-t ír. Soha ne írj 0-t „nincs adat" helyett.
- **Kerekítés (a user 2026-08-11-i döntése, felülírja a terv eredeti 1-tizedes szabályát):** a grammok **3 tizedessel tárolódnak és összegződnek** (`setScale(3, HALF_UP)` backend / `Math.round(v * 1000 + Number.EPSILON) / 1000` FE), és **csak a megjelenítés kerekít 1 tizedesre** (`formatGram`). Ok: soronkénti 1-tizedes kerekítés mellett egy 0,04 g-os só-hozzájárulás 0,1 g-ként tárolódott, és a hiba soronként halmozódott — a sónál ez 10–25% torzítás. A 3 tizedes egyben egyezik a migrációk `round(..., 3)` backfilljével is. A `kcal/P/C/F` 0-tizedes szabálya **változatlan**.
- **Null-őrző összegzés:** a rollup akkor és csak akkor `null`, ha minden sor `null` az adott mezőre; különben a nem-null sorok összege (részleges Σ).
- **Kontraktus-sorrend (`api_contract_conventions.md`):** először a fragment-YAML → merge → csak utána backend-implementáció és FE-típusok. Boundary DTO-t soha ne írj kézzel.
- **Backend házirend:** konstruktor-injektálás (`@RequiredArgsConstructor`), `@Transactional` csak metóduson, AssertJ-only asszertálás, integration-first tesztek (`AbstractIntegrationTest` / `ApiIntegrationTest`), teszt-adat Java populátorból.
- **Migráció:** `{YYYYMMDDHHMM}_{bd-id}_{desc}.sql`, driving id `mezo-m6uv`, kiadott changeset soha nem módosul, minden script regisztrálva a `1.0.0_master.yml`-ben.
- **`./mvnw` mindig `clean`-nel** (Lombok+MapStruct inkrementális fordítás flaky).
- **FE konvenciók:** `@/*` absolute import, nincs barrel a `data/hooks.ts`-en kívül, tesztek kolokálva, domain-specifikus UI `features/<domain>/components/`-ben (a `NutrientCells` **nem** `shared/ui`).
- **Minden commit-subject viszi a bd id-t:** `feat(fuel): … (mezo-m6uv)`.

---

## File Structure

**Kontraktus**
- Modify `api/feature/meal/meal.yml` — az új `Nutrients` séma **itt** él (a fuel-mag fragment), + `nutrients` a `MealResponse`/`MealItemResponse`-on.
- Modify `api/feature/recipe/recipe.yml` — `nutrients` a `RecipeResponse`/`RecipeIngredientResponse`-on, cross-fragment `$ref`-fel (a `MealBreakdown` precedens szerint).
- Generált (commitolni kell): `api/openapi.yml`, `frontend/src/data/_client/api.gen.ts`.

**Backend**
- Modify `backend/.../feature/recipe/entity/RecipeIngredientEntity.java` — +4 nullable mező.
- Modify `backend/.../feature/meal/entity/MealItemEntity.java` — +4 nullable mező.
- Create `backend/src/main/resources/db/changelog/1.0.0/script/202608111200_mezo-m6uv_recipe_ingredient_nutrient_snapshot.sql`
- Create `backend/src/main/resources/db/changelog/1.0.0/script/202608111210_mezo-m6uv_meal_item_nutrient_snapshot.sql`
- Modify `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml` — a két changeset regisztrálása.
- Modify `backend/.../feature/recipe/mapper/RecipeMapper.java` — `lineFactor`, `nutrientsWithAmount`, `rollupNutrients*`, `scaledGram`, `addNullable`; bekötés a `toResponse`/`toLineResponse`-ba.
- Modify `backend/.../feature/recipe/service/RecipeService.java` — `buildLine` snapshot-capture; `fitLines` fagyott tényekre.
- Modify `backend/.../feature/meal/service/MealService.java` — `buildItem` mindkét ág snapshot-capture; `toScoredLine` fagyott tényekre; `Facts`/`pantryFacts`/`recipeFacts`/`addFact` törlése.
- Modify `backend/src/test/.../support/populator/RecipePopulator.java`, `PantryItemPopulator.java`, `MealPopulator.java` — tápérték-értékek a fixtúrákba.

**Frontend**
- Modify `frontend/src/data/types.ts` — `Nutrients` típus + `nutrients?` a `Recipe`, `RecipeIngredientLine`, `FuelMeal`, `MealItemLine` alakokon.
- Modify `frontend/src/data/fuel/recipeMacros.ts` — `lineNutrients`, `enrichLine`, `sumNutrients`, `computeRecipeNutrients`, `computeRecipeNutrientsWithOverrides`, `rescaleFrozenNutrients`.
- Modify `frontend/src/data/fuel/recipeApi.ts`, `frontend/src/data/fuel/mealApi.ts` — `nutrients` mappelés (+ `FuelMeal.fiberG` a wire-ből).
- Modify `frontend/src/data/fuel/pantry.ts` — mock seed tápérték-értékek (a receptek innen származtatják).
- Create `frontend/src/shared/lib/grams.ts` — `formatGram` (magyar tizedesvessző, max 1 tizedes, `—` null-ra).
- Create `frontend/src/features/fuel/components/NutrientCells.tsx` (+ `.test.tsx`).
- Modify `frontend/src/features/fuel/pages/RecipeDetailPage.tsx`, `sheets/LogMealSheet.tsx`, `sheets/ImportItemSheet.tsx`, `components/RecipeCard.tsx`.

**Dokumentáció**
- Create `docs/decisions/<következő sorszám>-freeze-nutrition-facts-per-line.md`
- Modify `docs/features/fuel.md`

---

### Task 1: Kontraktus — a megosztott `Nutrients` séma

A spec §3 `RecipeNutrients`-et említett; egyetlen, fragmentek közt megosztott `Nutrients` sémára egyszerűsítjük (a `recipe.yml` már így `$ref`-eli a meal-fragment `MealBreakdown`-ját), így egy DTO és egy FE-típus lesz belőle.

**Files:**
- Modify: `api/feature/meal/meal.yml`
- Modify: `api/feature/recipe/recipe.yml`
- Generated (commit): `api/openapi.yml`, `frontend/src/data/_client/api.gen.ts`

**Interfaces:**
- Consumes: —
- Produces: `io.mrkuhne.mezo.api.dto.Nutrients` (Java, Lombok-builderrel: `Nutrients.builder().fiberG(BigDecimal).sugarG(..).saltG(..).saturatedFatG(..).build()`), és `components['schemas']['Nutrients']` (TS: `{ fiberG?: number | null; sugarG?: number | null; saltG?: number | null; saturatedFatG?: number | null }`). `RecipeResponse.nutrients`, `RecipeIngredientResponse.nutrients`, `MealResponse.nutrients`, `MealItemResponse.nutrients` — mind opcionális.

- [ ] **Step 1: Vedd fel a `Nutrients` sémát a meal-fragmentbe**

`api/feature/meal/meal.yml`, a `components.schemas` blokkban, közvetlenül a `Macros` **után**:

```yaml
    Nutrients:
      type: object
      description: >-
        Nutrition-quality facts (mezo-m6uv), frozen per line exactly like the macros. Grams, one
        decimal. A null field means the SOURCE carried no value — it is NOT zero; a rollup field is
        null only when every contributing line was null (otherwise it is the sum of the known ones).
      properties:
        fiberG: { type: number, nullable: true }
        sugarG: { type: number, nullable: true }
        saltG: { type: number, nullable: true }
        saturatedFatG: { type: number, nullable: true }
```

- [ ] **Step 2: Kösd be a meal-válaszokra**

Ugyanabban a fájlban, a `MealItemResponse.properties`-be a `contribution` után:

```yaml
        nutrients: { $ref: '#/components/schemas/Nutrients' }
```

és a `MealResponse.properties`-be a `macros` után ugyanezt az egy sort. **A `required` listákat NE bővítsd** — egy régi kliens és a hand-written fixtúrák így érvényesek maradnak.

- [ ] **Step 3: Kösd be a recept-válaszokra (cross-fragment `$ref`)**

`api/feature/recipe/recipe.yml` — a `RecipeIngredientResponse.properties`-be a `contribution` után, és a `RecipeResponse.properties`-be a `macros` után:

```yaml
        nutrients: { $ref: '#/components/schemas/Nutrients' }
```

A séma nincs a recept-fragmentben definiálva — merge-időben oldódik fel, ahogy a `RecipeBreakdownResponse.breakdown` is a meal-fragment `MealBreakdown`-jára hivatkozik.

- [ ] **Step 4: Merge + FE-típusgenerálás**

```bash
cd api/generate && npm run generate:api && cd ../../frontend && pnpm generate:api
```

- [ ] **Step 5: Ellenőrizd, hogy mindhárom generált felület látja**

```bash
grep -n "Nutrients:" api/openapi.yml && grep -n "Nutrients" frontend/src/data/_client/api.gen.ts | head -5 && cd backend && ./mvnw -q clean generate-sources && find target/generated-sources -name 'Nutrients.java'
```

Elvárt: az `api/openapi.yml`-ben egy `Nutrients:` séma, a `api.gen.ts`-ben egy `Nutrients` típus a négy opcionális mezővel, és egy generált `Nutrients.java`.

- [ ] **Step 6: Commit**

```bash
git add api frontend/src/data/_client/api.gen.ts
git commit -m "feat(api): nutrients (telített/cukor/rost/só) a recept- és meal-válaszokon (mezo-m6uv)"
```

---

### Task 2: `recipe_ingredient` — négy nullable snapshot-oszlop + migráció

**Files:**
- Create: `backend/src/main/resources/db/changelog/1.0.0/script/202608111200_mezo-m6uv_recipe_ingredient_nutrient_snapshot.sql`
- Modify: `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/recipe/entity/RecipeIngredientEntity.java`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/support/populator/RecipePopulator.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/recipe/RecipeRepositoryIT.java`

**Interfaces:**
- Consumes: —
- Produces: `RecipeIngredientEntity#getSnapshotFiberG()/getSnapshotSugarG()/getSnapshotSaltG()/getSnapshotSaturatedFatG()` (`BigDecimal`, nullable) + a párjaik `set…`-ként. `RecipePopulator.line(...)` mostantól tápértékeket is állít: a `lineOrder 0` sor mind a négyet, a `lineOrder 1` sor **egyiket sem** (null-ág fixtúra).

- [ ] **Step 1: Írd meg a bukó tesztet**

`RecipeRepositoryIT.java` — új teszt (a fájl meglévő mintáját követve: `@Autowired RecipePopulator` + `PantryItemPopulator`, AssertJ):

```java
    @Test
    void testFindById_shouldKeepFrozenNutrientSnapshots_whenLineWasPopulatedWithFacts() {
        UUID owner = ownerId();
        UUID pantryItemId = pantryItemPopulator.createFood(owner, "Túró", LocalDate.now().plusDays(7)).getId();
        UUID recipeId = recipePopulator.createRecipe(owner, pantryItemId).getId();

        RecipeEntity reloaded = recipeRepository.findByIdAndCreatedByAndDeletedFalse(recipeId, owner).orElseThrow();

        RecipeIngredientEntity withFacts = reloaded.getLines().get(0);   // @OrderBy("lineOrder") → 0 first
        RecipeIngredientEntity withoutFacts = reloaded.getLines().get(1);
        assertThat(withFacts.getSnapshotFiberG()).isEqualByComparingTo("3.2");
        assertThat(withFacts.getSnapshotSugarG()).isEqualByComparingTo("4.1");
        assertThat(withFacts.getSnapshotSaltG()).isEqualByComparingTo("0.4");
        assertThat(withFacts.getSnapshotSaturatedFatG()).isEqualByComparingTo("2.8");
        assertThat(withoutFacts.getSnapshotFiberG()).isNull();
        assertThat(withoutFacts.getSnapshotSugarG()).isNull();
        assertThat(withoutFacts.getSnapshotSaltG()).isNull();
        assertThat(withoutFacts.getSnapshotSaturatedFatG()).isNull();
    }
```

Ha az `ownerId()` / `recipeRepository` / populátor-mezőnév a fájlban máshogy hívódik, a **fájl meglévő tesztjeinek** nevezéktanát használd — ne vezess be újat.

- [ ] **Step 2: Futtasd — nem is fordul le**

```bash
cd backend && ./mvnw clean test -Dtest=RecipeRepositoryIT
```

Elvárt: fordítási hiba (`cannot find symbol: method getSnapshotFiberG()`). Ez a bukás.

- [ ] **Step 3: Írd meg a migrációt**

`202608111200_mezo-m6uv_recipe_ingredient_nutrient_snapshot.sql`:

```sql
-- Nutrition-quality facts frozen per recipe line (mezo-m6uv): fiber/sugar/salt/saturated fat in the
-- line's OWN per-basis (snapshot_per), captured from pantry_item at compose time — exactly like
-- snapshot_kcal. NULLABLE on purpose: "the source carried no value" is not "0 g" (an OpenFoodFacts
-- hit often lacks fiber), and a fake 0 would lie to the recipe/meal scorer, which reads these.
--
-- Backfill: today's pantry values, rescaled from the pantry's CURRENT per-basis to the line's frozen
-- snapshot_per. This is an honest approximation, NOT a historical reconstruction — a pantry row that
-- drifted since the recipe was saved contributes its present value (see the ADR). A line whose
-- pantry row is gone or fact-less stays NULL.
ALTER TABLE recipe_ingredient
    ADD COLUMN snapshot_fiber_g numeric,
    ADD COLUMN snapshot_sugar_g numeric,
    ADD COLUMN snapshot_salt_g numeric,
    ADD COLUMN snapshot_saturated_fat_g numeric;

UPDATE recipe_ingredient ri
   SET snapshot_fiber_g =
           round(p.fiber_g * (ri.snapshot_per / coalesce(nullif(p.serving_amount, 0), 1)), 3),
       snapshot_sugar_g =
           round(p.sugar_g * (ri.snapshot_per / coalesce(nullif(p.serving_amount, 0), 1)), 3),
       snapshot_salt_g =
           round(p.salt_g * (ri.snapshot_per / coalesce(nullif(p.serving_amount, 0), 1)), 3),
       snapshot_saturated_fat_g =
           round(p.saturated_fat_g * (ri.snapshot_per / coalesce(nullif(p.serving_amount, 0), 1)), 3)
  FROM pantry_item p
 WHERE p.id = ri.pantry_item_id
   AND p.is_deleted = false;
```

- [ ] **Step 4: Regisztráld a changesetet**

`1.0.0_master.yml` — a fájl **végére**, a meglévő bejegyzések formájában:

```yaml
  - changeSet:
      id: "1.0.0:202608111200_mezo-m6uv_recipe_ingredient_nutrient_snapshot"
      author: daniel.kuhne
      changes:
        - sqlFile:
            relativeToChangelogFile: true
            path: script/202608111200_mezo-m6uv_recipe_ingredient_nutrient_snapshot.sql
```

- [ ] **Step 5: Vedd fel a négy mezőt az entityre**

`RecipeIngredientEntity.java`, a `snapshotFatG` **után** (a `@NotNull`-t szándékosan nem tesszük rá):

```java
    // Nutrition-quality facts frozen alongside the macros (mezo-m6uv). Nullable: "the source
    // carried no value" is NOT zero — a fake 0 would lie to the scorer (cf. hasMicroFacts).
    @Column(name = "snapshot_fiber_g")
    private BigDecimal snapshotFiberG;

    @Column(name = "snapshot_sugar_g")
    private BigDecimal snapshotSugarG;

    @Column(name = "snapshot_salt_g")
    private BigDecimal snapshotSaltG;

    @Column(name = "snapshot_saturated_fat_g")
    private BigDecimal snapshotSaturatedFatG;
```

- [ ] **Step 6: Add tápértéket a fixtúrának**

`RecipePopulator.line(...)` — a `setSnapshotFatG` után, hogy a `lineOrder 0` sor tényeket hordozzon, az `1` pedig ne (ez a null-ág fixtúrája, amire több későbbi teszt épül):

```java
        // lineOrder 0 carries facts, lineOrder 1 deliberately carries none — the null-arm fixture
        // every nutrient rollup test leans on (mezo-m6uv).
        if (order == 0) {
            ing.setSnapshotFiberG(new BigDecimal("3.2"));
            ing.setSnapshotSugarG(new BigDecimal("4.1"));
            ing.setSnapshotSaltG(new BigDecimal("0.4"));
            ing.setSnapshotSaturatedFatG(new BigDecimal("2.8"));
        }
```

- [ ] **Step 7: Futtasd — zöld**

```bash
cd backend && ./mvnw clean test -Dtest=RecipeRepositoryIT
```

Elvárt: PASS. Ha a `docker compose` nem fut, indítsd (`cd backend && docker compose up -d`).

- [ ] **Step 8: Commit**

```bash
git add backend/src/main/resources/db/changelog backend/src/main/java/io/mrkuhne/mezo/feature/recipe/entity/RecipeIngredientEntity.java backend/src/test/java/io/mrkuhne/mezo/support/populator/RecipePopulator.java backend/src/test/java/io/mrkuhne/mezo/feature/recipe/RecipeRepositoryIT.java
git commit -m "feat(recipe): tápérték-snapshot oszlopok a recipe_ingredient-en (mezo-m6uv)"
```

---

### Task 3: `RecipeService.buildLine` — a snapshot a live kamra-tételből

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/recipe/service/RecipeService.java`
- Modify: `backend/src/test/java/io/mrkuhne/mezo/support/populator/PantryItemPopulator.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/recipe/RecipeServiceIT.java`

**Interfaces:**
- Consumes: Task 2 entity-setterei.
- Produces: `PantryItemPopulator.createFoodWithNutrients(UUID owner, String name)` → tápértékes food-sor (`fiber 3.2 / sugar 4.1 / salt 0.4 / satFat 2.8` per 100 g), és a meglévő `createFood(...)` **továbbra is tápérték nélküli** (a null-ág).

- [ ] **Step 1: Vedd fel a tápértékes populátor-metódust**

`PantryItemPopulator.java`, a `createFood` után:

```java
    /** A food row that DOES carry the four nutrition-quality facts per 100 g (mezo-m6uv). The plain
     *  {@link #createFood} stays fact-less on purpose — it is the null-arm fixture. */
    public PantryItemEntity createFoodWithNutrients(UUID owner, String name) {
        PantryItemEntity e = new PantryItemEntity();
        e.setCreatedBy(owner);
        e.setKind("food");
        e.setName(name);
        e.setSource("manual");
        e.setCategory("dairy"); // valid ck_pantry_item_category enum value
        e.setServingAmount(new BigDecimal("100"));
        e.setServingUnit("g");
        e.setKcal(new BigDecimal("110"));
        e.setProteinG(new BigDecimal("13.0"));
        e.setCarbsG(new BigDecimal("4.0"));
        e.setFatG(new BigDecimal("4.5"));
        e.setFiberG(new BigDecimal("3.2"));
        e.setSugarG(new BigDecimal("4.1"));
        e.setSaltG(new BigDecimal("0.4"));
        e.setSaturatedFatG(new BigDecimal("2.8"));
        e.setNova((short) 1);
        return repository.saveAndFlush(e);
    }
```

- [ ] **Step 2: Írd meg a bukó tesztet**

`RecipeServiceIT.java` — a fájl meglévő „create recipe" tesztjeinek mintájára (`RecipeRequest` + `RecipeIngredientRequest` összeállítás, `recipeService.create(owner, req)`):

```java
    @Test
    void testCreate_shouldFreezeNutrientFacts_whenSourceCarriesThem() {
        UUID owner = ownerId();
        UUID withFacts = pantryItemPopulator.createFoodWithNutrients(owner, "Túró").getId();
        UUID factLess = pantryItemPopulator.createFood(owner, "Csirke", LocalDate.now().plusDays(3)).getId();

        UUID id = recipeService.create(owner, RecipeRequest.builder()
            .name("Fagyasztás-teszt")
            .category("breakfast")
            .servings(1)
            .ingredients(List.of(
                RecipeIngredientRequest.builder().pantryItemId(withFacts).amount(new BigDecimal("200")).unit("g").build(),
                RecipeIngredientRequest.builder().pantryItemId(factLess).amount(new BigDecimal("150")).unit("g").build()))
            .build()).getId();

        RecipeEntity saved = recipeRepository.findByIdAndCreatedByAndDeletedFalse(id, owner).orElseThrow();
        assertThat(saved.getLines().get(0).getSnapshotFiberG()).isEqualByComparingTo("3.2"); // per-basis, NOT scaled
        assertThat(saved.getLines().get(0).getSnapshotSaltG()).isEqualByComparingTo("0.4");
        assertThat(saved.getLines().get(1).getSnapshotFiberG()).isNull();
        assertThat(saved.getLines().get(1).getSnapshotSaltG()).isNull();
    }
```

A `recipeService.create(...)` visszatérési típusát/aláírását a fájl meglévő tesztjeiből vedd át (ha `RecipeResponse`-t ad, `…getId()`, ha `UUID`-t, akkor közvetlenül).

- [ ] **Step 3: Futtasd — bukik**

```bash
cd backend && ./mvnw clean test -Dtest=RecipeServiceIT
```

Elvárt: FAIL — `expected 3.2 but was null` (a `buildLine` még nem másolja át).

- [ ] **Step 4: Implementáld a capture-t**

`RecipeService.buildLine`, a `line.setSnapshotFatG(...)` után:

```java
        // Nutrition-quality facts (mezo-m6uv): NO orDefault — a missing fact stays null, because
        // "the source carried no value" is not "0 g" and the scorer distinguishes the two.
        line.setSnapshotFiberG(item.getFiberG());
        line.setSnapshotSugarG(item.getSugarG());
        line.setSnapshotSaltG(item.getSaltG());
        line.setSnapshotSaturatedFatG(item.getSaturatedFatG());
```

- [ ] **Step 5: Futtasd — zöld**

```bash
cd backend && ./mvnw clean test -Dtest=RecipeServiceIT
```

Elvárt: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/recipe/service/RecipeService.java backend/src/test/java/io/mrkuhne/mezo/support/populator/PantryItemPopulator.java backend/src/test/java/io/mrkuhne/mezo/feature/recipe/RecipeServiceIT.java
git commit -m "feat(recipe): a hozzávaló-sor lefagyasztja a négy tápérték-tényt is (mezo-m6uv)"
```

---

### Task 4: `RecipeMapper` — tápérték-kontribúció, rollup és a HTTP-válasz

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/recipe/mapper/RecipeMapper.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/recipe/RecipeMapperTest.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/recipe/RecipeMapperOverrideRollupTest.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/recipe/RecipeApiIT.java`

**Interfaces:**
- Consumes: Task 1 `Nutrients` DTO; Task 2 entity-getterek.
- Produces: `RecipeMapper#lineFactor(RecipeIngredientEntity, BigDecimal) : BigDecimal` · `#nutrientsWithAmount(RecipeIngredientEntity, BigDecimal) : Nutrients` · `#rollupNutrientsWithOverrides(RecipeEntity, Map<Integer, BigDecimal>) : Nutrients` — mindhárom `default` interface-metódus, a `MealService` a harmadikat használja majd (Task 5).

- [ ] **Step 1: Írd meg a bukó mapper-teszteket**

`RecipeMapperTest.java` — a fájl meglévő mintája szerint (`RecipeMapper mapper = Mappers.getMapper(RecipeMapper.class)` vagy a `RecipeMapperImpl` közvetlen példányosítása; kövesd a fájlt):

```java
    @Test
    void testToResponse_shouldScaleNutrientsPerLineAndRollThemUpNullSafely() {
        RecipeEntity recipe = recipeWithTwoLines(); // helper: line0 has facts, line1 has none
        RecipeResponse response = mapper.toResponse(recipe);

        // line0: 200 g of a per-100 g source → factor 2 → 3.2 * 2 = 6.4, one decimal
        assertThat(response.getIngredients().get(0).getNutrients().getFiberG()).isEqualByComparingTo("6.4");
        assertThat(response.getIngredients().get(0).getNutrients().getSaltG()).isEqualByComparingTo("0.8");
        // line1: no facts → every field null (NOT zero)
        assertThat(response.getIngredients().get(1).getNutrients().getFiberG()).isNull();
        // rollup: partial Σ — the known line only
        assertThat(response.getNutrients().getFiberG()).isEqualByComparingTo("6.4");
        assertThat(response.getNutrients().getSaturatedFatG()).isEqualByComparingTo("5.6");
    }

    @Test
    void testToResponse_shouldReturnNullRollup_whenNoLineCarriesFacts() {
        RecipeResponse response = mapper.toResponse(recipeWithoutAnyFacts());

        assertThat(response.getNutrients().getFiberG()).isNull();
        assertThat(response.getNutrients().getSugarG()).isNull();
        assertThat(response.getNutrients().getSaltG()).isNull();
        assertThat(response.getNutrients().getSaturatedFatG()).isNull();
    }
```

`RecipeMapperOverrideRollupTest.java` — az „üres override ≡ tárolt rollup" identitás a tápértékekre is:

```java
    @Test
    void testRollupNutrientsWithOverrides_shouldEqualStoredRollup_whenOverridesEmpty() {
        RecipeEntity recipe = recipeWithTwoLines();

        Nutrients empty = mapper.rollupNutrientsWithOverrides(recipe, Map.of());
        Nutrients stored = mapper.toResponse(recipe).getNutrients();

        assertThat(empty.getFiberG()).isEqualByComparingTo(stored.getFiberG());
        assertThat(empty.getSugarG()).isEqualByComparingTo(stored.getSugarG());
        assertThat(empty.getSaltG()).isEqualByComparingTo(stored.getSaltG());
        assertThat(empty.getSaturatedFatG()).isEqualByComparingTo(stored.getSaturatedFatG());
    }

    @Test
    void testRollupNutrientsWithOverrides_shouldRescaleOnlyTheOverriddenLine() {
        RecipeEntity recipe = recipeWithTwoLines(); // line0: 200 g with facts

        Nutrients halved = mapper.rollupNutrientsWithOverrides(recipe, Map.of(0, new BigDecimal("100")));

        assertThat(halved.getFiberG()).isEqualByComparingTo("3.2"); // factor 1 instead of 2
    }
```

A `recipeWithTwoLines()` / `recipeWithoutAnyFacts()` helpereket a fájl meglévő fixtúra-építőiből származtasd (ugyanaz az entity-összeállítás, csak a négy új settert állítod/hagyod null-on).

- [ ] **Step 2: Futtasd — bukik**

```bash
cd backend && ./mvnw clean test -Dtest='RecipeMapperTest+RecipeMapperOverrideRollupTest'
```

Elvárt: fordítási hiba (`getNutrients()` / `rollupNutrientsWithOverrides` nem létezik).

- [ ] **Step 3: Implementáld a mapperben**

`RecipeMapper.java` — importáld a `Nutrients` DTO-t, majd:

```java
    /** THE per-line scale factor — {@code amount / snapshotPer}, six decimals. Both the macro
     *  contribution and the nutrient facts go through this, so the arithmetic exists once. */
    default BigDecimal lineFactor(RecipeIngredientEntity l, BigDecimal amount) {
        BigDecimal per = l.getSnapshotPer() == null || l.getSnapshotPer().signum() == 0
            ? BigDecimal.ONE : l.getSnapshotPer();
        BigDecimal effective = amount == null ? BigDecimal.ZERO : amount;
        return effective.divide(per, 6, RoundingMode.HALF_UP);
    }

    /** One line's nutrition-quality facts at a given amount. Null in → null out (mezo-m6uv). */
    default Nutrients nutrientsWithAmount(RecipeIngredientEntity l, BigDecimal amount) {
        BigDecimal factor = lineFactor(l, amount);
        return Nutrients.builder()
            .fiberG(scaledGram(l.getSnapshotFiberG(), factor))
            .sugarG(scaledGram(l.getSnapshotSugarG(), factor))
            .saltG(scaledGram(l.getSnapshotSaltG(), factor))
            .saturatedFatG(scaledGram(l.getSnapshotSaturatedFatG(), factor))
            .build();
    }

    /** Whole-recipe nutrient rollup with per-line amount substitutions ({@code lineOrder → amount}).
     *  An EMPTY map reproduces the stored rollup exactly — the same regression guard the macros have. */
    default Nutrients rollupNutrientsWithOverrides(RecipeEntity e, Map<Integer, BigDecimal> overrides) {
        BigDecimal fiber = null;
        BigDecimal sugar = null;
        BigDecimal salt = null;
        BigDecimal satFat = null;
        for (RecipeIngredientEntity l : e.getLines()) {
            Nutrients x = nutrientsWithAmount(l, overrides.getOrDefault(l.getLineOrder(), l.getAmount()));
            fiber = addNullable(fiber, x.getFiberG());
            sugar = addNullable(sugar, x.getSugarG());
            salt = addNullable(salt, x.getSaltG());
            satFat = addNullable(satFat, x.getSaturatedFatG());
        }
        return Nutrients.builder().fiberG(fiber).sugarG(sugar).saltG(salt).saturatedFatG(satFat).build();
    }

    /** Whole-recipe nutrient rollup from already-mapped line responses. */
    private Nutrients rollupNutrients(List<RecipeIngredientResponse> lines) {
        BigDecimal fiber = null;
        BigDecimal sugar = null;
        BigDecimal salt = null;
        BigDecimal satFat = null;
        for (RecipeIngredientResponse l : lines) {
            Nutrients x = l.getNutrients();
            fiber = addNullable(fiber, x.getFiberG());
            sugar = addNullable(sugar, x.getSugarG());
            salt = addNullable(salt, x.getSaltG());
            satFat = addNullable(satFat, x.getSaturatedFatG());
        }
        return Nutrients.builder().fiberG(fiber).sugarG(sugar).saltG(salt).saturatedFatG(satFat).build();
    }

    /**
     * Grams at ONE decimal, HALF_UP. The macros' whole-number rule is unusable here: salt is
     * typically 0.4–1.8 g, so rounding to an integer would throw away most of the signal.
     * A null base stays null — the rollup must be able to say "no data" (mezo-m6uv).
     */
    private static BigDecimal scaledGram(BigDecimal base, BigDecimal factor) {
        return base == null ? null : base.multiply(factor).setScale(1, RoundingMode.HALF_UP);
    }

    /** Null-preserving Σ: the accumulator stays null until a line actually carries a value, so a
     *  rollup is null only when EVERY line was null. */
    private static BigDecimal addNullable(BigDecimal acc, BigDecimal v) {
        if (v == null) {
            return acc;
        }
        return acc == null ? v : acc.add(v);
    }
```

Ezután **refaktoráld** a `contributionWithAmount`-ot, hogy a saját per/factor számítása helyett a `lineFactor`-t hívja (a viselkedés bitre azonos marad):

```java
    default RecipeContribution contributionWithAmount(RecipeIngredientEntity l, BigDecimal amount) {
        BigDecimal factor = lineFactor(l, amount);
        return RecipeContribution.builder()
            .kcal(scaled(l.getSnapshotKcal(), factor))
            .p(scaled(l.getSnapshotProteinG(), factor))
            .c(scaled(l.getSnapshotCarbsG(), factor))
            .f(scaled(l.getSnapshotFatG(), factor))
            .build();
    }
```

Végül kösd be a válaszokba: a `toLineResponse` builderébe `.nutrients(nutrients(l))` (ahol `default Nutrients nutrients(RecipeIngredientEntity l) { return nutrientsWithAmount(l, l.getAmount()); }` — a `contribution(l)` párja), a `toResponse` builderébe pedig `.nutrients(rollupNutrients(lines))`.

- [ ] **Step 4: Futtasd — zöld**

```bash
cd backend && ./mvnw clean test -Dtest='RecipeMapperTest+RecipeMapperOverrideRollupTest'
```

Elvárt: PASS.

- [ ] **Step 5: Bizonyítsd a HTTP-szinten is**

`RecipeApiIT.java` — új teszt a fájl verb-helperjeivel (`getOk(...)`, `ownerAuthHeaders()`):

```java
    @Test
    void testListRecipes_shouldCarryNutrients_whenALineCarriesFrozenFacts() {
        UUID pantryItemId = pantryItemPopulator.createFoodWithNutrients(ownerId(), "Túró").getId();
        recipePopulator.createRecipe(ownerId(), pantryItemId);

        RecipeListResponse body = getOk("/api/recipe", RecipeListResponse.class);

        RecipeResponse recipe = body.getRecipes().get(0);
        assertThat(recipe.getNutrients().getFiberG()).isNotNull();
        assertThat(recipe.getIngredients().get(0).getNutrients().getSaltG()).isNotNull();
        assertThat(recipe.getIngredients().get(1).getNutrients().getSaltG()).isNull();
    }
```

A helper-nevek/aláírások a fájl meglévő tesztjeiből jönnek — ne találj ki újat.

- [ ] **Step 6: Futtasd**

```bash
cd backend && ./mvnw clean test -Dtest=RecipeApiIT
```

Elvárt: PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/recipe/mapper/RecipeMapper.java backend/src/test/java/io/mrkuhne/mezo/feature/recipe
git commit -m "feat(recipe): tápérték-kontribúció és null-őrző rollup a recept-válaszon (mezo-m6uv)"
```

---

### Task 5: `meal_item` — snapshot-oszlopok, migráció és capture mindkét ágon

**Files:**
- Create: `backend/src/main/resources/db/changelog/1.0.0/script/202608111210_mezo-m6uv_meal_item_nutrient_snapshot.sql`
- Modify: `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/meal/entity/MealItemEntity.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/meal/service/MealService.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/meal/mapper/MealMapper.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/meal/MealApiIT.java`

**Interfaces:**
- Consumes: Task 4 `RecipeMapper#rollupNutrientsWithOverrides`.
- Produces: `MealItemEntity#getSnapshotFiberG()/…` (nullable `BigDecimal`), és a `MealResponse.nutrients` / `MealItemResponse.nutrients` kitöltve.

- [ ] **Step 1: Írd meg a bukó tesztet**

`MealApiIT.java` — a fájl meglévő „log a meal" mintája szerint (ott már van `r.setFiberG(...)`-et állító pantry-fixtúra a `:133` környékén, azt használd újra):

```java
    @Test
    void testCreateMeal_shouldFreezeNutrients_onBothArms() {
        // pantry arm: 150 g of a per-100 g source carrying facts → factor 1.5
        MealResponse pantryMeal = logPantryMeal(new BigDecimal("150"));
        assertThat(pantryMeal.getItems().get(0).getNutrients().getFiberG()).isEqualByComparingTo("6.0");
        assertThat(pantryMeal.getNutrients().getFiberG()).isEqualByComparingTo("6.0");

        // recipe arm: 1 adag of a 2-serving recipe → the per-serving half of the whole rollup
        MealResponse recipeMeal = logRecipeMeal(new BigDecimal("1"));
        assertThat(recipeMeal.getItems().get(0).getNutrients().getSaltG()).isNotNull();
        assertThat(recipeMeal.getItems().get(0).getNutrients().getSaltG())
            .isEqualByComparingTo(recipeMeal.getNutrients().getSaltG());
    }
```

A `logPantryMeal` / `logRecipeMeal` helpereket a fájl meglévő teszt-testeiből emeld ki (ugyanaz a `MealRequest`-építés + `postCreated("/api/meal", …)`), a per-100 g értékek pedig a `:133` környéki fixtúrából jöjjenek — ha az `4` g rostot állít, az elvárt érték `6.0` a 150 g-os amountnál.

- [ ] **Step 2: Futtasd — bukik**

```bash
cd backend && ./mvnw clean test -Dtest=MealApiIT
```

Elvárt: fordítási hiba (`getNutrients()` a `MealItemResponse`-on még nincs kitöltve → NPE vagy `null`).

- [ ] **Step 3: Írd meg a migrációt**

`202608111210_mezo-m6uv_meal_item_nutrient_snapshot.sql`:

```sql
-- Nutrition-quality facts frozen per logged meal item (mezo-m6uv), the meal_item sibling of the
-- recipe_ingredient snapshot. Recipe arm: the whole-recipe rollup ÷ servings, in the item's "adag"
-- basis (snapshot_per = 1). Pantry arm: the live pantry item's per-basis value. NULLABLE for the
-- same reason as on recipe_ingredient: "no data" is not "0 g", and the scorer reads these.
--
-- Backfill (honest approximation, see the ADR): the pantry arm takes today's pantry values rescaled
-- to the item's frozen snapshot_per; the recipe arm sums the recipe's (already backfilled) line
-- snapshots ÷ servings, IGNORING any per-line override envelope the item may carry — a historically
-- exact replay is not reconstructable from what we stored. Rows whose source is gone stay NULL.
ALTER TABLE meal_item
    ADD COLUMN snapshot_fiber_g numeric,
    ADD COLUMN snapshot_sugar_g numeric,
    ADD COLUMN snapshot_salt_g numeric,
    ADD COLUMN snapshot_saturated_fat_g numeric;

-- pantry arm
UPDATE meal_item mi
   SET snapshot_fiber_g =
           round(p.fiber_g * (mi.snapshot_per / coalesce(nullif(p.serving_amount, 0), 1)), 3),
       snapshot_sugar_g =
           round(p.sugar_g * (mi.snapshot_per / coalesce(nullif(p.serving_amount, 0), 1)), 3),
       snapshot_salt_g =
           round(p.salt_g * (mi.snapshot_per / coalesce(nullif(p.serving_amount, 0), 1)), 3),
       snapshot_saturated_fat_g =
           round(p.saturated_fat_g * (mi.snapshot_per / coalesce(nullif(p.serving_amount, 0), 1)), 3)
  FROM pantry_item p
 WHERE mi.source = 'pantry'
   AND p.id = mi.pantry_item_id
   AND p.is_deleted = false;

-- recipe arm: Σ over the recipe's frozen lines ÷ servings (SUM ignores NULLs, so a fact-less line
-- simply does not contribute and an all-null recipe yields NULL — the same rule the Java rollup uses)
UPDATE meal_item mi
   SET snapshot_fiber_g = round(agg.fiber / greatest(coalesce(r.servings, 1), 1), 3),
       snapshot_sugar_g = round(agg.sugar / greatest(coalesce(r.servings, 1), 1), 3),
       snapshot_salt_g = round(agg.salt / greatest(coalesce(r.servings, 1), 1), 3),
       snapshot_saturated_fat_g = round(agg.sat_fat / greatest(coalesce(r.servings, 1), 1), 3)
  FROM recipe r,
       (SELECT ri.recipe_id,
               sum(ri.snapshot_fiber_g * ri.amount / coalesce(nullif(ri.snapshot_per, 0), 1)) AS fiber,
               sum(ri.snapshot_sugar_g * ri.amount / coalesce(nullif(ri.snapshot_per, 0), 1)) AS sugar,
               sum(ri.snapshot_salt_g * ri.amount / coalesce(nullif(ri.snapshot_per, 0), 1)) AS salt,
               sum(ri.snapshot_saturated_fat_g * ri.amount / coalesce(nullif(ri.snapshot_per, 0), 1)) AS sat_fat
          FROM recipe_ingredient ri
         WHERE ri.is_deleted = false
         GROUP BY ri.recipe_id) agg
 WHERE mi.source = 'recipe'
   AND mi.recipe_id = agg.recipe_id
   AND r.id = agg.recipe_id;
```

- [ ] **Step 4: Regisztráld a changesetet**

`1.0.0_master.yml`, a Task 2-es bejegyzés **után**:

```yaml
  - changeSet:
      id: "1.0.0:202608111210_mezo-m6uv_meal_item_nutrient_snapshot"
      author: daniel.kuhne
      changes:
        - sqlFile:
            relativeToChangelogFile: true
            path: script/202608111210_mezo-m6uv_meal_item_nutrient_snapshot.sql
```

- [ ] **Step 5: Vedd fel a négy mezőt a `MealItemEntity`-re**

A `snapshotNova` **előtt** (a makró-snapshotok után), a Task 2-es kommentárral megegyező szellemben:

```java
    // Nutrition-quality facts frozen with the macros (mezo-m6uv). Recipe arm: per "adag"; pantry
    // arm: per the item's own snapshot_per. Nullable — "no data" is not "0 g".
    @Column(name = "snapshot_fiber_g")
    private BigDecimal snapshotFiberG;

    @Column(name = "snapshot_sugar_g")
    private BigDecimal snapshotSugarG;

    @Column(name = "snapshot_salt_g")
    private BigDecimal snapshotSaltG;

    @Column(name = "snapshot_saturated_fat_g")
    private BigDecimal snapshotSaturatedFatG;
```

- [ ] **Step 6: Implementáld a capture-t mindkét ágon**

`MealService.buildItem` — a recept-ágban, az `item.setSnapshotFatG(...)` után:

```java
            // The nutrient facts follow the SAME frozen-from-the-overridden-set rule as the macros
            // (mezo-m6uv): an empty override map reproduces the stored rollup exactly.
            Nutrients wholeNutrients = recipeMapper.rollupNutrientsWithOverrides(recipe, overrides);
            item.setSnapshotFiberG(perServingGram(wholeNutrients.getFiberG(), servings));
            item.setSnapshotSugarG(perServingGram(wholeNutrients.getSugarG(), servings));
            item.setSnapshotSaltG(perServingGram(wholeNutrients.getSaltG(), servings));
            item.setSnapshotSaturatedFatG(perServingGram(wholeNutrients.getSaturatedFatG(), servings));
```

a kamra-ágban, az `item.setSnapshotFatG(...)` után (`orDefault` **nélkül**):

```java
            item.setSnapshotFiberG(p.getFiberG());
            item.setSnapshotSugarG(p.getSugarG());
            item.setSnapshotSaltG(p.getSaltG());
            item.setSnapshotSaturatedFatG(p.getSaturatedFatG());
```

és a `perServing` (makró, 0 tizedes) mellé a gramm-párja:

```java
    /** Per-serving grams at ONE decimal — the nutrient sibling of {@link #perServing}; null stays
     *  null so a fact-less recipe does not turn into a fake 0 g (mezo-m6uv). */
    private static BigDecimal perServingGram(BigDecimal whole, BigDecimal servings) {
        return whole == null ? null : whole.divide(servings, 1, RoundingMode.HALF_UP);
    }
```

- [ ] **Step 7: Kösd be a mapperbe**

`MealMapper.java` — az item-válaszba `.nutrients(...)` a `contribution` mellé, a `RecipeMapper.nutrientsWithAmount` logikájával, de a `MealItemEntity` mezőiről (`factor = amount / snapshotPer`, `scaledGram` 1 tizedes, null-őrzés), és a `MealResponse`-ba a null-őrző Σ az item-válaszokból. Ha a `MealMapper` már tartalmaz `scaled`/`factor` privát helpert, azok mellé vedd fel a gramm-párokat ugyanazzal a névkonvencióval (`scaledGram`, `addNullable`) — a `RecipeMapper`-ben lévőkkel szó szerint egyező szemantikával.

- [ ] **Step 8: Futtasd — zöld**

```bash
cd backend && ./mvnw clean test -Dtest='MealApiIT+MealMapperTest'
```

Elvárt: PASS.

- [ ] **Step 9: Commit**

```bash
git add backend/src/main/resources/db/changelog backend/src/main/java/io/mrkuhne/mezo/feature/meal backend/src/test/java/io/mrkuhne/mezo/feature/meal/MealApiIT.java
git commit -m "feat(meal): tápérték-snapshot a meal_item-en mindkét ágon (mezo-m6uv)"
```

---

### Task 6: A scoring átállítása a fagyott tényekre — egy igazságforrás

Ez a spec §4.3-a: a `MealService` és a `RecipeService` eddig **élő** kamra-sorból olvasta a négy tényt. Mostantól a fagyott snapshotból.

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/meal/service/MealService.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/recipe/service/RecipeService.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/meal/MealServiceIT.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/recipe/RecipeBreakdownApiIT.java`

**Interfaces:**
- Consumes: Task 2/5 entity-getterek.
- Produces: `MealService` privát `Facts` recordja, `pantryFacts`, `recipeFacts`, `addFact` **megszűnik**; helyette `pantryCategory(UUID, UUID) : String`. `RecipeService.fitLines(RecipeEntity, Map<UUID, PantryItemEntity>)` aláírása **változatlan** (a NOVA + kategória továbbra is élő olvasás).

- [ ] **Step 1: Írd meg a bukó tesztet — a drift nem írhatja át a pontszámot**

`MealServiceIT.java`:

```java
    @Test
    void testCreate_shouldScoreFromFrozenFacts_whenThePantryRowDriftedAfterTheRecipeWasSaved() {
        UUID owner = ownerId();
        PantryItemEntity source = pantryItemPopulator.createFoodWithNutrients(owner, "Túró");
        UUID recipeId = recipePopulator.createRecipe(owner, source.getId()).getId();

        // the pantry row drifts AFTER the recipe froze its snapshot
        source.setSaltG(new BigDecimal("40"));
        pantryItemRepository.saveAndFlush(source);

        MealEntity meal = mealService.create(owner, recipeMealRequest(recipeId, new BigDecimal("1")));

        // the salt row of the WHO dimension must reflect the frozen 0.4 g/100 g, not the new 40
        assertThat(saltGramsOf(meal.getBreakdown())).isLessThan(5.0);
    }
```

A `recipeMealRequest(...)` és a breakdown-ból só-grammot kiolvasó `saltGramsOf(...)` helpert a fájl (illetve a `MealOverridesScoringIT`) meglévő mintája szerint írd meg — ott már van példa a WHO-dimenzió sorainak kiolvasására.

- [ ] **Step 2: Futtasd — bukik**

```bash
cd backend && ./mvnw clean test -Dtest=MealServiceIT
```

Elvárt: FAIL — a só a driftelt 40-es értékből számolódik.

- [ ] **Step 3: Írd át a `toScoredLine`-t fagyott tényekre**

`MealService.java`:

```java
    private ScoredLine toScoredLine(UUID userId, MealItemEntity item) {
        BigDecimal per = item.getSnapshotPer() == null || item.getSnapshotPer().signum() == 0
            ? BigDecimal.ONE : item.getSnapshotPer();
        BigDecimal factor = item.getAmount().divide(per, 6, RoundingMode.HALF_UP);
        // Frozen facts (mezo-m6uv): the item's OWN snapshot, scaled by the same factor as the
        // macros. A pantry row that drifted after the log can no longer rewrite this meal's score.
        boolean hasFacts = item.getSnapshotFiberG() != null || item.getSnapshotSugarG() != null
            || item.getSnapshotSaltG() != null || item.getSnapshotSaturatedFatG() != null;
        // `category` is a plant-diversity input, not a nutrition fact — it stays a live pantry read
        // (freezing it belongs with the NOVA sibling, mezo-4tzf). A recipe line is a composite:
        // honest null, exactly as before.
        String category = "pantry".equals(item.getSource())
            ? pantryCategory(userId, item.getPantryItemId()) : null;
        String amountLabel = item.getAmount().stripTrailingZeros().toPlainString() + item.getUnit();
        return new ScoredLine(
            item.getSnapshotName(), amountLabel,
            scaled(item.getSnapshotKcal(), factor), scaled(item.getSnapshotProteinG(), factor),
            scaled(item.getSnapshotCarbsG(), factor), scaled(item.getSnapshotFatG(), factor),
            item.getSnapshotNova(),
            scaleFact(item.getSnapshotFiberG(), factor), scaleFact(item.getSnapshotSugarG(), factor),
            scaleFact(item.getSnapshotSaltG(), factor),
            scaleFact(item.getSnapshotSaturatedFatG(), factor),
            hasFacts, category, gramAmount(item.getAmount(), item.getUnit()));
    }

    /** The live pantry category of a pantry-arm line (plant-diversity input); null when the row is gone. */
    private String pantryCategory(UUID userId, UUID pantryItemId) {
        return pantryItemRepository.findByIdAndCreatedByAndDeletedFalse(pantryItemId, userId)
            .map(PantryItemEntity::getCategory)
            .orElse(null);
    }
```

Majd **töröld** a holt kódot: a `Facts` record, `pantryFacts`, `recipeFacts`, `addFact`. A `scaleFact` marad. Frissítsd az `applyScore` javadocját: „nutrition-quality facts resolved from the LIVE sources" → „from the item's FROZEN snapshot (mezo-m6uv)". A fordító megmutatja a feleslegessé vált importokat (`Collectors`, `Function`, `RecipeIngredientEntity` — csak akkor töröld, ha tényleg nincs más használatuk, pl. a `dominantNova` még használhatja).

- [ ] **Step 4: Futtasd — zöld**

```bash
cd backend && ./mvnw clean test -Dtest='MealServiceIT+MealApiIT+MealOverridesScoringIT+MealItemRecipeOverridesIT'
```

Elvárt: PASS. Ha a `MealOverridesScoringIT` bukik, nézd meg, mit vár: a „0-ra nullázott sor csökkenti a sót" viselkedés a fagyott úton is él (a `rollupNutrientsWithOverrides` 0 amountnál 0-t ad), a **konkrét grammérték** viszont eltérhet a snapshot 1-tizedes kerekítése miatt — ilyenkor az asszertálást igazítsd a fagyott értékhez, ne a szabályt lazítsd.

- [ ] **Step 5: Írd meg a recept-oldali bukó tesztet**

`RecipeBreakdownApiIT.java`:

```java
    @Test
    void testGetBreakdown_shouldUseFrozenFacts_whenThePantryRowDriftedAfterSave() {
        PantryItemEntity source = pantryItemPopulator.createFoodWithNutrients(ownerId(), "Túró");
        UUID recipeId = recipePopulator.createRecipe(ownerId(), source.getId()).getId();
        source.setFiberG(new BigDecimal("90"));
        pantryItemRepository.saveAndFlush(source);

        RecipeBreakdownResponse body = getOk("/api/recipe/" + recipeId + "/breakdown",
            RecipeBreakdownResponse.class);

        assertThat(fiberGramsOf(body.getBreakdown())).isLessThan(20.0); // frozen 3.2/100g, not 90
    }
```

- [ ] **Step 6: Állítsd át a `fitLines`-t**

`RecipeService.fitLines` — a `factFactor` blokk **törlése**, és a négy tény a fagyott snapshotból, a **makró-`factor`-ral**:

```java
            PantryItemEntity p = pantryById.get(line.getPantryItemId());
            // Frozen facts (mezo-m6uv): same snapshot, same factor as the macros — the separate
            // live-pantry factFactor is gone. NOVA + category stay live reads (cf. mezo-4tzf).
            boolean hasFacts = line.getSnapshotFiberG() != null || line.getSnapshotSugarG() != null
                || line.getSnapshotSaltG() != null || line.getSnapshotSaturatedFatG() != null;
            return new ScoredLine(
                line.getSnapshotName(),
                line.getAmount().stripTrailingZeros().toPlainString() + line.getUnit(),
                mul(line.getSnapshotKcal(), factor), mul(line.getSnapshotProteinG(), factor),
                mul(line.getSnapshotCarbsG(), factor), mul(line.getSnapshotFatG(), factor),
                p == null ? null : p.getNova(),
                mulOrNull(line.getSnapshotFiberG(), factor),
                mulOrNull(line.getSnapshotSugarG(), factor),
                mulOrNull(line.getSnapshotSaltG(), factor),
                mulOrNull(line.getSnapshotSaturatedFatG(), factor),
                hasFacts,
                p == null ? null : p.getCategory(),
                mulOrNull(gramAmount(line.getAmount(), line.getUnit()), servingScale));
```

Frissítsd a metódus javadocját is („nutrition-quality facts from the LIVE pantry rows" → „from the frozen line snapshots (mezo-m6uv); NOVA + category stay live").

- [ ] **Step 7: Futtasd a teljes recept- és meal-készletet**

```bash
cd backend && ./mvnw clean test -Dtest='Recipe*+Meal*+FuelDay*'
```

Elvárt: PASS.

- [ ] **Step 8: Commit**

```bash
git add backend/src/main/java backend/src/test/java
git commit -m "refactor(nutrition): a scoring a fagyott tápérték-snapshotot olvassa, nem a live kamrát (mezo-m6uv)"
```

---

### Task 7: FE — `Nutrients` típus és a `recipeMacros` képletek

**Files:**
- Modify: `frontend/src/data/types.ts`
- Modify: `frontend/src/data/fuel/recipeMacros.ts`
- Test: `frontend/src/data/fuel/recipeMacros.test.ts`

**Interfaces:**
- Consumes: —
- Produces (a következő taskok ezekre hivatkoznak):
  - `Nutrients` típus (`@/data/types`): `{ fiberG: number | null; sugarG: number | null; saltG: number | null; saturatedFatG: number | null }`, és `nutrients?: Nutrients` a `Recipe`, `RecipeIngredientLine`, `FuelMeal`, `MealItemLine` alakokon.
  - `@/data/fuel/recipeMacros`: `NO_NUTRIENTS: Nutrients` · `roundGram(n: number | null | undefined): number | null` · `lineNutrients(amount: number, per: number, src: Nutrients): Nutrients` · `sumNutrients(list: Nutrients[]): Nutrients` · `scaleNutrients(n: Nutrients, mult: number): Nutrients` · `rescaleFrozenNutrients(n: Nutrients | undefined, amount: number, originalAmount: number): Nutrients` · `computeRecipeNutrients(lines: RecipeIngredientLine[]): Nutrients` · `computeRecipeNutrientsWithOverrides(lines: RecipeIngredientLine[], ingredients: Ingredient[], overrides: Record<number, number>): Nutrients`.
  - A meglévő `lineContribution` / `computeRecipeMacros*` **aláírása nem változik** (a tápértékek külön függvényekben élnek, hogy a meglévő hívók és tesztek érintetlenek maradjanak).

- [ ] **Step 1: Írd meg a bukó teszteket**

`frontend/src/data/fuel/recipeMacros.test.ts` — a fájl végére:

```ts
import {
  NO_NUTRIENTS, lineNutrients, sumNutrients, computeRecipeNutrients,
  computeRecipeNutrientsWithOverrides, rescaleFrozenNutrients,
} from '@/data/fuel/recipeMacros'

test('lineNutrients scales per-basis facts and keeps three decimals', () => {
  const src = { fiberG: 3.25, sugarG: 4.1, saltG: 0.4, saturatedFatG: 2.8 }
  expect(lineNutrients(200, 100, src)).toEqual({ fiberG: 6.5, sugarG: 8.2, saltG: 0.8, saturatedFatG: 5.6 })
})

// The FE twin of the backend's boundary test (MealApiIT, mezo-m6uv): a small salt contribution must
// NOT collapse to 0.1 the way one-decimal storage rounding did. Fails if roundGram goes back to /10.
test('lineNutrients keeps a small salt contribution intact instead of rounding it up', () => {
  const src = { fiberG: null, sugarG: null, saltG: 0.4, saturatedFatG: null }
  expect(lineNutrients(20, 100, src).saltG).toBe(0.08)
})

test('lineNutrients keeps a missing fact null — never 0', () => {
  const src = { fiberG: null, sugarG: 4, saltG: null, saturatedFatG: null }
  expect(lineNutrients(100, 100, src)).toEqual({ fiberG: null, sugarG: 4, saltG: null, saturatedFatG: null })
})

test('sumNutrients is null-preserving: partial sum, null only when every line is null', () => {
  const withFacts = { fiberG: 3, sugarG: null, saltG: 0.4, saturatedFatG: null }
  expect(sumNutrients([withFacts, NO_NUTRIENTS])).toEqual({ fiberG: 3, sugarG: null, saltG: 0.4, saturatedFatG: null })
  expect(sumNutrients([NO_NUTRIENTS, NO_NUTRIENTS])).toEqual(NO_NUTRIENTS)
})

test('an empty override map reproduces the plain nutrient rollup', () => {
  const lines = [
    { refId: 'a', amount: 200, unit: 'g', nutrients: { fiberG: 6.4, sugarG: null, saltG: 0.8, saturatedFatG: 5.6 } },
    { refId: 'b', amount: 150, unit: 'g' },
  ]
  expect(computeRecipeNutrientsWithOverrides(lines, [], {})).toEqual(computeRecipeNutrients(lines))
})

test('an overridden line rescales from the live source when one resolves', () => {
  const lines = [{ refId: 'a', amount: 200, unit: 'g', nutrients: { fiberG: 6.4, sugarG: null, saltG: 0.8, saturatedFatG: 5.6 } }]
  const ingredients = [{
    id: 'a', name: 'Túró', brand: '', source: 'manual' as const, category: 'dairy',
    per: 100, unit: 'g', macros: { kcal: 110, p: 13, c: 4, f: 4.5 },
    fiberG: 3.2, sugarG: null, saltG: 0.4, saturatedFatG: 2.8,
    price: 0, priceUnit: '', pkg: '', micros: [], nova: 1 as const, stock: null,
    lastUsed: '', usedInRecipes: 0,
  }]
  expect(computeRecipeNutrientsWithOverrides(lines, ingredients, { 0: 100 }).fiberG).toBe(3.2)
})

test('rescaleFrozenNutrients falls back to the frozen contribution when the source is gone', () => {
  const frozen = { fiberG: 6.4, sugarG: null, saltG: 0.8, saturatedFatG: 5.6 }
  expect(rescaleFrozenNutrients(frozen, 100, 200)).toEqual({ fiberG: 3.2, sugarG: null, saltG: 0.4, saturatedFatG: 2.8 })
  expect(rescaleFrozenNutrients(undefined, 100, 200)).toEqual(NO_NUTRIENTS)
})
```

Az `Ingredient` fixtúra mezőit a `@/data/types` `Ingredient` interfészéhez igazítsd — ha valamelyik kötelező mező hiányzik, a TS azonnal jelzi.

- [ ] **Step 2: Futtasd — bukik**

```bash
cd frontend && pnpm test -- recipeMacros
```

Elvárt: FAIL — `lineNutrients is not a function` / TS-hiba az importra.

- [ ] **Step 3: Vedd fel a típust**

`frontend/src/data/types.ts` — a `Recipe` blokk **elé**:

```ts
/** Nutrition-quality facts, frozen per line like the macros (mezo-m6uv). `null` = the source
 *  carried no value — NOT zero; a rollup field is null only when every line was null. Grams. */
export interface Nutrients {
  fiberG: number | null
  sugarG: number | null
  saltG: number | null
  saturatedFatG: number | null
}
```

majd `nutrients?: Nutrients` a `RecipeIngredientLine`-ra (a `contribution` után), a `Recipe`-re (a `macros` után), a `FuelMeal`-re (a meglévő `fiberG` mellé) és a `MealItemLine`-ra (a `contribution` után).

- [ ] **Step 4: Implementáld a képleteket**

`frontend/src/data/fuel/recipeMacros.ts` — a fájl végére (import: `Nutrients` a `@/data/types`-ból):

```ts
export const NO_NUTRIENTS: Nutrients = { fiberG: null, sugarG: null, saltG: null, saturatedFatG: null }

const NUTRIENT_KEYS = ['fiberG', 'sugarG', 'saltG', 'saturatedFatG'] as const

/**
 * Grams to THREE decimals — mirrors `RecipeMapper.scaledGram` (BigDecimal setScale(3, HALF_UP)).
 * Storage/summation precision, NOT display: `formatGram` does the one-decimal rounding at the edge.
 * Rounding per line at one decimal turned a true 0.04 g salt contribution into 0.1 g and compounded
 * across lines. The `+ EPSILON` guards the float representation (0.0155 * 1000 is 15.499999999999998,
 * which would round DOWN); `null` stays null so "no data" never becomes a fake 0.
 */
export function roundGram(n: number | null | undefined): number | null {
  return n == null ? null : Math.round(n * 1000 + Number.EPSILON) / 1000
}

/** One line's nutrient facts at `amount`, from a per-`per`-basis source. */
export function lineNutrients(amount: number, per: number, src: Nutrients): Nutrients {
  const factor = amount / (per || 1)
  return {
    fiberG: roundGram(src.fiberG == null ? null : src.fiberG * factor),
    sugarG: roundGram(src.sugarG == null ? null : src.sugarG * factor),
    saltG: roundGram(src.saltG == null ? null : src.saltG * factor),
    saturatedFatG: roundGram(src.saturatedFatG == null ? null : src.saturatedFatG * factor),
  }
}

/** Multiply every present fact (e.g. whole-recipe → per adag). */
export function scaleNutrients(n: Nutrients, mult: number): Nutrients {
  return lineNutrients(mult, 1, n)
}

/** Null-preserving Σ — null only when EVERY input was null for that field (cf. RecipeMapper.addNullable). */
export function sumNutrients(list: Nutrients[]): Nutrients {
  const out: Nutrients = { ...NO_NUTRIENTS }
  for (const n of list) {
    for (const k of NUTRIENT_KEYS) {
      const v = n[k]
      if (v != null) out[k] = (out[k] ?? 0) + v
    }
  }
  for (const k of NUTRIENT_KEYS) out[k] = roundGram(out[k])
  return out
}

/** Rescale a frozen nutrient contribution to a different amount — the `rescaleFrozen` sibling. */
export function rescaleFrozenNutrients(
  n: Nutrients | undefined, amount: number, originalAmount: number,
): Nutrients {
  if (!n || !originalAmount) return { ...NO_NUTRIENTS }
  return lineNutrients(amount, originalAmount, n)
}

/** Whole-recipe nutrients = null-preserving Σ of the line facts. */
export function computeRecipeNutrients(lines: RecipeIngredientLine[]): Nutrients {
  return sumNutrients(lines.map(l => l.nutrients ?? NO_NUTRIENTS))
}

/**
 * Whole-recipe nutrients with per-line amount substitutions — the nutrient twin of
 * `computeRecipeMacrosWithOverrides`, branching identically: an UNTOUCHED line keeps the
 * server-frozen facts; an OVERRIDDEN line is rescaled from the live pantry row when one resolves,
 * else from its own frozen facts (the backend also scales its own snapshot, never the pantry).
 */
export function computeRecipeNutrientsWithOverrides(
  lines: RecipeIngredientLine[], ingredients: Ingredient[], overrides: Record<number, number>,
): Nutrients {
  return sumNutrients(lines.map((line, i) => {
    const amount = overrides[i]
    if (amount === undefined) return line.nutrients ?? NO_NUTRIENTS
    const ing = ingredients.find(x => x.id === line.refId)
    return ing
      ? lineNutrients(amount, ing.per, {
        fiberG: ing.fiberG ?? null, sugarG: ing.sugarG ?? null,
        saltG: ing.saltG ?? null, saturatedFatG: ing.saturatedFatG ?? null,
      })
      : rescaleFrozenNutrients(line.nutrients, amount, line.amount)
  }))
}
```

és az `enrichLine`-t bővítsd, hogy a tápértéket is kitöltse:

```ts
export function enrichLine(line: RecipeIngredientLine, ing: Ingredient | undefined): RecipeIngredientLine {
  if (!ing) return { ...line, name: line.refId, contribution: { kcal: 0, p: 0, c: 0, f: 0 }, nutrients: { ...NO_NUTRIENTS } }
  return {
    ...line,
    name: ing.name,
    contribution: lineContribution(line.amount, ing.per, ing.macros),
    nutrients: lineNutrients(line.amount, ing.per, {
      fiberG: ing.fiberG ?? null, sugarG: ing.sugarG ?? null,
      saltG: ing.saltG ?? null, saturatedFatG: ing.saturatedFatG ?? null,
    }),
  }
}
```

- [ ] **Step 5: Futtasd — zöld mindkét módban**

```bash
cd frontend && pnpm test -- recipeMacros && VITE_USE_MOCK=true pnpm test -- recipeMacros
```

Elvárt: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/data/types.ts frontend/src/data/fuel/recipeMacros.ts frontend/src/data/fuel/recipeMacros.test.ts
git commit -m "feat(fuel): Nutrients típus + null-őrző tápérték-képletek a FE-n (mezo-m6uv)"
```

---

### Task 8: FE — API-mappelés és a mock kamra-seed tápértékei

**Files:**
- Modify: `frontend/src/data/fuel/recipeApi.ts`
- Modify: `frontend/src/data/fuel/mealApi.ts`
- Modify: `frontend/src/data/fuel/pantry.ts`
- Test: `frontend/src/data/fuel/recipeApi.test.ts`

**Interfaces:**
- Consumes: Task 1 generált típusok, Task 7 `Nutrients` + `NO_NUTRIENTS`.
- Produces: real módban `Recipe.nutrients` / `RecipeIngredientLine.nutrients` / `FuelMeal.nutrients` kitöltve; mock módban a receptek tápértéke a kamra-seedből **származtatva** (`enrichLine` + `computeRecipeNutrients` — a `pantry.ts` végi `recipes` map már ezt az utat járja a makrókkal).

- [ ] **Step 1: Írd meg a bukó tesztet**

`frontend/src/data/fuel/recipeApi.test.ts` — a meglévő `fromResponse` tesztek mellé:

```ts
test('fromResponse carries the nutrients rollup and the per-line facts', () => {
  const recipe = fromResponse({
    ...baseResponse,
    nutrients: { fiberG: 6.4, sugarG: null, saltG: 0.8, saturatedFatG: 5.6 },
    ingredients: [{
      ...baseResponse.ingredients[0],
      nutrients: { fiberG: 6.4, sugarG: null, saltG: 0.8, saturatedFatG: 5.6 },
    }],
  })

  expect(recipe.nutrients).toEqual({ fiberG: 6.4, sugarG: null, saltG: 0.8, saturatedFatG: 5.6 })
  expect(recipe.ingredients[0].nutrients?.saltG).toBe(0.8)
})

test('fromResponse yields all-null nutrients when the wire omits them', () => {
  const recipe = fromResponse(baseResponse)
  expect(recipe.nutrients).toEqual({ fiberG: null, sugarG: null, saltG: null, saturatedFatG: null })
})
```

A `baseResponse` fixtúrát a fájl meglévő `fromResponse` tesztjéből vedd (vagy emeld ki konstansba, ha még inline van).

- [ ] **Step 2: Futtasd — bukik**

```bash
cd frontend && pnpm test -- recipeApi
```

Elvárt: FAIL — `recipe.nutrients` `undefined`.

- [ ] **Step 3: Mappelj a recipeApi-ban**

`recipeApi.ts` — vedd fel a normalizáló helpert és használd mindkét szinten:

```ts
/** Wire `nutrients` (minden mező opcionális) → domain Nutrients (minden mező jelen van, null-lal). */
function toNutrients(n: components['schemas']['Nutrients'] | undefined): Nutrients {
  return {
    fiberG: n?.fiberG ?? null,
    sugarG: n?.sugarG ?? null,
    saltG: n?.saltG ?? null,
    saturatedFatG: n?.saturatedFatG ?? null,
  }
}
```

`fromResponse`-ban: a line-mappelésbe `nutrients: toNutrients(l.nutrients)`, a recept-szintre `nutrients: toNutrients(r.nutrients)`.

- [ ] **Step 4: Mappelj a mealApi-ban — és kösd élővé a Rost gyűrűt**

`mealApi.ts` `fromResponse`-ban (a `toNutrients`-et importáld a `recipeApi`-ból, vagy — ha az körkörös importot okozna — emeld a `recipeMacros.ts`-be és onnan használja mindkettő):

```ts
    nutrients: toNutrients(r.nutrients),
    // Rost a napi hero-gyűrűhöz (keretHero.ts): eddig csak a mock seed hordozta, real módban
    // konstans 0 volt — most a fagyott tápérték-rollupból jön (mezo-m6uv, a mezo-c9t5 maradéka).
    fiberG: r.nutrients?.fiberG ?? null,
```

az item-mappelésbe pedig `nutrients: toNutrients(l.nutrients)`.

- [ ] **Step 5: Add meg a mock kamra-seed tápértékeit**

`frontend/src/data/fuel/pantry.ts` — a `ingredientsBase` **élelmiszer** sorai kapják meg a négy mezőt a `macros` után, valósághű per-100 g értékekkel. Kötelező minta:

```ts
    macros: { kcal: 372, p: 13.5, c: 60.0, f: 7.0 },
    fiberG: 10.6, sugarG: 1.0, saltG: 0.02, saturatedFatG: 1.2,   // ing-zab
```

- Legalább **8** élelmiszer-sor kapjon mind a négyet (zab, túró, áfonya, méz, mandula, csirkemell, édesburgonya, lazac — a `rec-1`–`rec-3` receptek így teljes tápértéket kapnak).
- **Legalább egy** sor maradjon szándékosan tápérték nélkül (javaslat: `ing-spenot`), hogy a hozzávaló-soronkénti `—` és a részleges rollup mock módban is látszódjon és tesztelhető legyen.
- A `recipes` export **nem** változik: a fájl végi map már `enrichLine` + `computeRecipeMacros`-t hív, ide csak a tápérték-rollup hívása kerül be:

```ts
  const macros = computeRecipeMacros(enrichedIngredients)
  const nutrients = computeRecipeNutrients(enrichedIngredients)

  return { ...r, ingredients: enrichedIngredients, macros, nutrients, recentLogs, templateBreakdown }
```

(az importot bővítsd: `import { enrichLine, computeRecipeMacros, computeRecipeNutrients } from '@/data/fuel/recipeMacros'`)

- [ ] **Step 6: Futtasd mindkét módban**

```bash
cd frontend && pnpm test -- recipeApi mealApi && VITE_USE_MOCK=true pnpm test
```

Elvárt: PASS. Ha a mock-módú `keretHero` teszt elmozdul a seed-változás miatt, a **teszt elvárását** igazítsd az új seedhez (a szabály nem változott).

- [ ] **Step 7: Commit**

```bash
git add frontend/src/data/fuel
git commit -m "feat(fuel): tápérték-mappelés a recept/meal API-n + mock kamra-seed értékek (mezo-m6uv)"
```

---

### Task 9: `NutrientCells` komponens + gramm-formázó

**Files:**
- Create: `frontend/src/shared/lib/grams.ts`
- Create: `frontend/src/shared/lib/grams.test.ts`
- Create: `frontend/src/features/fuel/components/NutrientCells.tsx`
- Create: `frontend/src/features/fuel/components/NutrientCells.test.tsx`

**Interfaces:**
- Consumes: Task 7 `Nutrients`.
- Produces:
  - `formatGram(v: number | null | undefined): string` (`@/shared/lib/grams`) — `—` null-ra, magyar tizedesvessző, max 1 tizedes, egész értéknél nincs `,0`.
  - `NutrientCells` (`@/features/fuel/components/NutrientCells`), props: `{ nutrients: Nutrients; perLabel?: string; size?: 'sm' | 'md'; empty?: 'hide' | 'dashes' }` — `empty` default `'hide'`.

- [ ] **Step 1: Írd meg a bukó teszteket**

`frontend/src/shared/lib/grams.test.ts`:

```ts
import { formatGram } from '@/shared/lib/grams'

test('formatGram prints Hungarian decimals, drops a trailing zero, and dashes a null', () => {
  expect(formatGram(6)).toBe('6')
  expect(formatGram(6.0)).toBe('6')
  expect(formatGram(0.4)).toBe('0,4')
  expect(formatGram(12.45)).toBe('12,5')
  expect(formatGram(null)).toBe('—')
  expect(formatGram(undefined)).toBe('—')
})

// Since the storage precision went to three decimals (the user's 2026-08-11 ruling), a real but tiny
// value reaches the display layer. Printing "0" for it would read as "no salt", which is the same lie
// as printing 0 for a null — so it gets its own marker. An honest 0 still prints as 0.
test('formatGram marks a present-but-sub-0,1 value instead of printing it as zero', () => {
  expect(formatGram(0.04)).toBe('<0,1')
  expect(formatGram(0.001)).toBe('<0,1')
  expect(formatGram(0)).toBe('0')
})
```

`frontend/src/features/fuel/components/NutrientCells.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { NutrientCells } from '@/features/fuel/components/NutrientCells'

test('renders the four nutrients in order with their labels', () => {
  render(<NutrientCells nutrients={{ fiberG: 6, sugarG: 12.5, saltG: 0.4, saturatedFatG: 2.1 }} />)
  expect(screen.getByText('Telített')).toBeInTheDocument()
  expect(screen.getByText('Cukor')).toBeInTheDocument()
  expect(screen.getByText('Rost')).toBeInTheDocument()
  expect(screen.getByText('Só')).toBeInTheDocument()
  expect(screen.getByText('2,1')).toBeInTheDocument()
  expect(screen.getByText('0,4')).toBeInTheDocument()
})

test('dashes a single missing fact', () => {
  render(<NutrientCells nutrients={{ fiberG: null, sugarG: 12, saltG: 0.4, saturatedFatG: 2.1 }} />)
  expect(screen.getByText('—')).toBeInTheDocument()
})

test('renders nothing when every fact is missing and empty is hide (the default)', () => {
  const { container } = render(<NutrientCells nutrients={{ fiberG: null, sugarG: null, saltG: null, saturatedFatG: null }} />)
  expect(container).toBeEmptyDOMElement()
})

test('renders four dashes when every fact is missing and empty is dashes', () => {
  render(<NutrientCells nutrients={{ fiberG: null, sugarG: null, saltG: null, saturatedFatG: null }} empty="dashes" />)
  expect(screen.getAllByText('—')).toHaveLength(4)
})
```

- [ ] **Step 2: Futtasd — bukik**

```bash
cd frontend && pnpm test -- grams NutrientCells
```

Elvárt: FAIL — a modulok nem léteznek.

- [ ] **Step 3: Írd meg a formázót**

`frontend/src/shared/lib/grams.ts`:

```ts
/**
 * Gram display for the nutrition facts (mezo-m6uv): Hungarian decimal comma, at most one decimal,
 * no trailing `,0`, and an em-dash for "no data" — a missing fact is never printed as 0.
 * Storage keeps three decimals, so a real value can be smaller than the display step: a positive
 * value that would round to 0 prints as `<0,1` rather than `0`, because "0" reads as "none" and
 * that is the same lie as printing 0 for a null. A genuine 0 still prints as `0`.
 * The `+ EPSILON` guards the float representation (12.45 * 10 is 124.49999999999999).
 */
export function formatGram(v: number | null | undefined): string {
  if (v == null) return '—'
  const rounded = Math.round(v * 10 + Number.EPSILON) / 10
  if (rounded === 0 && v > 0) return '<0,1'
  return (Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)).replace('.', ',')
}
```

- [ ] **Step 4: Írd meg a komponenst**

`frontend/src/features/fuel/components/NutrientCells.tsx`:

```tsx
// ============================================================
// Mezo · NutrientCells (tápérték-strip: telített / cukor / rost / só)
// A MacroCells halványabb testvére, ugyanazzal a chamfer-cella nyelvvel — a recept-hero,
// a hozzávaló-sorok, a LogMealSheet és az ImportItemSheet preview-ja használja (mezo-m6uv).
// A `null` itt információ: `—`-ként jelenik meg, mert a forrás nem hordozott értéket (nem 0 g).
// ============================================================
import type { Nutrients } from '@/data/types'
import { formatGram } from '@/shared/lib/grams'

export interface NutrientCellsProps {
  nutrients: Nutrients
  perLabel?: string
  size?: 'sm' | 'md'
  /** 'hide' (default): mind-null esetén nem renderel · 'dashes': kirajzolja a négy `—`-t. */
  empty?: 'hide' | 'dashes'
}

const CELLS = [
  { key: 'saturatedFatG' as const, label: 'Telített' },
  { key: 'sugarG' as const, label: 'Cukor' },
  { key: 'fiberG' as const, label: 'Rost' },
  { key: 'saltG' as const, label: 'Só' },
]

export function NutrientCells({ nutrients, perLabel, size = 'sm', empty = 'hide' }: NutrientCellsProps) {
  const allMissing = CELLS.every(c => nutrients[c.key] == null)
  if (allMissing && empty === 'hide') return null
  const valFs = size === 'md' ? 13 : 11.5
  return (
    <div className="row" style={{ gap: 6, alignItems: 'stretch' }}>
      {perLabel && (
        <span
          className="label-mono"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 7.5, letterSpacing: '0.06em', color: 'var(--text-quaternary)',
            writingMode: 'vertical-rl', transform: 'rotate(180deg)', padding: '0 1px', flexShrink: 0,
          }}
        >
          {perLabel}
        </span>
      )}
      {CELLS.map(c => (
        <div
          key={c.key}
          className="rad-12"
          style={{ flex: 1, textAlign: 'center', padding: '5px 2px', background: 'var(--surface-glass)' }}
        >
          <div style={{ fontVariantNumeric: 'tabular-nums', fontSize: valFs, fontWeight: 600, color: 'var(--text-secondary)' }}>
            {formatGram(nutrients[c.key])}
          </div>
          <div className="label-mono" style={{ fontSize: 7, letterSpacing: '0.1em', color: 'var(--text-tertiary)', marginTop: 2 }}>
            {c.label}
          </div>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 5: Futtasd — zöld**

```bash
cd frontend && pnpm test -- grams NutrientCells
```

Elvárt: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/shared/lib/grams.ts frontend/src/shared/lib/grams.test.ts frontend/src/features/fuel/components/NutrientCells.tsx frontend/src/features/fuel/components/NutrientCells.test.tsx
git commit -m "feat(fuel): NutrientCells strip + gramm-formázó (mezo-m6uv)"
```

---

### Task 10: RecipeDetailPage — hero-sor + hozzávaló-sorok

**Files:**
- Modify: `frontend/src/features/fuel/pages/RecipeDetailPage.tsx`
- Test: `frontend/src/features/fuel/pages/RecipeDetailPage.test.tsx`

**Interfaces:**
- Consumes: Task 7 `Nutrients`/`NO_NUTRIENTS`/`scaleNutrients`, Task 9 `NutrientCells`.
- Produces: —

- [ ] **Step 1: Írd meg a bukó tesztet**

`RecipeDetailPage.test.tsx` — a fájl meglévő render-helperjével (a `/adag` default bázis mellett):

```tsx
test('a tápérték-sor követi a /adag ↔ egész váltót', async () => {
  renderRecipeDetail('rec-1') // a fájl meglévő helpere; mock seed, servings === 1
  // a hero tápérték-sora kirajzolódik a makrók alatt
  expect(await screen.findByText('Telített')).toBeInTheDocument()
  expect(screen.getByText('Rost')).toBeInTheDocument()
})

test('a hozzávalók fülön a tápérték nélküli sor gondolatjelet mutat', async () => {
  renderRecipeDetail('rec-2') // ing-spenot: szándékosan tápérték nélküli seed-sor
  await userEvent.click(screen.getByRole('tab', { name: /Hozzávalók/ }))
  expect(screen.getAllByText('—').length).toBeGreaterThan(0)
})
```

A `renderRecipeDetail` nevét/aláírását a fájl meglévő tesztjeiből vedd át.

- [ ] **Step 2: Futtasd — bukik**

```bash
cd frontend && VITE_USE_MOCK=true pnpm test -- RecipeDetailPage
```

Elvárt: FAIL — `Telített` nincs a DOM-ban.

- [ ] **Step 3: Implementáld**

`RecipeDetailPage.tsx` — importok:

```tsx
import { NutrientCells } from '@/features/fuel/components/NutrientCells'
import { NO_NUTRIENTS, scaleNutrients } from '@/data/fuel/recipeMacros'
```

a `byBasis` mellé a tápérték-párja:

```tsx
function nutrientsByBasis(n: Nutrients, basis: ServingBasis, servings: number): Nutrients {
  return basis === 'whole' ? n : scaleNutrients(n, 1 / Math.max(1, servings))
}
```

a makró-hero grid **után**:

```tsx
      <div style={{ marginTop: 8 }}>
        <NutrientCells nutrients={nutrientsByBasis(recipe.nutrients ?? NO_NUTRIENTS, basis, recipe.servings)} size="md" />
      </div>
```

és a Hozzávalók fül sorában, a `MacroCells` **után**:

```tsx
                <div style={{ marginTop: 6 }}>
                  <NutrientCells nutrients={line.nutrients ?? NO_NUTRIENTS} empty="dashes" />
                </div>
```

- [ ] **Step 4: Futtasd — zöld**

```bash
cd frontend && VITE_USE_MOCK=true pnpm test -- RecipeDetailPage && pnpm test -- RecipeDetailPage
```

Elvárt: PASS mindkét módban.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/fuel/pages/RecipeDetailPage.tsx frontend/src/features/fuel/pages/RecipeDetailPage.test.tsx
git commit -m "feat(fuel): tápértékek a recept-detail heróján és hozzávaló-sorain (mezo-m6uv)"
```

---

### Task 11: LogMealSheet — soronkénti és összesített tápérték

**Files:**
- Modify: `frontend/src/features/fuel/sheets/LogMealSheet.tsx`
- Test: `frontend/src/features/fuel/sheets/LogMealSheet.overrides.test.tsx`

**Interfaces:**
- Consumes: Task 7 (`computeRecipeNutrientsWithOverrides`, `computeRecipeNutrients`, `scaleNutrients`, `sumNutrients`, `lineNutrients`, `NO_NUTRIENTS`), Task 9 `NutrientCells`.
- Produces: —

- [ ] **Step 1: Írd meg a bukó tesztet**

`LogMealSheet.overrides.test.tsx` — a fájl meglévő „nyisd ki a finomhangolást és állítsd át egy sort" mintájára:

```tsx
test('az összesítő tápértéke követi a hozzávaló-override-ot', async () => {
  renderLogMealSheet({ source: 'recipe', recipeId: 'rec-1' }) // a fájl meglévő helpere
  expect(await screen.findByText('Rost')).toBeInTheDocument()

  await userEvent.click(screen.getByRole('button', { name: 'Hozzávalók finomhangolása' }))
  const before = screen.getAllByText(/^\d+([,.]\d)?$/).map(n => n.textContent)

  await userEvent.click(screen.getAllByRole('button', { name: /csökkentés/ })[1]) // egy hozzávaló-sor −
  const after = screen.getAllByText(/^\d+([,.]\d)?$/).map(n => n.textContent)

  expect(after).not.toEqual(before)
})
```

Ha a fájlban van pontosabb, `aria-label`-re épülő kiválasztási mintázat egy konkrét cellára, azt használd a regexes megoldás helyett.

- [ ] **Step 2: Futtasd — bukik**

```bash
cd frontend && VITE_USE_MOCK=true pnpm test -- LogMealSheet.overrides
```

Elvárt: FAIL — `Rost` nincs a DOM-ban.

- [ ] **Step 3: Implementáld**

`LogMealSheet.tsx` — importok:

```tsx
import { NutrientCells } from '@/features/fuel/components/NutrientCells'
import {
  computeRecipeMacrosWithOverrides, rescaleFrozen,
  computeRecipeNutrients, computeRecipeNutrientsWithOverrides,
  lineNutrients, scaleNutrients, sumNutrients, NO_NUTRIENTS,
} from '@/data/fuel/recipeMacros'
```

`lineMeta` — a recept-ág `return`-jébe a `contribution` mellé:

```tsx
      // A tápérték ugyanazt az utat járja, mint a makró: override-olt rollup ÷ adagszám × adag.
      const wholeNutrients = r && l.overrides && Object.keys(l.overrides).length
        ? computeRecipeNutrientsWithOverrides(r.ingredients, ingredients, l.overrides)
        : (r?.nutrients ?? (r ? computeRecipeNutrients(r.ingredients) : NO_NUTRIENTS))
```

```tsx
        nutrients: scaleNutrients(wholeNutrients, factor / s),
```

a kamra-ág `return`-jébe:

```tsx
      nutrients: lineNutrients(l.amount, per, {
        fiberG: ing?.fiberG ?? null, sugarG: ing?.sugarG ?? null,
        saltG: ing?.saltG ?? null, saturatedFatG: ing?.saturatedFatG ?? null,
      }),
```

a `total` mellé az összesített tápérték:

```tsx
  const totalNutrients = sumNutrients(resolved.map(({ meta }) => meta.nutrients))
```

és a két render-pont: a soronkénti `MacroCells` **után**

```tsx
                  <div style={{ marginTop: 6 }}>
                    <NutrientCells nutrients={meta.nutrients} />
                  </div>
```

illetve az „EZ AZ ÉTKEZÉS" `MacroCells` **után**

```tsx
              <div style={{ marginTop: 6 }}>
                <NutrientCells nutrients={totalNutrients} size="md" />
              </div>
```

- [ ] **Step 4: Futtasd — zöld**

```bash
cd frontend && VITE_USE_MOCK=true pnpm test -- LogMealSheet && pnpm test -- LogMealSheet
```

Elvárt: PASS (mindhárom LogMealSheet teszt-fájl).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/fuel/sheets/LogMealSheet.tsx frontend/src/features/fuel/sheets/LogMealSheet.overrides.test.tsx
git commit -m "feat(fuel): tápértékek a log-sheet sorain és összesítőjén (mezo-m6uv)"
```

---

### Task 12: ImportItemSheet — mind a három preview-ág

**Files:**
- Modify: `frontend/src/features/fuel/sheets/ImportItemSheet.tsx`
- Test: `frontend/src/features/fuel/sheets/ImportItemSheet.test.tsx`

**Interfaces:**
- Consumes: Task 9 `NutrientCells`.
- Produces: —

- [ ] **Step 1: Írd meg a bukó tesztet**

`ImportItemSheet.test.tsx` — a fájl meglévő OFF-keresés és Link-scrape mintáira építve:

```tsx
test('az OFF-találat visszaigazolása a telített/cukor/rost/só értéket is mutatja', async () => {
  renderImportSheet()                       // a fájl meglévő helpere
  await searchFor('skyr')                   // a fájl meglévő helpere
  expect(await screen.findByText('Telített')).toBeInTheDocument()
  expect(screen.getByText('Cukor')).toBeInTheDocument()
  expect(screen.getByText('Rost')).toBeInTheDocument()
  expect(screen.getByText('Só')).toBeInTheDocument()
})

test('a link-scrape draft visszaigazolása is mutatja a négy tápértéket', async () => {
  renderImportSheet()
  await scrapeUrl('https://gymbeam.hu/valami')   // a fájl meglévő helpere
  expect(await screen.findByText('Telített')).toBeInTheDocument()
  expect(screen.getByText('Só')).toBeInTheDocument()
})
```

Ha a mock lookup/scrape fixtúra nem hordoz tápértéket, **előbb** vedd fel a négy mezőt a mock draftba (`frontend/src/data/fuel/pantry.ts` lookup/scrape seed) — különben a `hide` default miatt nem is renderelődik a sor.

- [ ] **Step 2: Futtasd — bukik**

```bash
cd frontend && VITE_USE_MOCK=true pnpm test -- ImportItemSheet
```

Elvárt: FAIL.

- [ ] **Step 3: Implementáld**

`ImportItemSheet.tsx` — import + egy lokális normalizáló, hogy mindhárom ág ugyanazt hívja:

```tsx
import { NutrientCells } from '@/features/fuel/components/NutrientCells'
import type { Nutrients, PantryLookupItem } from '@/data/types'

/** Draft (minden tápérték-mező opcionális) → NutrientCells bemenet. */
function draftNutrients(d: PantryLookupItem): Nutrients {
  return {
    fiberG: d.fiberG ?? null,
    sugarG: d.sugarG ?? null,
    saltG: d.saltG ?? null,
    saturatedFatG: d.saturatedFatG ?? null,
  }
}
```

az OFF-ág `StatCell`-sora **után** (`picked != null && results[picked]` blokk):

```tsx
                  <div style={{ marginTop: 8 }}>
                    <NutrientCells nutrients={draftNutrients(results[picked])} />
                  </div>
```

és a Link/Fotó-ág `StatCell`-sora **után** (`draft != null` blokk):

```tsx
                  <div style={{ marginTop: 8 }}>
                    <NutrientCells nutrients={draftNutrients(draft)} />
                  </div>
```

(`PantryScrapeDraft extends PantryLookupItem`, tehát a `draftNutrients` mindkettőt fogadja.)

- [ ] **Step 4: Futtasd — zöld**

```bash
cd frontend && VITE_USE_MOCK=true pnpm test -- ImportItemSheet && pnpm test -- ImportItemSheet
```

Elvárt: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/fuel/sheets/ImportItemSheet.tsx frontend/src/features/fuel/sheets/ImportItemSheet.test.tsx frontend/src/data/fuel/pantry.ts
git commit -m "feat(fuel): telített/cukor/rost/só az import-visszaigazolásban mindhárom módban (mezo-m6uv)"
```

---

### Task 13: RecipeCard — `/adag` bázis (a bejelentés #2-es pontja)

**Files:**
- Modify: `frontend/src/features/fuel/components/RecipeCard.tsx`
- Test: `frontend/src/features/fuel/components/RecipeCard.test.tsx`
- Esetleg: `frontend/src/features/fuel/pages/FuelRecipesPage.test.tsx` (ha egész-recept értékre asszertál)

**Interfaces:**
- Consumes: —
- Produces: —

- [ ] **Step 1: Írd meg a bukó tesztet**

`RecipeCard.test.tsx`:

```tsx
test('a makró-strip egy adagra vetít és feliratozza a bázist', () => {
  const recipe = { ...baseRecipe, servings: 2, macros: { kcal: 800, p: 60, c: 80, f: 20 } }
  render(<RecipeCard recipe={recipe} onOpen={() => {}} />)

  expect(screen.getByText('400')).toBeInTheDocument()   // 800 / 2 adag
  expect(screen.getByText('30')).toBeInTheDocument()    // 60 / 2
  expect(screen.getByText('/adag')).toBeInTheDocument()
})
```

A `baseRecipe` fixtúrát a fájl meglévő tesztjéből vedd.

- [ ] **Step 2: Futtasd — bukik**

```bash
cd frontend && pnpm test -- RecipeCard
```

Elvárt: FAIL — `800` van a DOM-ban `400` helyett.

- [ ] **Step 3: Implementáld**

`RecipeCard.tsx` — a `totalMins` mellé:

```tsx
  // A kártya EGY ADAGOT mutat, mint a recept-detail heróján a default bázis és a MealPickerSheet —
  // az egész-recept értéke félrevezető volt egy több adagos receptnél (mezo-m6uv).
  const s = Math.max(1, recipe.servings)
  const perServing = {
    kcal: Math.round(recipe.macros.kcal / s),
    p: Math.round(recipe.macros.p / s),
    c: Math.round(recipe.macros.c / s),
    f: Math.round(recipe.macros.f / s),
  }
```

és a render-ben:

```tsx
        <MacroCells macros={perServing} perLabel="/adag" />
```

Frissítsd a fájl fejléc-kommentjében a „MacroCells strip (whole-recipe macros)" leírást is `(/adag)`-ra.

- [ ] **Step 4: Futtasd — zöld**

```bash
cd frontend && pnpm test -- RecipeCard FuelRecipesPage && VITE_USE_MOCK=true pnpm test -- RecipeCard FuelRecipesPage
```

Elvárt: PASS. Ha a `FuelRecipesPage.test.tsx` egész-recept értékre asszertált, igazítsd az adagra vetített értékre.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/fuel/components/RecipeCard.tsx frontend/src/features/fuel/components/RecipeCard.test.tsx frontend/src/features/fuel/pages/FuelRecipesPage.test.tsx
git commit -m "fix(fuel): a listás recept-kártya egy adagra vetít, nem az egész receptre (mezo-m6uv)"
```

---

### Task 14: Dokumentáció — ADR + feature-doc + lint

**Files:**
- Create: `docs/decisions/<következő sorszám>-freeze-nutrition-facts-per-line.md`
- Modify: `docs/features/fuel.md`

**Interfaces:**
- Consumes: minden korábbi task.
- Produces: —

- [ ] **Step 1: Nézd meg a következő ADR-sorszámot és a sablont**

```bash
ls docs/decisions/ | sort | tail -5 && sed -n '1,60p' docs/README.md
```

- [ ] **Step 2: Írd meg az ADR-t**

A `docs/README.md`-ben lévő ADR-sablon szerint, ezekkel a döntés-pontokkal:

- **Kontextus:** a makrók sorra fagyottak, a négy tápérték-tény viszont eddig **élő** kamra-olvasás volt (`RecipeService.fitLines`, `MealService.recipeFacts`) — ugyanaz a szám két úton, és egy kamra-szerkesztés visszamenőleg átírta egy régi recept/étkezés tápértékeit, miközben a kcal-ját nem.
- **Döntés:** a `fiberG`/`sugarG`/`saltG`/`saturatedFatG` a `recipe_ingredient` és `meal_item` sorára fagy, és a **scoring is a fagyott értéket olvassa**. Nullable oszlopok (a „nincs adat" nem 0), gramm 1 tizedes HALF_UP, null-őrző rollup.
- **Következmények:** egy kamra-tétel szerkesztése már nem írja át a régi receptek tápértékeit — friss érték a recept újramentésével jön (ugyanaz a szabály, mint a makróknál). A backfill a *mai* kamra-értéket írta a meglévő sorokra: őszinte közelítés, nem történelmi rekonstrukció. A meal_item recept-ági backfill a per-soros override-envelope-ot figyelmen kívül hagyja.
- **Szándékosan kimaradt:** a NOVA fagyasztása (`mezo-4tzf`) és a pantry-kategória (növényi diverzitás bemenet) — mindkettő továbbra is élő olvasás.

- [ ] **Step 3: Frissítsd a `fuel.md`-t**

Amit át kell írni:
- a kontraktus-szekció: `nutrients` a `RecipeResponse`/`RecipeIngredientResponse`/`MealResponse`/`MealItemResponse`-on, a null-semantikával;
- a snapshot/scoring szabály: „a tápérték-tények élő kamra-olvasásból jönnek" → **fagyottak**, hivatkozva az új ADR-re;
- file map: `NutrientCells.tsx`, `shared/lib/grams.ts`, a két migrációs script;
- a felületek: recept-detail hero + hozzávaló-sorok, LogMealSheet, ImportItemSheet mindhárom ága, a `RecipeCard` `/adag` bázisa;
- a Rost-gyűrű: a `keretHero` `fiberG`-je real módban is élő lett (a `mezo-c9t5` „frontend-only" megjegyzés elavult).

- [ ] **Step 4: Lintelj**

```bash
node scripts/lint-docs.mjs
```

Elvárt: nincs hiba, és a `fuel.md` staleness-flagje eltűnt.

- [ ] **Step 5: Commit**

```bash
git add docs
git commit -m "docs(fuel): tápérték-fagyasztás ADR + feature-doc frissítés (mezo-m6uv)"
```

---

### Task 15: Teljes kapu, PR, merge

**Files:** —

- [ ] **Step 1: Backend teljes suite**

```bash
cd backend && ./mvnw clean test
```

Elvárt: PASS. (Ha a gép elfogy — a CLAUDE.md szerint a nehéz IT-suite a CI dolga; ilyenkor a fókuszált `-Dtest='Recipe*+Meal*+FuelDay*+Pantry*'` a helyi minimum, és a teljes futás a CI-ben zöldül.)

- [ ] **Step 2: Frontend kapu mindkét módban**

```bash
cd frontend && pnpm build && pnpm test && VITE_USE_MOCK=true pnpm test
```

Elvárt: mindhárom zöld.

- [ ] **Step 3: Push + self-PR**

```bash
git push -u origin feat/fuel-nutrient-freeze && gh pr create --fill
```

- [ ] **Step 4: Várd meg a CI-t**

```bash
gh pr checks --watch
```

Elvárt: minden check zöld (backend IT suite, FE mindkét mód, lint, contract-drift). A contract-drift check azt bizonyítja, hogy az `api/openapi.yml` és az `api.gen.ts` a fragmentekből újragenerálva ugyanaz.

- [ ] **Step 5: Merge `--no-ff` és zárás**

```bash
git checkout main && git pull --rebase && git merge --no-ff feat/fuel-nutrient-freeze && git push && git branch -d feat/fuel-nutrient-freeze
```

- [ ] **Step 6: bd zárás + a maradék issue-k felvétele**

```bash
bd close mezo-m6uv
bd create "Fuel: nap-szintű tápérték-összegzés a Mai/Terv felületen (a Rost gyűrűn túl)" -t task -p 3 -d "A meal_item most már fagyasztja a telített/cukor/rost/só értéket (mezo-m6uv), és a MealResponse.nutrients ki is jön a wire-en, de nap-szinten csak a Rost gyűrű fogyasztja (keretHero). Teendő: napi összegzés + megjelenítés a Mai/Terv felületen. Szomszéd: mezo-kz8s."
bd create "Fuel: tápértékek a Mai timeline-on és a MealScoreSheet headerében" -t task -p 3 -d "A logolt étkezés MealResponse.nutrients-e (mezo-m6uv) a Mai timeline étkezés-kártyáin és a MealScoreSheet fejlécében nem látszik — a pontszám-dimenziókban igen, sima tápértékként nem."
bd dolt push && git push
```

---

## Self-Review

**Spec-fedettség**

| Spec-szekasz | Task |
|---|---|
| §2 `recipe_ingredient` oszlopok + migráció + backfill | 2 |
| §2 `meal_item` oszlopok + migráció + backfill | 5 |
| §2 kerekítés (1 tizedes) + null-propagáció | 4 (backend), 7 (FE), 9 (kijelzés) |
| §3 kontraktus | 1 |
| §4.1 snapshot-képzés (recept + meal, mindkét ág) | 3, 5 |
| §4.2 mapper rollup + override-identitás | 4 |
| §4.3 scoring átállítása fagyottra (`fitLines`, `toScoredLine`) | 6 |
| §5.1 típusok, `recipeMacros`, api-mappelés, mock seed | 7, 8 |
| §5.2 `NutrientCells` + formázás + `empty` prop | 9 |
| §5.3 recept-detail hero | 10 |
| §5.3 hozzávaló-sorok | 10 |
| §5.3 LogMealSheet | 11 |
| §5.3 ImportItemSheet (3 ág) | 12 |
| §5.3 RecipeCard `/adag` | 13 |
| §5.3 bónusz: Rost-gyűrű élővé tétele | 8 (Step 4) |
| §6 tesztek (backend + FE) | 2–13 mindegyikének Step 1-e |
| §7 ADR + `fuel.md` + lint | 14 |
| §8 scope-on kívüli issue-k | 15 Step 6 |

**Tudatos eltérés a spectől:** a spec §3 `RecipeNutrients` néven külön recept-sémát írt; a terv egyetlen, fragmentek közt megosztott `Nutrients` sémát használ (a `MealBreakdown` cross-fragment `$ref` precedense alapján) — egy DTO, egy FE-típus, egy `toNutrients` normalizáló. Funkcionálisan azonos, kevesebb duplikáció.

**Típus-konzisztencia** — a terven átívelő nevek egy helyen:

| név | hol keletkezik | hol fogyasztódik |
|---|---|---|
| `Nutrients` (Java DTO) | Task 1 | 4, 5 |
| `snapshotFiberG` / `SugarG` / `SaltG` / `SaturatedFatG` | Task 2 (recipe), 5 (meal) | 3, 4, 5, 6 |
| `RecipeMapper#lineFactor` | Task 4 | 4 (`contributionWithAmount`) |
| `RecipeMapper#nutrientsWithAmount` | Task 4 | 4 (`nutrients`, `rollupNutrientsWithOverrides`) |
| `RecipeMapper#rollupNutrientsWithOverrides` | Task 4 | 5 (`MealService.buildItem`) |
| `MealService#pantryCategory` | Task 6 | 6 (`toScoredLine`) |
| `PantryItemPopulator#createFoodWithNutrients` | Task 3 | 4, 5, 6 |
| `Nutrients` (TS) + `nutrients?` mezők | Task 7 | 8–12 |
| `NO_NUTRIENTS`, `lineNutrients`, `sumNutrients`, `scaleNutrients`, `computeRecipeNutrients`, `computeRecipeNutrientsWithOverrides`, `rescaleFrozenNutrients`, `roundGram` | Task 7 | 8, 10, 11 |
| `formatGram` | Task 9 | 9 (`NutrientCells`) |
| `NutrientCells` (`nutrients` / `perLabel` / `size` / `empty`) | Task 9 | 10, 11, 12 |
