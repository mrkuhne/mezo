# Kamra-utókövetés köteg — implementációs terv

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Az S4 katalógus-split (`mezo-qw37.4`) záró review-jának hét leletét egy branchen lezárni: a `kind` és a makrók őszinte átvitele a szervertől a kliensig, az ellenőrizetlen import-jelöltek kizárása a megosztott katalógusból, a loader natural-key foldolásának egységesítése, az import ár-párjának javítása, egy törékeny teszt-állítás és egy hiányzó megőrzési terv.

**Architecture:** Hét független javítás egy kötegben, mert ugyanazt a fájlkört érintik (`PantryMapper`, `PantryCatalogService`, `PantryImportService`, `PantryCatalogLoader`, `PantryCatalogRepository`, `kamraItems.ts`, `pantry.yml`). A sorrend a legolcsóbb, legizoláltabb javítástól halad a legnagyobb szerkezeti változásig; a két kontraktus-érintő feladat (Task 4, Task 5) egymás mellett van, hogy a regenerálás logikailag egy blokk legyen.

**Tech Stack:** Java 21 / Spring Boot / JPA / Liquibase / MapStruct (backend); OpenAPI fragmentek → `api/openapi.yml` → `api.gen.ts` (kontraktus); React + TypeScript + TanStack Query + Vitest (frontend); Testcontainers-alapú IT-k.

**Spec:** [`docs/superpowers/specs/2026-09-04-pantry-catalog-followups-design.md`](../specs/2026-09-04-pantry-catalog-followups-design.md)

## Global Constraints

- **Branch:** `feat/pantry-catalog-followups`, worktree `/Users/mrkuhne/Applications/Personal/Mezo/mezo/.claude/worktrees/pantry-catalog-followups`. Soha ne `cd`-zz a fő repóba. Soha ne használj `git stash`-t (a stash stack közös a worktree-k között).
- **Commit-üzenet:** conventional commit a vezető id-vel, pl. `fix(pantry): ... (mezo-4orh)`. Minden commit végén: `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.
- **Backend teszt-parancs (mindig ezzel, mindig előtérben):**
  ```bash
  cd backend && ./mvnw clean test -Dtest='<osztályok>' -Dmezo.test.use-testcontainers=true
  ```
  A `-Dmezo.test.use-testcontainers=true` nélkül a fix-DB mód versenyhelyzetbe kerül és HAMIS hibákat ad. Elgépelt osztálynévnél a maven SEMMIT nem futtat és 0-val kilép: **mindig teszt-darabszámot nézz, ne „BUILD SUCCESS"-t.**
- **Frontend teszt-parancs:** `VITE_USE_MOCK` **unset = mock mód**, tehát a csupasz `pnpm test` kétszer mockot futtat és a real-kapu vaksi. Mindig kiírva mindkét mód:
  ```bash
  cd frontend && VITE_USE_MOCK=true pnpm test && VITE_USE_MOCK=false pnpm test
  ```
  Nincs `pnpm lint` szkript — a típusellenőrzést a `pnpm build` viszi.
- **Kontraktus-first:** csak `api/feature/pantry/pantry.yml`-t szerkeszd kézzel, majd
  ```bash
  cd api/generate && npm run generate:api    # -> api/openapi.yml
  cd frontend && pnpm generate:api           # -> src/data/_client/api.gen.ts
  ```
  Mindkét generált fájl bemegy ugyanabba a commitba (a CI `contract-drift` job `git diff --exit-code`-dal ellenőrzi). A backend DTO-k (`io.mrkuhne.mezo.api.dto.*`) build közben generálódnak az `api/openapi.yml`-ből — nincs külön lépés.
- **Liquibase:** a kiadott changesetek IMMUTÁBILISAK — a `202609021410_mezo-qw37.4_pantry_catalog_split.sql`-t tilos szerkeszteni. Új changeset megy a `backend/src/main/resources/db/changelog/1.0.0/script/`-ba, és be kell kötni a `1.0.0_master.yml` VÉGÉRE. Constraint-prefix konvenció: `pk_`/`fk_`/`uq_`/`ck_`/`idx_`. Rollback blokk tudatosan nincs a repóban. Kapu: `node scripts/lint-liquibase.mjs`.
- **`spring.jpa.hibernate.ddl-auto=validate`:** entity-változás és a hozzá tartozó migráció UGYANABBA a commitba megy.
- **ArchUnit:** `@Service` a `..service..`-ben, repository a `..repository..`-ben, kizárólag konstruktor-injektálás, nincs osztályszintű `@Transactional`, nincs `@Value`, nincs nyers `RuntimeException`/`IllegalArgumentException` a `techcore`-on kívül, befagyasztott feature-ciklus gráf (`recipe → meal` élt tilos hozzáadni). A `ArchitectureTest` minden backend futásban benne van.
- **Ne írj olyan tesztet, ami a régi kódon is átmegy.** Ahol a terv „kontrollált revert"-et ír elő, ott ténylegesen állítsd vissza a javítást, futtasd a tesztet, lásd a bukást, majd tedd vissza a javítást.
- **Ne zárj bd issue-t** — a session végén egyszerre rendezzük.

---

## File Structure

**Backend — módosítás:**

| Fájl | Felelősség a kötegben |
|---|---|
| `backend/src/main/java/io/mrkuhne/mezo/feature/pantry/mapper/PantryMapper.java` | `kind` az `IngredientResponse`-ra (T4); `nz()` eltávolítása (T5) |
| `backend/src/main/java/io/mrkuhne/mezo/feature/pantry/service/PantryCatalogService.java` | `trusted` paraméter a MISS ágra, draft-beszúrás, `search` needle trim (T3, T6) |
| `backend/src/main/java/io/mrkuhne/mezo/feature/pantry/service/PantryImportService.java` | ár-pár egységként (T2) |
| `backend/src/main/java/io/mrkuhne/mezo/feature/pantry/service/PantryService.java` | draft → verified promóció (T6) |
| `backend/src/main/java/io/mrkuhne/mezo/feature/pantry/PantryCatalogLoader.java` | natural-key lookup Postgresre bízva (T3) |
| `backend/src/main/java/io/mrkuhne/mezo/feature/pantry/repository/PantryCatalogRepository.java` | `lower(trim(...))` a keresésben (T3), status-szűrés (T6), javadoc (T1) |
| `backend/src/main/java/io/mrkuhne/mezo/feature/pantry/entity/PantryCatalogEntity.java` | `status` mező + konstansok (T6) |

**Backend — új:**

| Fájl | Felelősség |
|---|---|
| `backend/src/main/resources/db/changelog/1.0.0/script/202609041000_mezo-qooi_pantry_catalog_status.sql` | `status` oszlop + CHECK (T6) |

**Kontraktus:**

| Fájl | Felelősség |
|---|---|
| `api/feature/pantry/pantry.yml` | `IngredientResponse.kind` (T4), `PantryMacros` nullable mezők (T5) |
| `api/openapi.yml`, `frontend/src/data/_client/api.gen.ts` | generált, kézzel NEM szerkesztendő |

**Frontend — módosítás:**

| Fájl | Felelősség |
|---|---|
| `frontend/src/data/types.ts` | `Ingredient.kind`, új `PantryMacros` típus (T4, T5) |
| `frontend/src/features/fuel/logic/kamraItems.ts` | a kind-származtatás törlése (T4) |
| `frontend/src/data/fuel/pantryPickables.ts` | a `foodKind` származtatás törlése (T4), `ZERO` (T5) |
| `frontend/src/data/fuel/pantry.ts` | mock fixture `kind` mezők (T4) |
| `frontend/src/data/fuel/pantryHooks.ts` | mock mutátorok `kind` mezői (T4) |
| `frontend/src/features/fuel/components/MacroCells.tsx` | nullable makró-cella (T5) |
| `frontend/src/features/fuel/components/RecipeIngredientRow.tsx`, `MealComposer.tsx`, `KamraCard.tsx` | null-kezelés (T5) |
| `frontend/src/features/fuel/sheets/KamraPickSheet.tsx` | null-kezelés (T5) |
| `frontend/src/features/fuel/pages/KamraItemDetailPage.tsx`, `RecipeEditorPage.tsx` | null-kezelés + `inputFromItem` (T5) |

**Tesztek:**

| Fájl | Feladat |
|---|---|
| `backend/src/test/java/io/mrkuhne/mezo/feature/pantry/PantryItemRepositoryIT.java` | T1, T3 |
| `backend/src/test/java/io/mrkuhne/mezo/feature/pantry/PantryImportApiIT.java` | T2, T6 |
| `backend/src/test/java/io/mrkuhne/mezo/feature/pantry/PantryCatalogLoaderIT.java` | T3 |
| `backend/src/test/java/io/mrkuhne/mezo/feature/pantry/PantryApiIT.java` | T4, T5 |
| `backend/src/test/java/io/mrkuhne/mezo/feature/pantry/PantryCatalogApiIT.java` | T6 |
| `frontend/src/features/fuel/logic/kamraItems.test.ts` | T4 |

**Doksik:** `docs/features/pantry.md` (T7), `docs/CODEMAP.md` (T7, generált).

---

## Task 1: `mezo-gmy0` — törékeny teszt-állítás + javadoc

**Files:**
- Modify: `backend/src/test/java/io/mrkuhne/mezo/feature/pantry/PantryItemRepositoryIT.java:69-83`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/pantry/repository/PantryCatalogRepository.java` (a `findByCreatedByIsNull()` javadocja)

**Interfaces:**
- Consumes: semmit korábbi taskból (ez az első).
- Produces: semmit — izolált teszt- és doc-javítás.

**Kontextus:** a `testSearch_shouldMatchNameOrBrandCaseInsensitively_andFilterByKind` teszt `containsExactly`-t használ egy GLOBÁLIS katalógus ellen, amit a `ResetDatabase` szándékosan nem ürít (a `created_by IS NULL` master sorok megmaradnak, és a `PantryCatalogLoader` minden profilban lefut, `@Order(50)`, nincs `demodata` mögé zárva). A `%myprot%` állítás ugyanezért már át lett írva `contains(...)`-ra; a `%zab%` nem kapta meg ugyanezt a kezelést, és csak azért zöld, mert a 147 soros seedben ma nincs `zab` a névben.

- [ ] **Step 1: Írd át a törékeny állítást**

`PantryItemRepositoryIT.java`, a `testSearch_...` metódusban cseréld le az első állítást:

```java
        // Not containsExactly: the search is GLOBAL and ResetDatabase deliberately keeps the
        // loader's 147 master rows (created_by IS NULL), so any future seed entry whose name
        // contains "zab" (Zabtej, Zabkorpa, ...) would break an exact-match assertion that has
        // nothing to do with what this test is checking (mezo-gmy0).
        assertThat(catalogRepository.searchAll("%zab%", Limit.of(50))).extracting(PantryCatalogEntity::getName)
            .contains("Zabpehely")
            .doesNotContain("Kreatin");
```

- [ ] **Step 2: Egészítsd ki a repository javadocot**

`PantryCatalogRepository.java`, a `findByCreatedByIsNull()` felett:

```java
    /**
     * Master rows (loader-owned). Deliberately NOT filtered on {@code deleted}: the loader's
     * revive-on-upsert (S4 Task 5) needs to see a soft-deleted master row in order to bring it
     * back, and a filtered query would silently insert a duplicate instead (mezo-gmy0).
     */
    List<PantryCatalogEntity> findByCreatedByIsNull();
```

- [ ] **Step 3: Futtasd a tesztet**

```bash
cd backend && ./mvnw clean test -Dtest='PantryItemRepositoryIT' -Dmezo.test.use-testcontainers=true
```

Elvárt: a futás **teszt-darabszámot** ír ki (`Tests run: N`), N > 0, 0 failure. Ha `Tests run: 0`, elgépelted az osztálynevet — javítsd és futtasd újra.

- [ ] **Step 4: Commit**

```bash
git add backend/src/test/java/io/mrkuhne/mezo/feature/pantry/PantryItemRepositoryIT.java \
        backend/src/main/java/io/mrkuhne/mezo/feature/pantry/repository/PantryCatalogRepository.java
git commit -m "$(cat <<'EOF'
test(pantry): a kereső IT ne containsExactly-zzon a globális seed ellen (mezo-gmy0)

A ResetDatabase szándékosan megtartja a loader 147 master sorát, így egy jövőbeli
'zab'-ot tartalmazó seed név elrontaná az állítást. contains + doesNotContain, ahogy
a %myprot% ág már ma is. Mellette a findByCreatedByIsNull javadocja kimondja, hogy
szándékosan nem szűri a deletedet — a revive-on-upsert emiatt működik.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: `mezo-rxy0` — az ár és a mértékegység egy egységként

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/pantry/service/PantryImportService.java:117-125`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/pantry/PantryImportApiIT.java`

**Interfaces:**
- Consumes: semmit.
- Produces: semmit — a metódus szignatúrája nem változik.

**Kontextus:** az S4 javítása után a `priceHuf` és a `priceUnit` külön-külön csak akkor íródik felül, ha az adott érték nem null. Az eredeti szándék helyes volt (egy ár-mentes újraimport ne nullázza ki a felhasználó által beírt árat), de a mezőnkénti feltétel kereszt-párosítást enged: egy árat hozó, egységet nem hozó újraimport az új összeg mellé otthagyja a korábbi mértékegységet (1490 `db` helyett 1490 `kg`).

- [ ] **Step 1: Írd meg a bukó tesztet**

`PantryImportApiIT.java`-ba, a meglévő import-tesztek mellé. A fájl bevett mintáját kövesd (ugyanazok a `mockMvc`/`populator`/`objectMapper` mezők és a meglévő importok kérés-építése); az alábbi váz a lényeget rögzíti:

```java
    @Test
    void testImport_shouldReplacePriceUnitTogetherWithPrice_whenReimportOmitsTheUnit() throws Exception {
        // 1) első import: 1490 Ft "/kg"
        // 2) ugyanaz a név+brand újraimportálva 990 Ft-tal, priceUnit NÉLKÜL
        // 3) a polc-soron 990 Ft ÉS priceUnit == null — nem 990 Ft "/kg" (mezo-rxy0)
        UUID user = databasePopulator.populateUser("import-price@test.local");
        importOnce(user, "Zabpehely", 1490, "/kg");
        importOnce(user, "Zabpehely", 990, null);

        PantryItemEntity shelf = itemRepository.findByCreatedByAndDeletedFalseOrderByNameAsc(user).getFirst();
        assertThat(shelf.getPriceHuf()).isEqualTo(990);
        assertThat(shelf.getPriceUnit()).isNull();
    }
```

Az `importOnce(...)` segédmetódust a fájl meglévő import-hívó mintájából emeld ki (POST `/api/pantry-import`, `PantryImportRequest` a kötelező `name`/`per`/`unit`/`kcal` mezőkkel + a paraméterezett `priceHuf`/`priceUnit`-tal). Ha a fájlban már van hasonló helper, azt használd, ne írj másodikat.

- [ ] **Step 2: Futtasd, és nézd meg, hogy BUKIK**

```bash
cd backend && ./mvnw clean test -Dtest='PantryImportApiIT' -Dmezo.test.use-testcontainers=true
```

Elvárt: FAIL — `expected: null but was: "/kg"`. Ha nem bukik, a teszt nem méri a hibát: ellenőrizd, hogy a második import tényleg ugyanarra a natural key-re (név + brand) megy, tehát ugyanazt a polc-sort találja el.

- [ ] **Step 3: Javítsd a szolgáltatást**

`PantryImportService.java`, cseréld a két külön feltételt egyre:

```java
        // Partial apply (fix round 1 Important 1): ensureItem can now return an EXISTING shelf row
        // (a re-import), so an unconditional set would null out a price the user already entered —
        // only touch the price at all when this draft actually carries one. The pair moves as ONE
        // unit (mezo-rxy0): applying priceHuf without priceUnit left the new amount next to the
        // OLD unit (1490 "db" reading as 1490 "kg"), which is worse than either value alone.
        if (req.getPriceHuf() != null || req.getPriceUnit() != null) {
            item.setPriceHuf(req.getPriceHuf());
            item.setPriceUnit(req.getPriceUnit());
        }
```

- [ ] **Step 4: Futtasd újra**

```bash
cd backend && ./mvnw clean test -Dtest='PantryImportApiIT' -Dmezo.test.use-testcontainers=true
```

Elvárt: PASS, `Tests run: N` (N > 0), 0 failure.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/pantry/service/PantryImportService.java \
        backend/src/test/java/io/mrkuhne/mezo/feature/pantry/PantryImportApiIT.java
git commit -m "$(cat <<'EOF'
fix(pantry): az import ára és mértékegysége egy egységként íródjon (mezo-rxy0)

Egy árat hozó, de mértékegységet nem hozó újraimport eddig az új összeg mellé
otthagyta a korábbi mértékegységet (1490 'db' helyett 1490 'kg'). A pár most együtt
mozog: vagy mindkettő az új draftból, vagy egyik sem.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: `mezo-imet` — egy foldolás, a Postgresé

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/pantry/PantryCatalogLoader.java:53-58,116-119`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/pantry/repository/PantryCatalogRepository.java:41-47`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/pantry/service/PantryCatalogService.java:57-62`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/pantry/PantryCatalogLoaderIT.java`

**Interfaces:**
- Consumes: semmit korábbi taskból.
- Produces: `PantryCatalogLoader.naturalKey(String, String)` **megszűnik** (a T6 nem hivatkozhat rá). A `searchAll` / `searchByKind` szignatúrája változatlan (`List<PantryCatalogEntity> searchAll(String like, Limit limit)`), csak a JPQL változik.

**Kontextus:** a loader `naturalKey()`-je Javában kisbetűsít (`toLowerCase(Locale.ROOT)`) és ezzel épít egy in-memory `byKey` mapet, míg az `uq_pantry_catalog_natural` index Postgres `lower(trim(...))`-el számol. Ahol a kettő eltér (görög végső szigma: Java `ς`, Postgres `σ`; török pontos I), a loader nem találja meg a létező sort, beszúr, és az egyedi indexen **elbukik az alkalmazás indítása**. A `PantryCatalogRepository.findByNaturalKey` javadocja pontosan ezt a tanulságot mondja ki — a loader nem lett hozzáigazítva.

**Terv-döntés a spec nyitott pontjára:** a tesztet a repository-hívásra váltás **közvetlen** igazolásával írjuk meg, nem a `readCatalog()` behelyettesítésével. Egy IT előre beszúr egy katalógus-sort olyan névvel, amely a seed egyik nevétől CSAK a Java-vs-Postgres foldolásban tér el, majd újrafuttatja a loadert: a régi kódon `DataIntegrityViolationException`, az újon nincs kivétel és nincs duplikátum.

- [ ] **Step 1: Írd meg a bukó tesztet**

Előbb nézd meg a `PantryCatalogLoaderIT.java` meglévő mintáit (van benne `loader.run()` újrafuttatás egy drifted DB ellen — azt a mintát kövesd). Add hozzá:

A tesztnek **determinisztikus** fold-eltérésre kell épülnie. A görög végső szigma vonzó példa, de hogy a Postgres `lower()` pontosan mit ad rá, az a szerver collation/ICU beállításától függ — egy ilyen tesztre nem szabad építeni. Helyette a **körbevágás** a biztos eltérés: az `uq_pantry_catalog_natural` index `lower(trim(...))`-el számol, a régi loader-map viszont a NYERS `c.getName()`-re épült, `strip()` nélkül — így egy körbevágatlan létező sort garantáltan nem talált meg.

```java
    @Test
    void testRun_shouldFindExistingRowThroughPostgresFold_notJavaFold() {
        // Vegyük a seed EGYIK nevét, és szúrjuk be előre olyan alakban, amit a Postgres lower()
        // ugyanarra a kulcsra fold, a Java toLowerCase viszont NEM (trailing whitespace: a Java
        // kulcs strip()-el, de a régi loader map-je a NYERS DB-névre épült). A loadernek meg kell
        // TALÁLNIA ezt a sort és backfillelnie, nem beszúrnia egy másodikat.
        String seedName = loader.readCatalogForTest().getFirst().name();
        PantryCatalogEntity preexisting = new PantryCatalogEntity();
        preexisting.setKind("food");
        preexisting.setName("  " + seedName.toUpperCase(java.util.Locale.ROOT) + "  ");
        preexisting.setSource("manual");
        catalogRepository.saveAndFlush(preexisting);
        UUID preexistingId = preexisting.getId();

        loader.run();

        assertThat(catalogRepository.findByNaturalKey(seedName, null))
            .get().extracting(PantryCatalogEntity::getId).isEqualTo(preexistingId);
        assertThat(catalogRepository.findAll().stream()
            .filter(c -> seedName.equalsIgnoreCase(c.getName().strip())).toList()).hasSize(1);
    }
```

Ehhez a loaderben tegyél elérhetővé egy csomag-privát olvasót a teszt számára:

```java
    /** Package-private test seam: the IT needs a real seed name to build its fold-collision case. */
    List<CatalogRow> readCatalogForTest() {
        return readCatalog();
    }
```

- [ ] **Step 2: Futtasd, és nézd meg, hogy a MÁSODIK teszt bukik**

```bash
cd backend && ./mvnw clean test -Dtest='PantryCatalogLoaderIT' -Dmezo.test.use-testcontainers=true
```

Elvárt: `testRun_shouldFindExistingRowThroughPostgresFold_notJavaFold` FAIL (a loader beszúrt egy másodikat, vagy `DataIntegrityViolationException`-nel elszállt). Ha nem bukik, a beszúrt alak nem tér el eléggé — próbáld a `toUpperCase` + körbevágatlan szóköz kombinációt (a régi map a nyers `c.getName()`-re épült, `strip()` nélkül), és győződj meg róla, hogy a loader tényleg újra lefut.

- [ ] **Step 3: Vidd át a foldolást a Postgresre a loaderben**

`PantryCatalogLoader.java`, a `run()` metódusban töröld az in-memory mapet:

```java
    @Transactional
    public void run() {
        int inserted = 0;
        int claimed = 0;
        for (CatalogRow row : readCatalog()) {
            // The natural key is folded by POSTGRES, never by Java (mezo-imet): a Java-side
            // toLowerCase disagrees with Postgres lower() on the Greek final sigma and the Turkish
            // dotted I, and the loader's own in-memory map would then MISS an existing row, insert,
            // and take down APPLICATION STARTUP on uq_pantry_catalog_natural.
            PantryCatalogEntity hit = repository.findByNaturalKey(row.name(), null).orElse(null);
            if (hit == null) {
                PantryCatalogEntity c = new PantryCatalogEntity();
                c.setName(row.name().strip()); // every producer stores the natural key trimmed
                fill(c, row, true);
                repository.saveAndFlush(c); // flush: the next row's lookup must see this insert
                inserted++;
                continue;
            }
            ...  // a meglévő isMaster / isDeleted / fill ág VÁLTOZATLAN
            repository.saveAndFlush(hit);
        }
        ...
    }
```

Fontos: a korábbi `repository.save(...)` hívások `saveAndFlush(...)`-ra váltanak, mert a következő seed sor `findByNaturalKey` lekérdezésének látnia kell az imént beszúrt sort. A `byKey.put(...)` sorok eltűnnek.

Töröld a `naturalKey(String, String)` metódust és a feleslegessé vált `Locale` / `HashMap` / `Map` importokat.

- [ ] **Step 4: Futtasd a loader-teszteket**

```bash
cd backend && ./mvnw clean test -Dtest='PantryCatalogLoaderIT' -Dmezo.test.use-testcontainers=true
```

Elvárt: PASS, `Tests run: N` (N > 0).

- [ ] **Step 5: Állítsd helyre az „egy foldolás" invariánst a kereső úton is**

`PantryCatalogRepository.java`:

```java
    /**
     * {@code like} is already lowercased, TRIMMED and %-wrapped by the service. Two methods
     * (no `:kind is null`) keep the bind types explicit. {@code lower(trim(...))} mirrors the
     * natural key's fold so the search path cannot drift from the key path (mezo-imet) — a
     * legacy row stored as {@code "Túró "} is matched by the same expression that keys it.
     */
    @Query("select c from PantryCatalogEntity c where c.deleted = false "
        + "and (lower(trim(c.name)) like :like or lower(trim(coalesce(c.brand, ''))) like :like) "
        + "order by c.name asc")
    List<PantryCatalogEntity> searchAll(@Param("like") String like, Limit limit);

    @Query("select c from PantryCatalogEntity c where c.deleted = false and c.kind = :kind "
        + "and (lower(trim(c.name)) like :like or lower(trim(coalesce(c.brand, ''))) like :like) "
        + "order by c.name asc")
    List<PantryCatalogEntity> searchByKind(@Param("like") String like, @Param("kind") String kind, Limit limit);
```

`PantryCatalogService.search(...)`-ban a needle is trimelődjön:

```java
        String needle = q == null ? "" : q.strip().toLowerCase(Locale.ROOT)
            .replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
```

(Ez már ma `strip()`-el — ellenőrizd, hogy tényleg így van, és ha igen, ne változtass rajta; a `lower(trim(...))` a kolumna-oldalon volt a hiányzó fél.)

- [ ] **Step 6: Futtasd a kereső- és katalógus-teszteket**

```bash
cd backend && ./mvnw clean test -Dtest='PantryItemRepositoryIT,PantryCatalogApiIT,PantryCatalogServiceIT,PantryCatalogLoaderIT' -Dmezo.test.use-testcontainers=true
```

Elvárt: PASS, `Tests run: N` (N > 0), 0 failure.

- [ ] **Step 7: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/pantry/PantryCatalogLoader.java \
        backend/src/main/java/io/mrkuhne/mezo/feature/pantry/repository/PantryCatalogRepository.java \
        backend/src/main/java/io/mrkuhne/mezo/feature/pantry/service/PantryCatalogService.java \
        backend/src/test/java/io/mrkuhne/mezo/feature/pantry/PantryCatalogLoaderIT.java
git commit -m "$(cat <<'EOF'
fix(pantry): a loader natural-key foldolása a Postgresre bízva (mezo-imet)

A loader in-memory Java-mapja toLowerCase(Locale.ROOT)-tal foldolt, míg az
uq_pantry_catalog_natural index lower(trim(...))-el. Ahol a kettő eltér (görög végső
szigma, török pontos I), a loader nem találta meg a létező sort, beszúrt, és elbukott
az INDULÁS. Most soronként findByNaturalKey-t hív, ahogy a repository javadocja
elő is írja. Mellette searchAll/searchByKind lower(trim(...))-re javítva, hogy a
kereső út se drifteljen el a kulcs úttól.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: `mezo-4orh` — a `kind` végig a szervertől (P1, vezető issue)

**Files:**
- Modify: `api/feature/pantry/pantry.yml` (`IngredientResponse`)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/pantry/mapper/PantryMapper.java:164-195`
- Modify: `frontend/src/data/types.ts` (`Ingredient`)
- Modify: `frontend/src/features/fuel/logic/kamraItems.ts:57-66`
- Modify: `frontend/src/data/fuel/pantryPickables.ts:22-30` (és a `foodKind` hívási helye)
- Modify: `frontend/src/data/fuel/pantry.ts` (18 mock ingredient sor)
- Modify: `frontend/src/data/fuel/pantryHooks.ts` (`mockImport`, `mockAddFromCatalog`, `mockAdd`, `mockUpdate`)
- Modify: `frontend/src/test/msw/handlers.ts` (ha ingredient-fixture-t épít)
- Test: `frontend/src/features/fuel/logic/kamraItems.test.ts`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/pantry/PantryApiIT.java`
- Generated (ne szerkeszd): `api/openapi.yml`, `frontend/src/data/_client/api.gen.ts`

**Interfaces:**
- Consumes: semmit korábbi taskból.
- Produces:
  - Kontraktus: `IngredientResponse.kind: 'food' | 'supplement' | 'stim' | 'med'` (required).
  - FE: `Ingredient.kind: PantryItemKind` (required mező).
  - `buildKamraItems(ingredients: Ingredient[], stash: SupplementStashItem[]): PantryItem[]` szignatúrája VÁLTOZATLAN.
  - `foodKind(category: string)` a `pantryPickables.ts`-ből **megszűnik**.

**Kontextus:** `kamraItems.ts:59-65` a `kind`-ot a `category` stringből vezeti le. Egy FOOD sorra, aminek a category-ja `supplement` (legális enum-érték, a sheet fel is kínálja), a FE `kind:'supplement'`-et számol; a `PantryItemRequest.kind` required, ezért az `AddPantryItemSheet.submit()` mindig elküldi, a `definitionLocked` kapun kívül — így `PantryMapper.definitionDiffers` (`:104`) minden mentésnél elsül: nem-szerzőnek 403 egy tisztán ár/készlet szerkesztésre, szerzőnek/OWNER-nek a MEGOSZTOTT sor `kind`-ja csendben átíródik.

A `PantryService.getPantry` (`:52-57`) `"food".equals(...)` szerint szűri az ingredients ágat, de az `IngredientResponse` **nem hordozza** a `kind`-ot — ezért kell a kontraktus-mező.

Ugyanez a származtatás egy MÁSODIK helyen is él: `pantryPickables.foodKind(category)`. Az is eltűnik.

- [ ] **Step 1: Bővítsd a kontraktust**

`api/feature/pantry/pantry.yml`, az `IngredientResponse` sémában — a `required` listára vedd fel a `kind`-ot, és add hozzá a mezőt a `properties` alá, közvetlenül az `id` után:

```yaml
    IngredientResponse:
      type: object
      # nova left OUT of required since mezo-32ko: an unclassified item is an honest null,
      # not a fabricated NOVA 1 (the old mapper default masked the data gap on the Kamra UI).
      required: [id, kind, name, brand, source, category, per, unit, macros, price, priceUnit, pkg, micros, lastUsed, usedInRecipes, catalogId, catalogEditable]
      properties:
        id: { type: string, format: uuid }
        # The SHARED definition's kind, carried explicitly since mezo-4orh. getPantry projects
        # this arm by kind == food, so it is always 'food' today — but the client must READ it,
        # never re-derive it from `category` ('supplement' is a legal category on a FOOD row).
        kind: { type: string, enum: [food, supplement, stim, med] }
        name: { type: string }
```

- [ ] **Step 2: Regeneráld a kontraktust**

```bash
cd api/generate && npm run generate:api
cd ../../frontend && pnpm generate:api
```

Ellenőrizd, hogy mindkét generált fájl változott:

```bash
cd .. && git diff --stat api/openapi.yml frontend/src/data/_client/api.gen.ts
```

Elvárt: mindkét fájl megjelenik a diffben.

- [ ] **Step 3: Töltsd a mezőt a mapperben**

`PantryMapper.java`, a `toIngredientResponse` builderében, közvetlenül az `.id(e.getId())` után:

```java
            .id(e.getId())
            // The shared definition's kind, on the wire since mezo-4orh: the client used to
            // re-derive it from `category`, and a FOOD row categorised 'supplement' then echoed
            // kind='supplement' back on every save — tripping definitionDiffers into a 403 for a
            // non-author and a silent rewrite of the SHARED row for the author/OWNER.
            .kind(IngredientResponse.KindEnum.fromValue(c.getKind()))
            .name(c.getName())
```

- [ ] **Step 4: Írd meg a bukó backend tesztet**

`PantryApiIT.java`-ba, a meglévő `getPantry` tesztek mintáját követve:

```java
    @Test
    void testGetPantry_shouldReportFoodKind_forAFoodRowCategorisedAsSupplement() throws Exception {
        UUID user = databasePopulator.populateUser("kind-echo@test.local");
        // 'supplement' is a LEGAL category on a food row (the add sheet offers it) — the kind and
        // the category are independent axes, and the client must not conflate them (mezo-4orh).
        PantryItemEntity item = populator.createFood(user, "Kollagén por", LocalDate.now().plusDays(30));
        item.getCatalog().setCategory("supplement");
        catalogRepository.saveAndFlush(item.getCatalog());

        mockMvc.perform(get("/api/pantry").with(user(user)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.ingredients[?(@.name == 'Kollagén por')].kind").value(hasItem("food")))
            .andExpect(jsonPath("$.ingredients[?(@.name == 'Kollagén por')].category").value(hasItem("supplement")));
    }
```

A `.with(user(...))` helyett a fájlban ténylegesen használt autentikációs helpert vedd át (a meglévő tesztekből másold), és a `populator.createFood(...)` szignatúráját is a fájlból igazold vissza.

- [ ] **Step 5: Futtasd a backend tesztet**

```bash
cd backend && ./mvnw clean test -Dtest='PantryApiIT' -Dmezo.test.use-testcontainers=true
```

Elvárt: PASS, `Tests run: N` (N > 0). (A Step 3 javítása után zöldnek kell lennie; ha kihagynád a Step 3-at, a mező hiánya miatt bukna.)

- [ ] **Step 6: Vedd fel a mezőt a FE domain típusra**

`frontend/src/data/types.ts`, az `Ingredient` interfészben az `id` után:

```ts
export interface Ingredient {
  id: string
  /**
   * The SHARED definition's kind, straight from the server (mezo-4orh). NEVER re-derive it
   * from `category`: 'supplement' is a legal category on a FOOD row, and the derived value
   * echoed back on save rewrote the shared definition's kind for every other user.
   */
  kind: PantryItemKind
  name: string; brand: string; source: PantrySourceKey; category: string
```

(A `PantryItemKind` már ebben a fájlban van definiálva, lejjebb — TypeScript-ben az interfész-hivatkozás sorrendje nem számít.)

- [ ] **Step 7: Töröld a származtatást a `kamraItems.ts`-ből**

```ts
  const ingItems: PantryItem[] = ingredients.map(i => ({ ...i }))
```

Törlődik a `kind: i.category.startsWith(...)` blokk. A fájl fejlécében a `PantryItemKind` import maradjon (a stash ág használja).

- [ ] **Step 8: Töröld a MÁSODIK származtatást a `pantryPickables.ts`-ből**

Töröld a `foodKind` függvényt, és a hívási helyén (ahol egy `Ingredient`-ből `PickableIngredient` lesz) a `kind: foodKind(i.category)` helyére `kind: i.kind` kerül. A `PickableIngredient extends Ingredient { kind: PantryItemKind }` deklaráció redundánssá válik (az `Ingredient` már hordozza) — hagyd meg, de a kommentjét igazítsd:

```ts
/** An Ingredient the recipe picker can offer. `kind` now comes from the server (mezo-4orh). */
export interface PickableIngredient extends Ingredient {}
```

Ha az üres interfész lint/TS panaszt vált ki, cseréld típus-aliasra: `export type PickableIngredient = Ingredient`. Ellenőrizd a `pnpm build`-del.

- [ ] **Step 9: Add meg a `kind`-ot a mock fixture-ben**

`frontend/src/data/fuel/pantry.ts`, az `ingredients: Ingredient[]` tömb mind a **18** sora kap egy `kind` mezőt. **A meglévő mock viselkedést szó szerint megőrizzük** — a fixture három sora ma supplement-kindra származik:

- `ing-whey` (category `supplement-protein`) → `kind: 'supplement'`
- `ing-kreatin` (category `supplement`) → `kind: 'supplement'`
- `ing-aakg` (category `supplement-stim`) → `kind: 'stim'`
- a maradék 15 sor → `kind: 'food'`

Tegyél a tömb fölé egy magyarázó kommentet:

```ts
// A `kind` a szerver mezője (mezo-4orh) — a fixture-ben explicit, nem a category-ból számolt.
// A whey/kreatin/AAKG sorok szándékosan supplement/stim kinddal állnak: a mock „ingredients"
// tömbje a fixture TELJES kamrája, nem a valós szerver food-only projekciója, és a
// buildKamraItems kártya-kindjai így maradnak változatlanok.
```

- [ ] **Step 10: Add meg a `kind`-ot a mock mutátorokban**

`frontend/src/data/fuel/pantryHooks.ts`:

- `mockImport` → az `ing: Ingredient` objektumba `kind: 'food',` (az import mindig food).
- `mockAddFromCatalog` food ága → `kind: 'food',` (az ág feltétele `entry.kind === 'food'`).
- `mockAdd` food ága → `kind: 'food',` (az ág feltétele `input.kind === 'food'`).
- `mockUpdate` — olvasd el, és ha `Ingredient` objektumot állít össze mezőnként (nem spreaddel), oda is vedd fel a `kind`-ot; ha `{ ...prev, ... }` spreaddel dolgozik, nincs teendő.

- [ ] **Step 11: Javítsd a real-módú teszt-fixture-öket**

```bash
cd frontend && pnpm build
```

A build kilistázza, hol hiányzik az immár required `kind`. Tipikusan `src/test/msw/handlers.ts` és néhány teszt-override. Mindegyikbe vedd fel a helyes `kind`-ot (food-fixture → `'food'`). Ismételd, amíg a build tiszta.

- [ ] **Step 12: Írd meg a FE tesztet**

`frontend/src/features/fuel/logic/kamraItems.test.ts` végére:

```ts
test('trusts the server kind and never re-derives it from the category (mezo-4orh)', () => {
  // 'supplement' is a legal category on a FOOD row — the add sheet offers it. The old code
  // derived kind from the category prefix, so this row came back as kind:'supplement' and the
  // edit sheet echoed that back onto the SHARED definition on every save.
  const ing = {
    ...ingredients[0],
    id: 'ing-kollagen', name: 'Kollagén por', category: 'supplement', kind: 'food' as const,
  }
  const [item] = buildKamraItems([ing], [])
  expect(item.kind).toBe('food')
})
```

- [ ] **Step 13: Futtasd a FE teszteket mindkét módban**

```bash
cd frontend && VITE_USE_MOCK=true pnpm test && VITE_USE_MOCK=false pnpm test
```

Elvárt: mindkét futás PASS.

- [ ] **Step 14: Mérd vissza kontrollált reverttel**

Állítsd VISSZA ideiglenesen a `kamraItems.ts` származtatását:

```ts
  const ingItems: PantryItem[] = ingredients.map(i => ({
    ...i,
    kind: i.category.startsWith('supplement-stim') ? 'stim'
      : i.category.startsWith('supplement') ? 'supplement' : 'food',
  }))
```

```bash
cd frontend && VITE_USE_MOCK=true pnpm test -- kamraItems
```

Elvárt: az új teszt **BUKIK** (`expected 'food', received 'supplement'`). Ha átmegy, a teszt nem méri a hibát — javítsd. Utána tedd vissza a javítást és futtasd újra: PASS.

- [ ] **Step 15: Commit**

```bash
git add api/feature/pantry/pantry.yml api/openapi.yml frontend/src/data/_client/api.gen.ts \
        backend/src/main/java/io/mrkuhne/mezo/feature/pantry/mapper/PantryMapper.java \
        backend/src/test/java/io/mrkuhne/mezo/feature/pantry/PantryApiIT.java \
        frontend/src/data/types.ts frontend/src/features/fuel/logic/kamraItems.ts \
        frontend/src/features/fuel/logic/kamraItems.test.ts \
        frontend/src/data/fuel/pantryPickables.ts frontend/src/data/fuel/pantry.ts \
        frontend/src/data/fuel/pantryHooks.ts frontend/src/test/msw/handlers.ts
git commit -m "$(cat <<'EOF'
fix(pantry): a kind a szervertől jöjjön, ne a category-ból származzon (mezo-4orh)

Az IngredientResponse eddig nem hordozta a kind-ot, a FE pedig a category prefixéből
számolta. Egy FOOD sor 'supplement' kategóriával kind:'supplement'-ként jött vissza, a
sheet ezt visszaküldte, és a definitionDiffers minden mentésnél elsült: 403 a
nem-szerzőnek egy tiszta ár/készlet szerkesztésre, a szerzőnek/OWNER-nek pedig a
MEGOSZTOTT definíció kind-ja íródott át csendben.

A kontraktus mostantól viszi a kind-ot, az Ingredient típus hordozza, és mindkét
FE-származtatás (kamraItems + pantryPickables.foodKind) eltűnt.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: `mezo-6omv` — őszintén nullable makrók

**Files:**
- Modify: `api/feature/pantry/pantry.yml` (`PantryMacros`)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/pantry/mapper/PantryMapper.java:174-176,226-232,327`
- Modify: `frontend/src/data/types.ts` (új `PantryMacrosVM` típus + `Ingredient`/`PantryItem`/`SupplementStashItem`)
- Modify: `frontend/src/features/fuel/components/MacroCells.tsx`
- Modify: `frontend/src/features/fuel/components/RecipeIngredientRow.tsx:24-31`
- Modify: `frontend/src/features/fuel/components/MealComposer.tsx:135-136,503-505`
- Modify: `frontend/src/features/fuel/components/KamraCard.tsx:58`
- Modify: `frontend/src/features/fuel/sheets/KamraPickSheet.tsx:41`
- Modify: `frontend/src/features/fuel/pages/KamraItemDetailPage.tsx` (`inputFromItem`, `macroCells`)
- Modify: `frontend/src/features/fuel/pages/RecipeEditorPage.tsx:49-52`
- Modify: `frontend/src/data/fuel/pantryPickables.ts` (`ZERO`)
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/pantry/PantryApiIT.java`
- Generated (ne szerkeszd): `api/openapi.yml`, `frontend/src/data/_client/api.gen.ts`

**Interfaces:**
- Consumes: a T4-ből az `Ingredient.kind` mező (a `types.ts` már módosult).
- Produces:
  - Kontraktus: `PantryMacros.kcal/p/c/f` mind `number | null` (a `required` listában maradnak).
  - FE: `export interface PantryMacrosVM { kcal: number | null; p: number | null; c: number | null; f: number | null }`, ez a típus áll az `Ingredient.macros`, a `PantryItem.macros` és a `SupplementStashItem.macros` helyén.
  - `MacroCellsProps.macros: { kcal: number | null; p: number | null; c: number | null; f: number | null }` (kiszélesítés — a nem-null hívók változatlanul működnek).
  - **`Recipe.macros` és `RecipeIngredientLine.contribution` NEM változik** (számított összegek, mindig van értékük).
  - `PantryMapper.nz(BigDecimal)` **megszűnik**.

**Kontextus:** `PantryMapper.java:175` és `:231` `nz()`-vel 0-ra tölti a kcal/protein/carbs/fat mezőket, így a 0 és a NULL megkülönböztethetetlen a dróton. Az S4 a HÍVÁSI oldalon szüntette meg az echót (a sheet már csak a változott definíció-mezőket küldi); a gyökér megmaradt, és bármely jövőbeli hívó, aki a read modellt visszaküldi, újranyitja a családot. A DB már ma őszinte: mind a négy oszlop külön-külön nullable a `pantry_catalog`-on — **nincs migráció ebben a taskban.**

- [ ] **Step 1: Írd át a kontraktust**

`api/feature/pantry/pantry.yml`:

```yaml
    # Honest nulls since mezo-6omv: a null macro means "no data on the shared definition",
    # a 0 means somebody actually entered zero. The old nz() zero-fill made them identical on
    # the wire, so any caller echoing the read model back wrote fabricated 0s onto a definition
    # every other user reads. The fields stay REQUIRED (always present) — only nullable.
    PantryMacros:
      type: object
      required: [kcal, p, c, f]
      properties:
        kcal: { type: number, nullable: true }
        p: { type: number, nullable: true }
        c: { type: number, nullable: true }
        f: { type: number, nullable: true }
```

- [ ] **Step 2: Regeneráld a kontraktust**

```bash
cd api/generate && npm run generate:api
cd ../../frontend && pnpm generate:api
cd .. && git diff --stat api/openapi.yml frontend/src/data/_client/api.gen.ts
```

Elvárt: mindkét fájl változott.

- [ ] **Step 3: Írd meg a bukó backend tesztet**

`PantryApiIT.java`:

```java
    @Test
    void testGetPantry_shouldReportNullMacros_whenTheDefinitionHasNone() throws Exception {
        UUID user = databasePopulator.populateUser("null-macros@test.local");
        PantryItemEntity item = populator.createFood(user, "Ismeretlen alapanyag", LocalDate.now().plusDays(9));
        PantryCatalogEntity c = item.getCatalog();
        c.setKcal(null);
        c.setProteinG(null);
        c.setCarbsG(BigDecimal.ZERO); // a REAL, entered zero — must survive as 0, not become null
        c.setFatG(null);
        catalogRepository.saveAndFlush(c);

        mockMvc.perform(get("/api/pantry").with(user(user)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.ingredients[?(@.name == 'Ismeretlen alapanyag')].macros.kcal")
                .value(hasItem(nullValue())))
            .andExpect(jsonPath("$.ingredients[?(@.name == 'Ismeretlen alapanyag')].macros.c")
                .value(hasItem(0)));
    }
```

Az autentikációs helpert és a `populator` szignatúrákat itt is a fájl meglévő tesztjeiből vedd át.

- [ ] **Step 4: Futtasd, és nézd meg, hogy BUKIK**

```bash
cd backend && ./mvnw clean test -Dtest='PantryApiIT#testGetPantry_shouldReportNullMacros_whenTheDefinitionHasNone' -Dmezo.test.use-testcontainers=true
```

Elvárt: FAIL — a `macros.kcal` 0-t ad vissza null helyett. Ha `Tests run: 0`, elgépelted a metódusnevet.

- [ ] **Step 5: Töröld az `nz()`-t a mapperből**

`PantryMapper.java`, `toIngredientResponse`:

```java
            // Honest nulls since mezo-6omv: nz() used to zero-fill these, making "no data" and
            // "a user-entered 0" identical on the wire — and any caller echoing the read model
            // back then wrote a fabricated 0 onto the SHARED definition.
            .macros(PantryMacros.builder()
                .kcal(c.getKcal()).p(c.getProteinG()).c(c.getCarbsG()).f(c.getFatG()).build())
```

`toSupplementResponse` — az objektum-szintű null ága is mezőnkéntire vált:

```java
            // Nutrition + commerce (mezo-1za9): supplements carry macros/nutrients/price to the UI
            // too. Since mezo-6omv every field is honestly nullable, so the response no longer
            // decides "no macros at all" from kcal alone — the UI hides the Makrók block when all
            // four are null, and a partial row (kcal known, fat unknown) stays partial.
            .macros(PantryMacros.builder()
                .kcal(c.getKcal()).p(c.getProteinG()).c(c.getCarbsG()).f(c.getFatG()).build())
```

Töröld a `private static BigDecimal nz(BigDecimal v)` helpert.

- [ ] **Step 6: Futtasd újra a backend tesztet**

```bash
cd backend && ./mvnw clean test -Dtest='PantryApiIT,PantryServiceIT,PantryCatalogApiIT' -Dmezo.test.use-testcontainers=true
```

Elvárt: PASS, `Tests run: N` (N > 0). Ha egy meglévő teszt 0-t várt ott, ahol most null jön, **ellenőrizd, hogy a régi elvárás a hibát rögzítette-e** — ha igen, írd át a tesztet nullra, és a kommentben hivatkozz a `mezo-6omv`-ra.

- [ ] **Step 7: Vezesd be a FE típust**

`frontend/src/data/types.ts`, a `PantryItemKind` közelébe:

```ts
/**
 * Pantry definition macros (mezo-6omv). `null` = the shared definition has no value for this
 * nutrient; `0` = somebody entered a real zero. Do NOT collapse them: the read model used to
 * zero-fill, and echoing that back wrote fabricated 0s onto a definition every user reads.
 * Computing consumers fall back with `?? 0` at their own boundary; displaying consumers print '—'.
 */
export interface PantryMacrosVM { kcal: number | null; p: number | null; c: number | null; f: number | null }
```

Cseréld le a három inline makró-típust:
- `Ingredient.macros: { kcal: number; p: number; c: number; f: number }` → `macros: PantryMacrosVM`
- `PantryItem.macros?: { ... }` → `macros?: PantryMacrosVM`
- `SupplementStashItem.macros?: { ... }` → `macros?: PantryMacrosVM`

**Ne nyúlj** a `Recipe.macros`-hoz és a `RecipeIngredientLine.contribution`-höz — azok számított összegek.

- [ ] **Step 8: Szélesítsd a `MacroCells` prop-típusát**

`frontend/src/features/fuel/components/MacroCells.tsx`:

```ts
export interface MacroCellsProps {
  /** Nullable since mezo-6omv: a null cell prints an em dash, a 0 prints "0". */
  macros: { kcal: number | null; p: number | null; c: number | null; f: number | null }
  perLabel?: string
  size?: 'sm' | 'md'
}
```

És a cella-renderben:

```tsx
            {macros[c.key] ?? '—'}
```

- [ ] **Step 9: Igazítsd a SZÁMOLÓ fogyasztókat (`?? 0` a határon)**

`RecipeIngredientRow.tsx:24-31`:

```ts
  // Scaled macros for this amount (gram-based ingredients scale by amount/per).
  // `?? 0` at the boundary since mezo-6omv: a missing definition macro contributes nothing to a
  // recipe line's total — but the underlying null is NOT rewritten anywhere.
  const scaled = {
    kcal: Math.round((ing.macros.kcal ?? 0) * ratio),
    p: +((ing.macros.p ?? 0) * ratio).toFixed(1),
    c: +((ing.macros.c ?? 0) * ratio).toFixed(1),
    f: +((ing.macros.f ?? 0) * ratio).toFixed(1),
  }
```

`RecipeEditorPage.tsx:49-52`:

```ts
    kcal: round((ing.macros.kcal ?? 0) * factor),
    p: round((ing.macros.p ?? 0) * factor),
    c: round((ing.macros.c ?? 0) * factor),
    f: round((ing.macros.f ?? 0) * factor),
```

`MealComposer.tsx:135-136` — az `ing?.macros.kcal ?? 0` alak már null-tűrő az opcionális `ing` miatt, de a mező is null lehet, ezért zárójelezd újra:

```ts
      kcal: round((ing?.macros.kcal ?? 0) * factor), p: round((ing?.macros.p ?? 0) * factor),
      c: round((ing?.macros.c ?? 0) * factor), f: round((ing?.macros.f ?? 0) * factor),
```

`MealComposer.tsx:503-505`:

```tsx
                                  ?? (src ? round((src.macros.kcal ?? 0) * (ing.amount / (src.per || 1))) : 0))
...
                                  ? round((src.macros.kcal ?? 0) * (amount / (src.per || 1)))
```

`pantryPickables.ts` — a `ZERO` alapértelmezés őszintén ismeretlenné válik:

```ts
// A stash item with no macro facts has NO data — not four zeroes (mezo-6omv).
const NO_MACROS: PantryMacrosVM = { kcal: null, p: null, c: null, f: null }
```

és a hívási helyen `macros: s.macros ?? { ...NO_MACROS },`.

- [ ] **Step 10: Igazítsd a MEGJELENÍTŐ fogyasztókat (`—`)**

`KamraCard.tsx:58`:

```tsx
          <b>{item.macros?.kcal ?? '—'}</b>
```

`KamraPickSheet.tsx:41`:

```tsx
          <b>{ing.macros.kcal ?? '—'}</b><small>kcal /{ing.per}{ing.unit}</small>
```

`KamraItemDetailPage.tsx`, a `macroCells` felépítése — a blokk akkor tűnik el, ha MIND A NÉGY null:

```ts
  const hasAnyMacro = item.macros != null
    && (item.macros.kcal != null || item.macros.p != null || item.macros.c != null || item.macros.f != null)
  const g = (v: number | null) => (v == null ? '—' : `${v} g`)
  const macroCells: MCell[] | null = hasAnyMacro && item.macros
    ? [
        { label: 'kcal', value: item.macros.kcal ?? '—', tone: 'sage' },
        { label: 'fehérje', value: g(item.macros.p), tone: 'coral' },
        { label: 'szénh.', value: g(item.macros.c), tone: 'gold' },
        { label: 'zsír', value: g(item.macros.f), tone: 'lav' },
      ]
    : null
```

- [ ] **Step 11: Zárd le a null-echo kockázatot az `inputFromItem`-ben**

Ez a task legfontosabb FE lépése: a `PantryItemInput` mezői `number | undefined`-ok, és a `put()` helper a `undefined` értékeket NEM küldi el. Egy null makró innentől **nem** szivároghat át `null`-ként a kérésbe, különben a „mező hiánya = ne nyúlj hozzá" szemantika átfordulna „állítsd NULL-ra"-ba a megosztott soron.

`KamraItemDetailPage.tsx`, `inputFromItem`:

```ts
  // Null macro = "no data on the shared definition" (mezo-6omv). It must stay OUT of the request:
  // the DTO cannot distinguish an omitted field from an explicit null, and applyDefinitionPartial
  // reads "absent" as "leave unchanged". Assigning null here would send `kcal: null` and blank the
  // field on a definition every other user reads.
  if (item.macros) {
    if (item.macros.kcal != null) base.kcal = item.macros.kcal
    if (item.macros.p != null) base.proteinG = item.macros.p
    if (item.macros.c != null) base.carbsG = item.macros.c
    if (item.macros.f != null) base.fatG = item.macros.f
  }
```

- [ ] **Step 12: Fordítsd le és futtasd a FE-t mindkét módban**

```bash
cd frontend && pnpm build
```

A build kilistázza a maradék null-hibákat (mock fixture-ök, teszt-override-ok). Javítsd őket: a **fixture** értékek maradjanak valós számok, csak a típus szélesedik; ahol egy mock a hiányzó adatot ma `?? 0`-val tölti (`pantryHooks.ts` `mockImport`/`mockAdd`/`mockAddFromCatalog` `macros:` sorai), ott az őszinte alak `input.kcal ?? null` — a mock így tükrözi a szerver viselkedését.

```bash
cd frontend && VITE_USE_MOCK=true pnpm test && VITE_USE_MOCK=false pnpm test
```

Elvárt: mindkét futás PASS.

- [ ] **Step 13: Commit**

```bash
git add api/feature/pantry/pantry.yml api/openapi.yml frontend/src/data/_client/api.gen.ts \
        backend/src/main/java/io/mrkuhne/mezo/feature/pantry/mapper/PantryMapper.java \
        backend/src/test/java/io/mrkuhne/mezo/feature/pantry/PantryApiIT.java \
        frontend/src
git commit -m "$(cat <<'EOF'
fix(pantry): a PantryMacros mezői őszintén nullable-ek (mezo-6omv)

A read modell nz()-vel 0-ra töltötte a kcal/fehérje/szénhidrát/zsír mezőket, így a
0 és a NULL megkülönböztethetetlen volt a dróton — és bármely hívó, aki a read
modellt visszaküldi, fabrikált 0-t írt a MEGOSZTOTT definícióra. Ez a definíció-echo
hibacsalád gyökere.

A kontraktus mezői mostantól nullable-ek (jelen, de lehet null), a mapperből eltűnt
az nz(), a FE számoló fogyasztói a saját határukon esnek vissza ?? 0-val, a
megjelenítők '—'-t írnak. Az inputFromItem a null makrót kihagyja a kérésből, hogy a
'mező hiánya = ne nyúlj hozzá' szemantika ne fordulhasson át nullázásba.

A definitionDiffers/numDiffers szándékosan változatlan: a 0-tolerancia csendben
eldobna egy valóban beírt 0-t.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: `mezo-qooi` — `status` oszlop, draft-beszúrás, szerző-promóció

**Files:**
- Create: `backend/src/main/resources/db/changelog/1.0.0/script/202609041000_mezo-qooi_pantry_catalog_status.sql`
- Modify: `backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml` (a fájl VÉGÉRE)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/pantry/entity/PantryCatalogEntity.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/pantry/service/PantryCatalogService.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/pantry/repository/PantryCatalogRepository.java`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/pantry/service/PantryService.java` (`updateItem`)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/recipe/service/RecipeWorkshopService.java:87`
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/meal/service/MealAiDraftService.java:204`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/pantry/PantryImportApiIT.java`
- Test: `backend/src/test/java/io/mrkuhne/mezo/feature/pantry/PantryCatalogApiIT.java`

**Interfaces:**
- Consumes: a T3-ból a `findByNaturalKey`-re épülő loader (a loader NEM állít `status`-t → a DB defaultja, `verified` érvényesül).
- Produces:
  - `PantryCatalogEntity.STATUS_DRAFT = "draft"`, `PantryCatalogEntity.STATUS_VERIFIED = "verified"`, `getStatus()`/`setStatus(String)`.
  - `PantryCatalogService.findOrCreate(UUID authorId, PantryCatalogEntity candidate, boolean trusted)` — a harmadik paraméter jelentése kiszélesedik: HIT-en tiltja a `mergeIfAuthor`-t (mint eddig), MISS-en `draft` státuszú sort szúr be.
  - `PantryCatalogRepository.findByDeletedFalseAndStatusOrderByNameAsc(String status)` — a `findByDeletedFalseOrderByNameAsc()` **helyett** (a régi metódus törlődik, hogy ne lehessen véletlenül a draftokat is behúzó változatot hívni).

**Kontextus:** `PantryImportService.java:112` a `findOrCreate(userId, candidate, !manualReview)` hívással csak a `mergeIfAuthor`-t tiltja le, tehát csak natural-key TALÁLAT esetén véd. MISS esetén az `insertOrBind` (`PantryCatalogService:174-196`) továbbra is beszúr egy teljes, globálisan látható megosztott definíciót alacsony megbízhatóságú scrape/photo adatból, ember jóváhagyása előtt.

**Megerősítő flow ma nincs:** a `manual-review` csak a `pantry_import` feed-sor státusza, amit a `FuelKamraPage.tsx:291` badge-ként kirajzol. Ezért a `draft` kijárata: **a szerző definíció-szerkesztése promotál**. Natural-key TALÁLAT esetén szándékosan NEM promotálunk.

- [ ] **Step 1: Írd meg a migrációt**

Create `backend/src/main/resources/db/changelog/1.0.0/script/202609041000_mezo-qooi_pantry_catalog_status.sql`:

```sql
-- Kamra follow-ups (mezo-qooi): an unreviewed import candidate must not become globally visible
-- shared content before a human confirms it. The S4 manual-review gate only covered the natural-key
-- HIT branch (no mergeIfAuthor); a MISS still inserted a full definition from low-confidence
-- scrape/photo data straight into the catalog every user searches.
--
-- 'draft' rows stay on their author's own shelf but are excluded from catalog search and from the
-- PantryNameIndex the AI matcher / Receptműhely build. The author's own definition edit promotes
-- the row to 'verified' (PantryService#updateItem) — the state transition avoids the pending-vs-
-- verified natural-key duplication a separate staging table would create.
--
-- Default 'verified' on purpose: every EXISTING row was written through a path that is either
-- loader master content or a deliberate user action, so today's behaviour is unchanged.
ALTER TABLE pantry_catalog ADD COLUMN status text NOT NULL DEFAULT 'verified';
ALTER TABLE pantry_catalog
    ADD CONSTRAINT ck_pantry_catalog_status CHECK (status IN ('draft', 'verified'));
```

- [ ] **Step 2: Kösd be a master changelogba**

`backend/src/main/resources/db/changelog/1.0.0/1.0.0_master.yml`, a fájl **legvégére** (a `202609021410_mezo-qw37.4_pantry_catalog_split` bejegyzés UTÁN):

```yaml
  - changeSet:
      id: "1.0.0:202609041000_mezo-qooi_pantry_catalog_status"
      author: daniel.kuhne
      changes:
        - sqlFile:
            relativeToChangelogFile: true
            path: script/202609041000_mezo-qooi_pantry_catalog_status.sql
```

- [ ] **Step 3: Futtasd a liquibase lintert**

```bash
node scripts/lint-liquibase.mjs
```

Elvárt: PASS. Ha a changeset nincs bekötve vagy a constraint-prefix rossz, itt bukik.

- [ ] **Step 4: Vedd fel a mezőt az entity-re**

`PantryCatalogEntity.java`, a `source` mező után:

```java
    /** Unreviewed import candidate (mezo-qooi) — excluded from catalog search and the name index. */
    public static final String STATUS_DRAFT = "draft";

    /** Confirmed content: loader master, a deliberate user action, or a promoted draft. */
    public static final String STATUS_VERIFIED = "verified";

    @NotNull
    @Column(nullable = false)
    private String status = STATUS_VERIFIED; // ck_pantry_catalog_status
```

- [ ] **Step 5: Írd meg a bukó IT-t (draft-beszúrás + keresésből kizárás)**

`PantryImportApiIT.java`:

```java
    @Test
    void testImport_shouldInsertDraftCatalogRow_andHideItFromSearch_whenConfidenceIsLow() throws Exception {
        UUID user = databasePopulator.populateUser("draft-import@test.local");
        // Low confidence -> manual-review. A natural-key MISS used to insert a full, globally
        // visible shared definition from scrape/photo data before any human confirmed it (mezo-qooi).
        importOnce(user, "Bizonytalan Kekszféle", /* confidence */ 0.1);

        PantryCatalogEntity row = catalogRepository.findByNaturalKey("Bizonytalan Kekszféle", null).orElseThrow();
        assertThat(row.getStatus()).isEqualTo(PantryCatalogEntity.STATUS_DRAFT);
        assertThat(catalogRepository.searchAll("%kekszféle%", Limit.of(50))).isEmpty();
        assertThat(catalogRepository.findByDeletedFalseAndStatusOrderByNameAsc(
            PantryCatalogEntity.STATUS_VERIFIED)).extracting(PantryCatalogEntity::getName)
            .doesNotContain("Bizonytalan Kekszféle");
    }

    @Test
    void testImport_shouldInsertVerifiedCatalogRow_whenConfidenceIsHigh() throws Exception {
        UUID user = databasePopulator.populateUser("trusted-import@test.local");
        importOnce(user, "Biztos Kekszféle", /* confidence */ 0.99);

        assertThat(catalogRepository.findByNaturalKey("Biztos Kekszféle", null).orElseThrow().getStatus())
            .isEqualTo(PantryCatalogEntity.STATUS_VERIFIED);
        assertThat(catalogRepository.searchAll("%biztos kekszféle%", Limit.of(50))).hasSize(1);
    }
```

A `confidence` küszöböt a `PantryScrapeProperties` adja — a fájl meglévő manual-review tesztjéből vedd át a konkrét értékeket, ne találgass. Az `importOnce(...)` helpert a T2-ben már bevezetted; bővítsd egy `confidence` paraméterrel, vagy adj hozzá egy második overloadot.

- [ ] **Step 6: Írd meg a promóciós IT-t**

`PantryCatalogApiIT.java` (vagy `PantryServiceIT.java`, amelyikben a definíció-szerkesztés tesztjei vannak — kövesd a fájl mintáját):

```java
    @Test
    void testUpdateItem_shouldPromoteDraftToVerified_whenTheAuthorEditsTheDefinition() throws Exception {
        UUID user = databasePopulator.populateUser("promote@test.local");
        PantryItemEntity item = populator.createFood(user, "Draftos Étel", LocalDate.now().plusDays(5));
        PantryCatalogEntity c = item.getCatalog();
        c.setCreatedBy(user);
        c.setStatus(PantryCatalogEntity.STATUS_DRAFT);
        catalogRepository.saveAndFlush(c);

        // A definition change (new kcal) by the row's AUTHOR is exactly the "I checked this" gesture
        // the manual-review badge asks for — it promotes the draft (mezo-qooi).
        mockMvc.perform(put("/api/pantry/" + item.getId()).with(user(user))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"kind":"food","name":"Draftos Étel","per":100,"unit":"g","kcal":321}
                    """))
            .andExpect(status().isOk());

        assertThat(catalogRepository.findById(c.getId()).orElseThrow().getStatus())
            .isEqualTo(PantryCatalogEntity.STATUS_VERIFIED);
    }

    @Test
    void testUpdateItem_shouldLeaveDraft_whenOnlyStateFieldsChange() throws Exception {
        UUID user = databasePopulator.populateUser("no-promote@test.local");
        PantryItemEntity item = populator.createFood(user, "Maradjon Draft", LocalDate.now().plusDays(5));
        PantryCatalogEntity c = item.getCatalog();
        c.setCreatedBy(user);
        c.setStatus(PantryCatalogEntity.STATUS_DRAFT);
        catalogRepository.saveAndFlush(c);

        // A pure price edit is NOT a review of the definition's facts.
        mockMvc.perform(put("/api/pantry/" + item.getId()).with(user(user))
                .contentType(MediaType.APPLICATION_JSON)
                .content("""
                    {"kind":"food","name":"Maradjon Draft","price":1490,"priceUnit":"/kg"}
                    """))
            .andExpect(status().isOk());

        assertThat(catalogRepository.findById(c.getId()).orElseThrow().getStatus())
            .isEqualTo(PantryCatalogEntity.STATUS_DRAFT);
    }
```

A HTTP-hívás alakját (autentikáció, `put` vs `patch`, a JSON kötelező mezői) a fájl meglévő update-tesztjeiből másold — a fenti body csak a lényeget mutatja.

- [ ] **Step 7: Futtasd, és nézd meg, hogy BUKNAK**

```bash
cd backend && ./mvnw clean test -Dtest='PantryImportApiIT,PantryCatalogApiIT' -Dmezo.test.use-testcontainers=true
```

Elvárt: az új tesztek FAIL-lel (fordítási hiba is elfogadható jelzés ebben a lépésben, ha a `findByDeletedFalseAndStatusOrderByNameAsc` még nem létezik — akkor előbb a Step 8 repository-részét vidd be, majd futtasd újra, hogy VALÓDI assert-bukást láss).

- [ ] **Step 8: Vezesd át a `trusted` paramétert a MISS ágra**

`PantryCatalogService.java`:

```java
    /**
     * Natural-key find-or-create. {@code trusted = false} means the caller's facts are not yet
     * confirmed by a human (S4 Task 7 fix round 1 + mezo-qooi): on a HIT it skips
     * {@link #mergeIfAuthor} entirely, and on a MISS it inserts the new definition as
     * {@code status = draft} — visible on the author's own shelf, but excluded from catalog search
     * and from the {@code PantryNameIndex} until the author's own definition edit promotes it
     * ({@code PantryService#updateItem}). The old parameter only guarded the HIT branch, so a MISS
     * still published unreviewed scrape/photo data to every user.
     */
    public PantryCatalogEntity findOrCreate(UUID authorId, PantryCatalogEntity candidate, boolean trusted) {
        Objects.requireNonNull(candidate.getName(), "candidate.name");
        candidate.setName(candidate.getName().strip());
        if (candidate.getBrand() != null) {
            candidate.setBrand(candidate.getBrand().strip());
        }
        return catalogRepository.findByNaturalKey(candidate.getName(), candidate.getBrand())
            .map(this::revive)
            .map(existing -> trusted ? mergeIfAuthor(authorId, existing, candidate) : existing)
            .orElseGet(() -> insertOrBind(authorId, candidate, trusted));
    }
```

`insertOrBind` kap egy `trusted` paramétert:

```java
    private PantryCatalogEntity insertOrBind(UUID authorId, PantryCatalogEntity candidate, boolean trusted) {
        TransactionTemplate own = new TransactionTemplate(transactionManager);
        own.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
        try {
            UUID id = own.execute(status -> {
                // createdBy MUST be set: a null createdBy means "loader master content", so a
                // user-typed definition without it would silently join the seeded master catalog.
                candidate.setCreatedBy(authorId);
                if (candidate.getSource() == null) {
                    candidate.setSource("manual");
                }
                // An untrusted candidate lands as a draft (mezo-qooi): on the author's shelf, out
                // of everyone else's search and out of the AI name index until they confirm it.
                candidate.setStatus(trusted
                    ? PantryCatalogEntity.STATUS_VERIFIED : PantryCatalogEntity.STATUS_DRAFT);
                return catalogRepository.saveAndFlush(candidate).getId();
            });
            return catalogRepository.findById(id).orElseThrow(); // re-read in the caller's session
        } catch (DataIntegrityViolationException raced) {
            // The race loser takes the SAME path as an ordinary hit — and honours `trusted` there
            // too, so an untrusted loser never merges its facts into the winner.
            return catalogRepository.findByNaturalKey(candidate.getName(), candidate.getBrand())
                .map(this::revive)
                .map(existing -> trusted ? mergeIfAuthor(authorId, existing, candidate) : existing)
                .orElseThrow(() -> raced);
        }
    }
```

A kétparaméteres `findOrCreate(authorId, candidate)` overload változatlanul `true`-t ad tovább.

- [ ] **Step 9: Zárd ki a draftokat a három olvasási ponton**

`PantryCatalogRepository.java` — a két kereső query kap egy status-feltételt (a T3-ban már `lower(trim(...))`-re javított alakhoz add hozzá):

```java
    @Query("select c from PantryCatalogEntity c where c.deleted = false and c.status = 'verified' "
        + "and (lower(trim(c.name)) like :like or lower(trim(coalesce(c.brand, ''))) like :like) "
        + "order by c.name asc")
    List<PantryCatalogEntity> searchAll(@Param("like") String like, Limit limit);

    @Query("select c from PantryCatalogEntity c where c.deleted = false and c.status = 'verified' "
        + "and c.kind = :kind "
        + "and (lower(trim(c.name)) like :like or lower(trim(coalesce(c.brand, ''))) like :like) "
        + "order by c.name asc")
    List<PantryCatalogEntity> searchByKind(@Param("like") String like, @Param("kind") String kind, Limit limit);
```

A név-index forrása státusz-paraméteres lesz, a régi metódus **törlődik**:

```java
    /**
     * The live global index the AI name matcher and the Receptműhely are built from. Status-scoped
     * on purpose (mezo-qooi): an unreviewed draft must not be auto-matched into somebody's meal.
     * Callers pass {@link PantryCatalogEntity#STATUS_VERIFIED}.
     */
    List<PantryCatalogEntity> findByDeletedFalseAndStatusOrderByNameAsc(String status);
```

Hívási helyek (`RecipeWorkshopService.java:87`, `MealAiDraftService.java:204`):

```java
        PantryNameIndex nameIndex = PantryNameIndex.of(
            pantryCatalogRepository.findByDeletedFalseAndStatusOrderByNameAsc(PantryCatalogEntity.STATUS_VERIFIED));
```

Ehhez a `PantryCatalogEntity` importja kell mindkét fájlba. **Ellenőrizd az ArchUnit feature-ciklus gráfot:** a `recipe → pantry` és a `meal → pantry` él már létezik (mindkét fájl ma is importál a `feature.pantry`-ből), tehát új él nem keletkezik.

- [ ] **Step 10: Írd meg a promóciót**

`PantryService.updateItem`, a definíció-ágon belül, közvetlenül az `applyDefinitionPartial` UTÁN:

```java
            mapper.applyDefinitionPartial(c, req); // dirty-checked, flushed on commit
            // A draft is an UNREVIEWED import candidate; the author actually editing its facts is
            // the confirmation gesture the manual-review badge asks for, so it promotes the row
            // (mezo-qooi). Deliberately author-only: passing requireEditable as a bystander OWNER
            // is not a review of somebody else's scraped data.
            if (PantryCatalogEntity.STATUS_DRAFT.equals(c.getStatus())
                && user.getId().equals(c.getCreatedBy())) {
                c.setStatus(PantryCatalogEntity.STATUS_VERIFIED);
            }
```

- [ ] **Step 11: Futtasd az érintett teszteket**

```bash
cd backend && ./mvnw clean test -Dtest='Pantry*,MealAiDraft*,RecipeWorkshop*,ArchitectureTest' -Dmezo.test.use-testcontainers=true
```

Elvárt: PASS, `Tests run: N` (N > 0), 0 failure. Az `ArchitectureTest` külön figyelendő: ha a feature-ciklus szabály bukik, a Step 9 importja adott hozzá egy tiltott élt — akkor ne az entity-konstansot importáld, hanem add át a `"verified"` literált a hívó oldalon, kommenttel.

- [ ] **Step 12: Mérd vissza kontrollált reverttel**

Állítsd vissza ideiglenesen az `insertOrBind` hívást `insertOrBind(authorId, candidate)`-re (mindig verified), futtasd:

```bash
cd backend && ./mvnw clean test -Dtest='PantryImportApiIT' -Dmezo.test.use-testcontainers=true
```

Elvárt: `testImport_shouldInsertDraftCatalogRow_andHideItFromSearch_whenConfidenceIsLow` **BUKIK**. Tedd vissza a javítást, futtasd újra: PASS.

- [ ] **Step 13: Commit**

```bash
git add backend/src/main/resources/db/changelog backend/src/main/java backend/src/test/java
git commit -m "$(cat <<'EOF'
fix(pantry): ellenőrizetlen import-jelölt draft katalógus-sorként szúródjon be (mezo-qooi)

A manual-review kapu eddig csak a natural-key TALÁLAT ágat védte (nincs mergeIfAuthor);
MISS esetén az insertOrBind továbbra is beszúrt egy teljes, globálisan látható
megosztott definíciót alacsony megbízhatóságú scrape/photo adatból, ember jóváhagyása
előtt.

Új pantry_catalog.status oszlop (draft|verified, a meglévő sorok verified-ek). A
findOrCreate harmadik paramétere mostantól mindkét ágat kapuzza. A draft sorok
kimaradnak a katalógus-keresésből és a PantryNameIndex-ből; a szerző saját
definíció-szerkesztése promotálja őket verified-re. Natural-key találatnál
szándékosan nincs promóció.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: `mezo-ho5w` + doksik + teljes kapusor

**Files:**
- Modify: `docs/features/pantry.md` (§3 megőrzési terv, §4/§7 natural key, §9 import-kapu, makró-nullable)
- Modify: `docs/CODEMAP.md` (generált)

**Interfaces:**
- Consumes: minden korábbi task kimenetét.
- Produces: semmit kód-oldalon.

**Kontextus:** a `202609021410_mezo-qw37.4_pantry_catalog_split.sql:122-131` létrehozza a `pantry_item_definition_archive` egyirányú biztonsági hálót, és a SQL kommentje ígér egy későbbi takarító changesetet — dátum és issue nélkül. **A táblát ebben a kötegben NEM dobjuk el:** a prod split működése nincs bizonyítva, a felhasználók közötti definíció-összevonás visszafordíthatatlan, és a repóban egyetlen changesetnek sincs rollback blokkja. Csak a megőrzési terv készül el, és a `mezo-ho5w` issue NYITVA marad.

- [ ] **Step 1: Írd meg a megőrzési tervet**

`docs/features/pantry.md`, a §3-ban a `pantry_item_definition_archive`-ot említő bekezdés után:

```markdown
**Megőrzési terv (`mezo-ho5w`).** Az archive tábla egyirányú biztonsági háló: a split előtti
20 definíció-oszlop minden sorra, a soft-deleted-eket is beleértve. Nincs FK-ja, nincs
JPA-mappingje, és nem is lesz.

A takarító changeset feltétele — MINDHÁROM teljesüljön, produkciós adaton:

1. a split legalább egy teljes release-cikluson át fut éles adaton, definíció-visszaállítási
   igény nélkül;
2. minden archive sor lefedett a mai adattal, azaz nincs olyan archivált definíció, aminek nincs
   élő megfelelője a `pantry_catalog`-ban;
3. a `pantry_item` minden sora egy létező `pantry_catalog` sorra mutat.

Ellenőrző lekérdezés a 2. és 3. ponthoz:

```sql
-- 2) archivált definíciók, amiknek nincs katalógus-megfelelője (elvárt: 0 sor)
select a.id, a.name, a.brand
from pantry_item_definition_archive a
where not exists (
    select 1 from pantry_catalog c
    where lower(trim(c.name)) = lower(trim(a.name))
      and lower(trim(coalesce(c.brand, ''))) = lower(trim(coalesce(a.brand, '')))
);

-- 3) árva polc-sorok (elvárt: 0 sor)
select i.id from pantry_item i
left join pantry_catalog c on c.id = i.catalog_id
where c.id is null;
```

Amíg mindhárom feltétel nincs igazolva produkción, a tábla marad. A takarítás külön
changeset lesz — a split SQL-je immutábilis, sosem szerkeszthető.
```

- [ ] **Step 2: Frissítsd a doksi többi érintett szakaszát**

`docs/features/pantry.md`:

- **§9 (import-kapu):** ma csak a HIT-ági `allowMerge=false` javítást dokumentálja. Egészítsd ki a MISS ággal: a `findOrCreate` harmadik paramétere `trusted` néven mindkét ágat kapuzza, MISS-en `status='draft'` sort szúr be, a draft kimarad a `searchAll`/`searchByKind`/`PantryNameIndex` hármasból, és a szerző definíció-szerkesztése promotálja verified-re; natural-key találatnál nincs promóció. (`mezo-qooi`)
- **§4/§7 (natural key):** rögzítsd, hogy a foldolás KIZÁRÓLAG Postgres-oldali, és hogy a `PantryCatalogLoader` is a `findByNaturalKey`-re kulcsol, nem in-memory Java mapre. (`mezo-imet`)
- A `kind` és a makrók kontraktus-változása: az `IngredientResponse` hordozza a `kind`-ot, a `PantryMacros` mezői nullable-ek, a „nincs adat" és a „beírt 0" két külön állapot. (`mezo-4orh`, `mezo-6omv`)

- [ ] **Step 3: Regeneráld a CODEMAP-et és lintelj**

```bash
node scripts/gen-codemap.mjs
node scripts/lint-docs.mjs --errors-only
node scripts/lint-liquibase.mjs
git diff --stat docs/CODEMAP.md
```

Elvárt: a lint-docs `result: PASS`, a lint-liquibase hibátlan. A CODEMAP diffje a T6 új changesetjét és az esetleges új teszt-metódusokat tükrözi.

- [ ] **Step 4: Futtasd a TELJES fókuszált backend kapusort (előtérben)**

```bash
cd backend && ./mvnw clean test -Dtest='Pantry*,MealAiDraft*,MealService*,MealApiIT,RecipeService*,RecipeApiIT,RecipeWorkshop*,RecipeBreakdown*,Protocol*,Intake*,HabitEvaluator*,ArchitectureTest' -Dmezo.test.use-testcontainers=true
```

Elvárt: `Tests run: N` (N > 0), 0 failure, 0 error. **Ne „BUILD SUCCESS"-t nézz — darabszámot.**

- [ ] **Step 5: Futtasd a teljes frontend kapusort (előtérben)**

```bash
cd frontend && pnpm build && VITE_USE_MOCK=true pnpm test && VITE_USE_MOCK=false pnpm test
```

Elvárt: build tiszta, MINDKÉT teszt-futás PASS.

- [ ] **Step 6: Commit**

```bash
git add docs/features/pantry.md docs/CODEMAP.md
git commit -m "$(cat <<'EOF'
docs(pantry): megőrzési terv az archive táblára + a köteg doksi-frissítései (mezo-ho5w)

A pantry_item_definition_archive takarításához eddig se dátum, se feltétel nem
tartozott. Most három konkrét feltétel és két ellenőrző lekérdezés rögzíti, mikor
dobható el — addig marad. A takarító changeset NEM készült el: a prod split működése
nincs bizonyítva, a definíció-összevonás visszafordíthatatlan, és rollback blokk nincs
a repóban. A mezo-ho5w nyitva marad.

Mellette a köteg többi javítása is bekerült a doksiba: a Postgres-oldali natural-key
foldolás (mezo-imet), a draft/verified import-kapu (mezo-qooi), a szerver-oldali kind
(mezo-4orh) és a nullable makrók (mezo-6omv). CODEMAP regenerálva.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
EOF
)"
```

---

## Zárás (a köteg után, NEM task)

1. `git fetch origin && git merge origin/main` az ágba — **utána ÉRTELMI audit** a co-touched fájlokon (szemantikai merge-ütközés textuális konfliktus nélkül már háromszor volt), és `node scripts/gen-codemap.mjs` + `git diff --stat docs/CODEMAP.md` a merge UTÁN is.
2. `git push -u origin feat/pantry-catalog-followups`, self-PR, majd
   `gh pr view <n> --json mergeable,mergeStateStatus` — konfliktusos PR-en a GitHub EGYETLEN checket sem futtat.
3. `gh pr checks --watch` (ez mehet háttérben), zöld CI-ig.
4. bd: `mezo-4orh`, `mezo-qooi`, `mezo-6omv`, `mezo-imet`, `mezo-rxy0`, `mezo-gmy0` zárható; **`mezo-ho5w` NYITVA marad** — kommentbe a megőrzési terv három feltétele és a két ellenőrző lekérdezés.
5. A `--no-ff` merge parancsot a felhasználó futtatja — `git push origin HEAD:main` blokkolt.
