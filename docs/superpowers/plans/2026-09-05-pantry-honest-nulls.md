# Kamra — őszinte nullok a read modellben (implementációs terv)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A `PantryMapper` read modellje ne állítson olyat, amit a tárolt adat nem mond ki — ezzel lezárni a definíció-echo hibacsalád ötödik esetét (`mezo-xaq5`), a kontraktus-driftet (`mezo-qjwy`), és két teszt-keményítést (`mezo-uhe5`, `mezo-3vb1`).

**Architecture:** A hibacsalád gyökere mindig ugyanaz: a válasz egy NULL mezőt `""`-ként vagy `0`-ként ad ki, a kliens ezt visszaküldi, és a szerver különbségnek látja. A `mezo-6omv` ezt a makrókra már megoldotta; ez a köteg ugyanazt teszi a maradék mezőkkel, ugyanazzal a mintával: a kontraktus mezője `nullable: true` lesz (a `required` listában maradva), a mapper nem tölt fabrikált alapértéket, a FE **számoló** fogyasztói a saját határukon esnek vissza, a **megjelenítők** `—`-t vagy semmit írnak, az `inputFromItem` pedig a nullt kihagyja a kérésből.

**Tech Stack:** OpenAPI fragmentek → `api/openapi.yml` → `api.gen.ts`; Java 21 / Spring Boot / MapStruct; React + TypeScript + Vitest; Testcontainers-alapú IT-k.

## Global Constraints

- **Branch:** `feat/pantry-honest-nulls`, worktree `/Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/pantry-honest-nulls`. Soha ne `cd`-zz a fő repóba. Soha ne használj `git stash`-t.
- **Commit:** conventional, a driving id-vel (`fix(pantry): ... (mezo-xaq5)`), és `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>` zárósorral.
- **Kontraktus-first:** kézzel csak `api/feature/pantry/pantry.yml`. Utána
  ```bash
  cd api/generate && npm run generate:api
  cd frontend && pnpm generate:api
  ```
  Mindkét generált fájl (`api/openapi.yml`, `frontend/src/data/_client/api.gen.ts`) ugyanabba a commitba megy — a CI `contract-drift` job `git diff --exit-code`-dal ellenőrzi.
- **Backend teszt (mindig ezzel, mindig előtérben):**
  ```bash
  cd backend && ./mvnw clean test -Dtest='<osztályok>' -Dmezo.test.use-testcontainers=true
  ```
  A flag nélkül a fix-DB mód versenyhelyzetbe kerül és HAMIS hibákat ad. **Elgépelt névnél a maven SEMMIT nem futtat és 0-val kilép: mindig `Tests run: N` DARABSZÁMOT nézz, ne „BUILD SUCCESS"-t.**
- **Frontend:** `VITE_USE_MOCK` unset = MOCK, ezért MINDKÉT mód kiírva:
  ```bash
  cd frontend && VITE_USE_MOCK=true pnpm test && VITE_USE_MOCK=false pnpm test
  ```
  plusz `pnpm build` (nincs `pnpm lint` — a típusellenőrzést a build viszi). Ha a worktree friss, előbb `pnpm install --prefer-offline`.
- **Nincs DB-migráció ebben a kötegben.** Minden érintett oszlop már ma nullable.
- **A `definitionDiffers` / `numDiffers` NEM változik.** A tolerancia csendben eldobna egy valóban beírt értéket.
- **ArchUnit:** konstruktor-injektálás, nincs osztályszintű `@Transactional`, nincs `@Value`.
- **Ismert, NEM ide tartozó FE flake-ek:** `ActiveWorkoutPage.test.tsx` (terhelés alatt, `mezo-0121`) és `timelineHooks.test.tsx` „COMPUTED plan" (valós-óra függő éjfél után, `mezo-wzkt` — tiszta main-en is bukik). Ha ilyet látsz: futtasd izoláltan, jelezd a riportban, és menj tovább. Ne nyomozz és ne javítsd.
- **Ne írj olyan tesztet, ami a régi kódon is átmegy** — ahol a terv kontrollált revertet ír elő, tényleg állítsd vissza a javítást, lásd a bukást, majd tedd vissza.
- **Ne zárj bd issue-t.**

## Hatókör-döntés (a `mezo-xaq5` szélesebb, mint az issue szövege)

A `PantryMapper`-ben 14 fabrikált alapérték van. Osztályozva a `definitionDiffers` ellen:

| Mező | Hol | Következmény | Ebben a kötegben? |
|---|---|---|---|
| `category` | `IngredientResponse`, `SupplementStashResponse` | **A legsúlyosabb.** Az `inputFromItem:51` feltétel nélkül küldi, tehát NULL kategóriájú sorra `""` megy a dróton, a `PantryItemRequest.category` viszont enum `""` nélkül → a sor valószínűleg **egyáltalán nem szerkeszthető**. | **IGEN** |
| `pkg` | `IngredientResponse` | 403 nem-szerzőnek / néma megosztott-sor írás. Ma csak véletlenül nem robban. | **IGEN** |
| `form` | `SupplementStashResponse` | Ugyanaz a stash-úton. | **IGEN** |
| `brand` | mindkettő | A `definitionDiffers:111` már null→`""`-t normalizál, tehát 403 nincs — de a read modell hazudik. | **IGEN** (olcsó, egy sor) |
| `price`, `priceUnit` | `IngredientResponse` | Nincs 403 (állapot-mező), de NULL→0 fabrikáció, és a detail oldal `{item.price ? … : '—'}` miatt egy **valóban 0 Ft-os tétel „—"-ként jelenik meg**. | **IGEN** |
| `dose`, `protocol`, `timing`, stock `unit` | stash / stock | Szabad szöveg a saját polc-soron; nincs megosztott hatás, nincs hibakód, a `""` és a NULL a felhasználónak ugyanaz. | **NEM** — vállalt korlát, dokumentálva |

A `SupplementStashResponse.price`/`priceUnit`/`pkg` **már ma nullable** — ott nincs teendő.

---

## Task 1: A kontraktus és a mapper őszinte nullokra vált

**Files:**
- Modify: `api/feature/pantry/pantry.yml`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/pantry/mapper/PantryMapper.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/pantry/PantryApiIT.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/pantry/PantryServiceIT.java`
- Generated (ne szerkeszd): `api/openapi.yml`, `frontend/src/data/_client/api.gen.ts`

**Interfaces:**
- Consumes: semmit korábbi taskból.
- Produces a kontraktusban:
  - `IngredientResponse`: `brand`, `category`, `price`, `priceUnit`, `pkg` → `nullable: true`, a `required` listában maradva.
  - `SupplementStashResponse`: `brand`, `category`, `form` → `nullable: true`; `macros` → a `nullable: true` KIKERÜL és a mező bekerül a `required` listába.
  - A `PantryMacros` mezői változatlanul nullable-ek (a `mezo-6omv` már megcsinálta).
- Produces a mapperben: `toIngredientResponse` és `toSupplementResponse` a felsorolt mezőket a tárolt értékkel tölti, `== null ? "" :` és `== null ? BigDecimal.ZERO :` nélkül. A `dose`, `protocol`, `timing` és a `toStock` `unit` ága VÁLTOZATLAN.

- [ ] **Step 1: Írd meg a bukó backend teszteket**

`PantryApiIT.java`-ba, a fájl meglévő mintáit követve (autentikáció, `populator` szignatúrák — olvasd el, ne találgass):

```java
    @Test
    void testGetPantry_shouldReportNullCategoryAndPkgAndPrice_insteadOfFabricatedDefaults() throws Exception {
        UUID user = databasePopulator.populateUser("honest-nulls@test.local");
        PantryItemEntity item = populator.createFood(user, "Névtelen alapanyag", LocalDate.now().plusDays(4));
        PantryCatalogEntity c = item.getCatalog();
        c.setCategory(null);
        c.setBrand(null);
        c.setPackageLabel(null);
        catalogRepository.saveAndFlush(c);
        item.setPriceHuf(null);
        item.setPriceUnit(null);
        itemRepository.saveAndFlush(item);

        mockMvc.perform(get("/api/pantry").with(user(user)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.ingredients[?(@.name == 'Névtelen alapanyag')].category").value(hasItem(nullValue())))
            .andExpect(jsonPath("$.ingredients[?(@.name == 'Névtelen alapanyag')].brand").value(hasItem(nullValue())))
            .andExpect(jsonPath("$.ingredients[?(@.name == 'Névtelen alapanyag')].pkg").value(hasItem(nullValue())))
            .andExpect(jsonPath("$.ingredients[?(@.name == 'Névtelen alapanyag')].price").value(hasItem(nullValue())))
            .andExpect(jsonPath("$.ingredients[?(@.name == 'Névtelen alapanyag')].priceUnit").value(hasItem(nullValue())));
    }

    @Test
    void testGetPantry_shouldKeepARealZeroPrice_distinctFromNoPrice() throws Exception {
        UUID user = databasePopulator.populateUser("free-item@test.local");
        PantryItemEntity item = populator.createFood(user, "Ingyenes minta", LocalDate.now().plusDays(4));
        item.setPriceHuf(0);
        item.setPriceUnit("/db");
        itemRepository.saveAndFlush(item);

        // A genuinely free item is 0, not "no data" — the whole point of the honest null.
        mockMvc.perform(get("/api/pantry").with(user(user)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.ingredients[?(@.name == 'Ingyenes minta')].price").value(hasItem(0)));
    }
```

Ugyanide a stash oldalra:

```java
    @Test
    void testGetPantry_shouldReportNullCategoryAndFormOnTheStash_insteadOfEmptyStrings() throws Exception {
        UUID user = databasePopulator.populateUser("honest-stash@test.local");
        PantryItemEntity item = populator.createSupplement(user, "Névtelen kapszula");
        PantryCatalogEntity c = item.getCatalog();
        c.setCategory(null);
        c.setForm(null);
        c.setBrand(null);
        catalogRepository.saveAndFlush(c);

        mockMvc.perform(get("/api/pantry").with(user(user)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.stash[?(@.name == 'Névtelen kapszula')].category").value(hasItem(nullValue())))
            .andExpect(jsonPath("$.stash[?(@.name == 'Névtelen kapszula')].form").value(hasItem(nullValue())))
            .andExpect(jsonPath("$.stash[?(@.name == 'Névtelen kapszula')].brand").value(hasItem(nullValue())));
    }
```

**És a legfontosabb — a `category`-echo, ami ma valószínűleg teljesen megakadályozza a szerkesztést.** `PantryServiceIT.java`-ba (vagy ahol az update-tesztek vannak):

```java
    @Test
    void testUpdateItem_shouldAllowAPureStateEdit_onARowWhoseCategoryIsNull() throws Exception {
        UUID user = databasePopulator.populateUser("null-cat-owner@test.local");
        UUID other = databasePopulator.populateUser("null-cat-bystander@test.local");
        PantryItemEntity authored = populator.createFood(user, "Kategória nélküli", LocalDate.now().plusDays(6));
        PantryCatalogEntity c = authored.getCatalog();
        c.setCategory(null);
        c.setCreatedBy(user);
        catalogRepository.saveAndFlush(c);
        PantryItemEntity theirs = catalogService.ensureItem(other, c.getId());

        // The bystander edits ONLY their own price. Before the honest-null fix the read model
        // handed the client "" for the null category, the client echoed it back, and the request
        // never even reached definitionDiffers as a no-op — it is not a legal enum value.
        mockMvc.perform(put("/api/pantry/" + theirs.getId()).with(user(other))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"kind":"food","name":"Kategória nélküli","price":1290,"priceUnit":"/kg"}
                    """))
            .andExpect(status().isOk());

        assertThat(catalogRepository.findById(c.getId()).orElseThrow().getCategory()).isNull();
    }
```

A HTTP-alakot (`put` vs `patch`, autentikáció, kötelező mezők) a fájl meglévő update-tesztjeiből másold.

- [ ] **Step 2: Futtasd, és nézd meg, hogy BUKNAK**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/pantry-honest-nulls/backend && ./mvnw clean test -Dtest='PantryApiIT,PantryServiceIT' -Dmezo.test.use-testcontainers=true
```

Elvárt: az új esetek FAIL-lel (`expected null but was ""` / `expected null but was 0`). **Írd le a riportban, hogy a `category`-teszt PONTOSAN milyen hibával bukik** — ez dönti el, hogy a mai viselkedés 400 (enum-deszerializáció) vagy 403 (definitionDiffers). Ez a köteg egyik nyitott ténykérdése.

- [ ] **Step 3: Írd át a kontraktust**

`api/feature/pantry/pantry.yml`, `IngredientResponse` — a `required` lista VÁLTOZATLAN, csak a mezők kapnak `nullable: true`-t:

```yaml
        # Honest nulls (mezo-xaq5): the read model must not fabricate "" / 0 for a value the
        # definition simply does not carry. A fabricated "" echoed back by any client reads as a
        # definition CHANGE in PantryMapper#definitionDiffers — a 403 for a non-author and a
        # silent rewrite of the SHARED row for the author. `price` is per-user state, so it never
        # 403s, but a fabricated 0 is indistinguishable from a genuinely free item.
        brand: { type: string, nullable: true }
        source: { $ref: '#/components/schemas/PantrySource' }
        category: { type: string, nullable: true }
        ...
        price: { type: number, nullable: true }
        priceUnit: { type: string, nullable: true }
        pkg: { type: string, nullable: true }
```

`SupplementStashResponse`:

```yaml
        brand: { type: string, nullable: true }
        ...
        category: { type: string, nullable: true }
        dose: { type: string }
        form: { type: string, nullable: true }
```

és a `macros` mezőn (`mezo-qjwy`) a `nullable: true` KIKERÜL, a mező pedig bekerül a `required` listába:

```yaml
      required: [id, name, brand, type, category, dose, form, protocol, timing, taken, macros, catalogId, catalogEditable]
```
```yaml
        # ONE representation since mezo-qjwy: the object is ALWAYS present and its four fields are
        # individually nullable (mezo-6omv). The old object-level null said the same thing as an
        # all-null object, and that redundancy is exactly what made a truthiness gate on the detail
        # page show the "log this meal" CTA for pure dose/protocol items.
        macros: { $ref: '#/components/schemas/PantryMacros' }
```

- [ ] **Step 4: Regeneráld a kontraktust**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/pantry-honest-nulls/api/generate && npm run generate:api
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/pantry-honest-nulls/frontend && pnpm generate:api
```

Ellenőrizd `git diff --stat api/openapi.yml frontend/src/data/_client/api.gen.ts` — mindkettőnek változnia kell.

- [ ] **Step 5: Töröld a fabrikált alapértékeket a mapperből**

`PantryMapper.toIngredientResponse`:

```java
            .brand(c.getBrand())
            .source(toIngredientSource(c.getSource()))
            .category(c.getCategory())
            ...
            .price(e.getPriceHuf() == null ? null : BigDecimal.valueOf(e.getPriceHuf()))
            .priceUnit(e.getPriceUnit())
            .pkg(c.getPackageLabel())
```

`PantryMapper.toSupplementResponse`:

```java
            .brand(c.getBrand())
            .category(c.getCategory())
            .dose(e.getDose() == null ? "" : e.getDose())   // unchanged: per-user free text
            .form(c.getForm())
```

A `dose`, `protocol`, `timing` és a `toStock` `unit` ága VÁLTOZATLAN — lásd a hatókör-táblát. A `macros` builder mindkét helyen már ma feltétel nélkül épít (a `mezo-6omv` óta); ellenőrizd, hogy tényleg így van, és ne alakítsd vissza.

- [ ] **Step 6: Futtasd újra**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/pantry-honest-nulls/backend && ./mvnw clean test -Dtest='Pantry*,MealAiDraft*,RecipeWorkshop*,ArchitectureTest' -Dmezo.test.use-testcontainers=true
```

Elvárt: PASS, `Tests run: N` (N > 0). Ha egy MEGLÉVŐ teszt `""`-t vagy `0`-t várt ott, ahol most null jön: ellenőrizd, hogy a régi elvárás a HIBÁT rögzítette-e. Ha igen, írd át nullra `mezo-xaq5` hivatkozással. Ha nem egyértelmű, **jelezd a riportban aggályként — ne írj át némán tesztet.**

- [ ] **Step 7: Commit**

```bash
git add api/feature/pantry/pantry.yml api/openapi.yml frontend/src/data/_client/api.gen.ts backend/src
git commit -m "$(cat <<'EOF'
fix(pantry): a read modell ne fabrikáljon "" és 0 alapértéket (mezo-xaq5)

A PantryMapper NULL márkát/kategóriát/csomagolást üres stringként, hiányzó árat
0-ként adott ki. A kliens ezt visszaküldi, és a szerver különbségnek látja: a pkg
és a form definíciós mező, tehát 403 a nem-szerzőnek és néma megosztott-sor írás a
szerzőnek; a category ennél is rosszabb, mert az üres string nem legális enum-érték.
Az ár a saját polc-soron nem 403-azik, de a fabrikált 0 megkülönböztethetetlen egy
valóban ingyenes tételtől.

Ez a definíció-echo hibacsalád ötödik esete; a gyökér ugyanaz, amit a mezo-6omv a
makróknál már lezárt. A dose/protocol/timing és a stock mértékegysége szándékosan
kimarad: ott a "" és a NULL a felhasználónak ugyanaz, nincs megosztott hatás.

Mellette a SupplementStashResponse.macros kontraktus-driftje is megszűnik (mezo-qjwy):
egy reprezentáció marad, az objektum mindig jelen van, a mezői külön-külön nullok.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: A frontend átáll az őszinte nullokra

**Files:**
- Modify: `frontend/src/data/types.ts` (`Ingredient`, `PantryItem`, `SupplementStashItem`)
- Modify: `frontend/src/features/fuel/pages/KamraItemDetailPage.tsx` (`inputFromItem`, ár-megjelenítés, kategória-címke)
- Modify: `frontend/src/data/fuel/pantryPickables.ts`
- Modify: `frontend/src/data/fuel/pantryHooks.ts` (mock mutátorok)
- Modify: `frontend/src/data/fuel/pantry.ts` (mock fixture, ha kell)
- Modify: a `pnpm build` által feltárt további fogyasztók (kereső-szűrők `.toLowerCase()` hívásai, `categoryMeta[...]` indexelések)
- Test: `frontend/src/features/fuel/pages/KamraItemDetailPage.test.tsx`

**Interfaces:**
- Consumes: a Task 1 kontraktusát — `Ingredient.brand/category/pkg/priceUnit: string | null`, `Ingredient.price: number | null`, `SupplementStashItem.brand/category/form: string | null`, `SupplementStashItem.macros: PantryMacrosVM` (immár kötelező).
- Produces: nincs új exportált API.

**A task legfontosabb lépése a Step 4** (`inputFromItem`) — ugyanaz a csapda, mint a `mezo-6omv`-nél: ha egy null átszivárog a kérésbe, a „mező hiánya = ne nyúlj hozzá" szemantika átfordul „állítsd NULL-ra"-ba a MEGOSZTOTT soron.

- [ ] **Step 1: Igazítsd a domain típusokat**

`frontend/src/data/types.ts`:

```ts
export interface Ingredient {
  id: string
  kind: PantryItemKind
  name: string
  /** Honest nulls since mezo-xaq5 — the definition simply may not carry these. */
  brand: string | null
  source: PantrySourceKey
  category: string | null
  per: number
  unit: string
  macros: PantryMacrosVM
  ...
  price: number | null
  priceUnit: string | null
  pkg: string | null
```

A `PantryItem` és a `SupplementStashItem` megfelelő mezői ugyanígy; a `SupplementStashItem.macros` **kötelezővé** válik (`macros: PantryMacrosVM`).

- [ ] **Step 2: Fordíts, és gyűjtsd össze a hibalistát**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/pantry-honest-nulls/frontend && pnpm install --prefer-offline && pnpm build
```

A build kilistázza az összes fogyasztót. Írd le a listát a riportba, mielőtt javítani kezdesz.

- [ ] **Step 3: Javítsd a fogyasztókat, szétválasztva**

- **Kereső/szűrő utak** (`KamraPickSheet:77`, `IngredientPickerSheet:97`, `FuelKamraPage:75`, `FuelStackAddPage:22`): `?? ''` a határon, hogy a `.toLowerCase()` ne szálljon el. Ezek nem megjelenítők, hanem illesztők — a null ott „nincs mire illeszteni".
- **Kategória-lookupok** (`categoryMeta[ing.category]`): a null kulcs `undefined`-ot ad, amit a meglévő `?? fallback` már kezel; csak a TS-indexelést kell rendbe tenni (`item.category ?? ''` a kulcsban, vagy egy explicit null-ág).
- **Márka-megjelenítés** (`{item.brand && <span>…}`): a null falsy, ezért ezek MŰKÖDNEK — ne nyúlj hozzájuk.

- [ ] **Step 4: Zárd le a null-echo kockázatot az `inputFromItem`-ben**

`KamraItemDetailPage.tsx`. A `category` ma FELTÉTEL NÉLKÜL megy — ez a köteg fő hibája:

```ts
export function inputFromItem(item: PantryItem): PantryItemInput {
  const base: PantryItemInput = {
    kind: item.kind,
    name: item.name,
    source: item.source,
    per: item.per,
    unit: item.unit,
    stockQty: item.stock?.qty,
    stockUnit: item.stock?.unit,
  }
  // Honest nulls (mezo-xaq5): a field the definition does not carry must stay OUT of the request.
  // The DTO cannot tell an omitted field from an explicit null, and applyDefinitionPartial reads
  // "absent" as "leave unchanged" — so sending null would blank the value on a definition every
  // other user reads. `category` used to be assigned unconditionally, which put an empty string
  // on the wire for a null category; "" is not a legal category enum value.
  if (item.brand != null) base.brand = item.brand
  if (item.category != null) base.category = item.category
  ...
```

Ugyanilyen mezőnkénti őrrel a `price`, `priceUnit`, `pkg`, `form`. **Figyelj:** a `price` ma `if (item.price != null)` — ez már helyes, ne rontsd el `if (item.price)`-ra, mert az egy valódi 0-t elejtene.

- [ ] **Step 5: Javítsd az ár-megjelenítést**

`KamraItemDetailPage.tsx:251` ma `{item.price ? `${item.price} Ft` : '—'}` — egy valóban 0 Ft-os tétel „—"-ként jelenik meg. A null és a 0 mostantól elválik:

```tsx
{item.price != null ? `${item.price} Ft` : '—'}
```

- [ ] **Step 6: Írd meg a teszteket**

`KamraItemDetailPage.test.tsx`:

```ts
test('inputFromItem omits the fields the definition does not carry (mezo-xaq5)', () => {
  const input = inputFromItem({ ...baseItem, brand: null, category: null, pkg: null, priceUnit: null, price: null })
  expect(input).not.toHaveProperty('brand')
  expect(input).not.toHaveProperty('category')
  expect(input).not.toHaveProperty('pkg')
  expect(input).not.toHaveProperty('priceUnit')
  expect(input).not.toHaveProperty('price')
})

test('inputFromItem keeps a genuinely zero price (mezo-xaq5)', () => {
  const input = inputFromItem({ ...baseItem, price: 0, priceUnit: '/db' })
  expect(input.price).toBe(0)
  expect(input.priceUnit).toBe('/db')
})
```

A `baseItem`-et a fájl meglévő fixture-mintájából építsd. Mérd vissza kontrollált reverttel: egy feltétel nélküli másoláson mindkettőnek bukania kell.

- [ ] **Step 7: Futtasd a FE kapukat**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/pantry-honest-nulls/frontend && pnpm build && VITE_USE_MOCK=true pnpm test && VITE_USE_MOCK=false pnpm test
```

Elvárt: build tiszta, mindkét mód PASS (a két ismert flake kivételével — lásd a Global Constraints).

- [ ] **Step 8: Commit**

```bash
git add frontend/src
git commit -m "$(cat <<'EOF'
fix(fe): a Kamra kliens is őszinte nullokkal dolgozik (mezo-xaq5)

A domain típusok követik a kontraktust: a márka, a kategória, a csomagolás, az ár és
a mértékegység lehet null. Az inputFromItem mezőnkénti őrt kapott — eddig a category
FELTÉTEL NÉLKÜL ment, tehát egy NULL kategóriájú sorra üres string került a dróton,
ami nem legális enum-érték. A kereső utak a saját határukon esnek vissza ?? ''-re, a
márka-megjelenítők változatlanok (a null ugyanúgy falsy).

A detail oldal ára már megkülönbözteti a nullt a 0-tól: egy valóban ingyenes tétel
eddig „—"-ként jelent meg.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Két teszt-keményítés (`mezo-uhe5`, `mezo-3vb1`)

**Files:**
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/pantry/PantryImportApiIT.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/pantry/PantryCatalogLoaderIT.java`

**Interfaces:**
- Consumes: a `PantryImportApiIT`-ben már létező `importOnce(...)` helpert (4- és 5-paraméteres overload, a `mezo-rxy0` vezette be). Használd, ne írj újat.
- Produces: semmit.

### `mezo-uhe5` — a fordított ár-eset

A `mezo-rxy0` egyesítette a `priceHuf`/`priceUnit` írását egyetlen `||` ágra. A teszt csak az egyik irányt fedi (ár változik, egység eltűnik). A fordított irány ugyanazon az ágon fut, de nincs futó bizonyíték.

- [ ] **Step 1: Írd meg a tesztet**

```java
    @Test
    void testImport_shouldReplacePriceTogetherWithTheUnit_whenReimportOmitsThePrice() throws Exception {
        // The mirror of testImport_shouldReplacePriceUnitTogetherWithPrice: the pair moves as ONE
        // unit in BOTH directions, so a re-import carrying only a unit must not leave the old
        // amount standing next to the new unit (mezo-uhe5).
        var user = registerUser("import-unit-only@test.local");
        importOnce(user, "Zabpehely", 1490, "/kg");
        importOnce(user, "Zabpehely", null, "/db");

        PantryItemEntity shelf = itemRepository.findByCreatedByAndDeletedFalseOrderByNameAsc(user.id()).getFirst();
        assertThat(shelf.getPriceHuf()).isNull();
        assertThat(shelf.getPriceUnit()).isEqualTo("/db");
    }
```

A `registerUser`/`importOnce` pontos szignatúráját a fájlból vedd — olvasd el, mielőtt írsz.

- [ ] **Step 2: Futtasd**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/pantry-honest-nulls/backend && ./mvnw clean test -Dtest='PantryImportApiIT' -Dmezo.test.use-testcontainers=true
```

Elvárt: PASS (a `mezo-rxy0` javítása már bent van; ez a teszt a meglévő viselkedést rögzíti a másik irányból). **Ha BUKIK, az valódi lelet** — írd le a riportban, ne javítsd a tesztet a bukás elrejtésére.

### `mezo-3vb1` — őr a foldolási feltevésre

A `testRun_shouldFindExistingRowThroughPostgresFold_notJavaFold` fixture-je a török pontos I (U+0130) Java-vs-Postgres foldolási eltérésére épül. Ha egy jövőbeli Postgres/glibc ezt megváltoztatja, a teszt **csendben hamis zölddé** válik: a „nincs duplikátum" állítás a régi kódon is teljesülne.

- [ ] **Step 3: Írd meg az őr-tesztet**

Egy külön teszt, ami magát a FELTEVÉST állítja, és hangosan bukik, ha megszűnik:

```java
    @Test
    void testFoldAssumption_javaAndPostgresMustStillDisagreeOnTheFixture() {
        // The fold-collision test above is only meaningful while Java's toLowerCase and Postgres'
        // lower() actually disagree on this character. If a future Postgres/glibc aligns them, that
        // test would keep passing on the OLD loader too — a silent false green. This one fails
        // loudly instead, so the fixture gets revisited rather than quietly losing its teeth
        // (mezo-3vb1).
        String fixture = FOLD_FIXTURE; // the same constant the collision test uses
        String javaFold = fixture.toLowerCase(java.util.Locale.ROOT);
        String postgresFold = jdbcTemplate.queryForObject("select lower(?)", String.class, fixture);
        assertThat(postgresFold)
            .as("fixture no longer exercises a Java-vs-Postgres fold difference — pick a new one")
            .isNotEqualTo(javaFold);
    }
```

Emeld ki a fixture-karakterláncot egy konstansba, hogy a két teszt ugyanazt használja. A `jdbcTemplate`-et (vagy a fájlban használt megfelelőt) a meglévő teszt-infrastruktúrából vedd — ha nincs, egy sima `DriverManager` kapcsolat is megteszi, a fájl meglévő mintája szerint.

- [ ] **Step 4: Futtasd**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/pantry-honest-nulls/backend && ./mvnw clean test -Dtest='PantryCatalogLoaderIT,PantryImportApiIT' -Dmezo.test.use-testcontainers=true
```

Elvárt: PASS, `Tests run: N` (N > 0).

- [ ] **Step 5: Commit**

```bash
git add backend/src/test
git commit -m "$(cat <<'EOF'
test(pantry): a fordított ár-eset és egy őr a foldolási feltevésre (mezo-uhe5, mezo-3vb1)

Az ár-pár mostantól mindkét irányból bizonyított: egy egységet hozó, árat nem hozó
újraimport sem hagyja ott a régi összeget.

A loader fold-ütközés tesztje a török pontos I Java-vs-Postgres eltérésére épül. Ha
egy jövőbeli Postgres/glibc összehangolja őket, az a teszt csendben hamis zölddé
válna. Az új őr-teszt magát a feltevést állítja, és hangosan bukik helyette.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Doksik és a teljes kapusor

**Files:**
- Modify: `docs/features/pantry.md`
- Modify: `docs/CODEMAP.md` (generált)

- [ ] **Step 1: Írd át a doksit**

`docs/features/pantry.md`-ben:
- a read modell szakasza mondja ki, hogy a `brand`, `category`, `pkg`, `price`, `priceUnit` (ingredient) és a `brand`, `category`, `form` (stash) **őszintén nullable**, és MIÉRT: a fabrikált `""`/`0` echója a `definitionDiffers`-ben különbségnek látszik (403 / néma megosztott-sor írás), a `category` esetében pedig az üres string nem is legális enum-érték;
- rögzítsd a **vállalt korlátot**: a `dose`, `protocol`, `timing` és a stock mértékegysége szándékosan marad `""`-alapértékű — saját polc-soron élő szabad szöveg, nincs megosztott hatás és nincs hibakód;
- a `macros` egyetlen reprezentációja (`mezo-qjwy`): az objektum mindig jelen van, a négy mezője külön-külön nullable.

Kövesd a fájl meglévő stílusát és szakaszszámozását; ne alakítsd át.

- [ ] **Step 2: Doc- és séma-kapuk**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo && node scripts/gen-codemap.mjs
node scripts/lint-docs.mjs --errors-only
node scripts/lint-liquibase.mjs
```

(A parancsokat a WORKTREE gyökeréből futtasd, nem a fő repóból.) Elvárt: `lint-docs` és `lint-liquibase` `result: PASS`.

- [ ] **Step 3: Teljes backend kapusor, előtérben**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/pantry-honest-nulls/backend && ./mvnw clean test -Dtest='Pantry*,MealAiDraft*,MealService*,MealApiIT,RecipeService*,RecipeApiIT,RecipeWorkshop*,RecipeBreakdown*,Protocol*,Intake*,HabitEvaluator*,ArchitectureTest' -Dmezo.test.use-testcontainers=true
```

Elvárt: `Tests run: N` (N > 0), 0 failure, 0 error.

- [ ] **Step 4: Teljes frontend kapusor, előtérben**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/pantry-honest-nulls/frontend && pnpm build && VITE_USE_MOCK=true pnpm test && VITE_USE_MOCK=false pnpm test
```

A két ismert flake (`ActiveWorkoutPage`, `timelineHooks`) esetén: futtasd izoláltan, jelezd, menj tovább.

- [ ] **Step 5: Kontraktus-drift ellenőrzés**

```bash
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/pantry-honest-nulls/api/generate && npm run generate:api
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/pantry-honest-nulls/frontend && pnpm generate:api
cd /Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/pantry-honest-nulls && git status --short
```

Elvárt: üres kimenet (nincs drift).

- [ ] **Step 6: Commit**

```bash
git add docs
git commit -m "$(cat <<'EOF'
docs(pantry): az őszinte nullok és a vállalt korlát rögzítése (mezo-xaq5)

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Zárás (nem task)

1. `git fetch origin && git merge origin/main` → **értelmi audit** a co-touched fájlokon, majd `node scripts/gen-codemap.mjs` a merge UTÁN is.
2. Push, self-PR, `gh pr view <n> --json mergeable,mergeStateStatus` (konfliktusos PR-en a GitHub egyetlen checket sem futtat), majd `gh pr checks --watch`.
3. bd: `mezo-xaq5`, `mezo-qjwy`, `mezo-uhe5`, `mezo-3vb1` zárható a merge után. A `mezo-ho5w` NEM ide tartozik.
4. A `--no-ff` merge parancsot a felhasználó futtatja.
