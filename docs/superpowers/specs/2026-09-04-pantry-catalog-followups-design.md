# Kamra-utókövetés köteg — design

- **Dátum:** 2026-09-04
- **Vezető issue:** `mezo-4orh` (P1)
- **Köteg:** `mezo-4orh`, `mezo-qooi`, `mezo-6omv`, `mezo-imet`, `mezo-rxy0`, `mezo-ho5w`, `mezo-gmy0`
- **Branch:** `feat/pantry-catalog-followups` (`origin/main` @ `5d8bf580c`)
- **Előzmény:** az S4 katalógus-split (`mezo-qw37.4`) záró review-jának hét lelete

## Miért egy köteg

Mind a hét lelet ugyanazt a fájlkört érinti: `PantryMapper`, `PantryCatalogService`,
`PantryImportService`, `PantryCatalogLoader`, `PantryCatalogRepository`, `kamraItems.ts`
és a `pantry.yml` kontraktus. Külön-külön hét PR lenne ugyanabban a mapperben,
egymást keresztező merge-ökkel; a kontraktus-regenerálás (`api/openapi.yml`,
`api.gen.ts`) is kétszer futna feleslegesen.

## A hibacsalád

A `mezo-4orh` és a `mezo-6omv` ugyanannak a családnak a harmadik és negyedik esete:
**a kliens visszaküldi a read modellt, a szerver pedig különbségnek látja.** Korábbi
esetek (mind javítva): name strip aszimmetria, unit echo, nullázott makrók echója.
A közös elv, amit ez a köteg kikényszerít:

> A szerver állapotát a kliens **hordozza**, ne **származtassa újra**; és a read modell
> ne állítson olyat (0 kcal), amit a tárolt adat nem mond ki (NULL).

---

## A) `mezo-4orh` — a `kind` végig a szerverről (P1)

### A hiba

[`frontend/src/features/fuel/logic/kamraItems.ts:59-65`] a `kind`-ot a `category`
stringből vezeti le (`startsWith('supplement-stim')` → stim, `startsWith('supplement')`
→ supplement, különben food). Egy FOOD sorra, aminek a category-ja `supplement`
(legális enum-érték, a sheet fel is kínálja) a FE `kind:'supplement'`-et számol.
A `PantryItemRequest.kind` required, ezért az `AddPantryItemSheet.submit()` mindig
elküldi — a `definitionLocked` kapun kívül —, így `PantryMapper.definitionDiffers`
(`:104`, pontos enum-egyezés) **minden mentésnél** elsül:

- nem-szerző: 403 `PANTRY_CATALOG_NOT_EDITABLE` egy tisztán ár/készlet szerkesztésre;
- szerző/OWNER: a MEGOSZTOTT sor `kind`-ja csendben `supplement`-re íródik át, azaz
  a food átvándorol minden felhasználó stash-ébe.

### Premissza-korrekció

Az issue azt javasolja, hogy „vidd át a szerver `kind`-ját". A recon kiderítette, hogy
**az `IngredientResponse`-nak nincs `kind` mezője** (`api/feature/pantry/pantry.yml:177-207`),
és a `frontend/src/data/types.ts` `Ingredient` interfésze sem hordozza. A szerver
oldalon a kind csak *implicit* invariáns: `PantryService.getPantry` (`:52-57`) a
`"food".equals(e.getCatalog().getKind())` alapján **szűri** az ingredients ágat.
Tehát ma nincs mit átvinni — a mezőt létre kell hozni.

### Döntés

**A kontraktus hordozza a kind-ot** (a vizsgált alternatívák: FE-oldali `kind:'food'`
hardcode a `PantryService` invariánsára hivatkozva; illetve csak a sheet-kapu javítása).
Az implicit invariánsra hivatkozó hardcode ma bizonyíthatóan helyes, de egy későbbi
szerver-oldali projekció-változás csendben újra elrontja; a csak-sheet javítás a
tünetet kezeli, a hibás `kind` viszont bent marad a FE domain modellben
(`KamraItemDetailPage`, szűrők, ikonok).

### Változás

1. `api/feature/pantry/pantry.yml`: `IngredientResponse` kap
   `kind: { type: string, enum: [food, supplement, stim, med] }`, felvéve a `required`
   listára is. Kontraktus-regen mindkét irányban.
2. `PantryMapper.toIngredientResponse`: `.kind(...)` a `c.getKind()`-ból (ugyanaz az
   enum-konverzió, amit a `toItemResponse` már használ).
3. `frontend/src/data/types.ts`: `Ingredient.kind: PantryItemKind` (required).
4. A `pantryHooks` szerver→domain mapper átviszi a mezőt; a mock adat
   (`frontend/src/data/fuel/pantry.ts`) minden ingredient sora kap `kind`-ot.
5. `kamraItems.ts`: az `ingItems` ág származtatása törlődik, `{ ...i }` marad.

### Amit szándékosan NEM változtatunk

Az `AddPantryItemSheet.submit()` továbbra is feltétel nélkül küldi a `kind`-ot és a
`name`-et (a `PantryItemRequest` required-nek deklarálja őket). Ez a javítás után
valódi azonosság-echo: a FE értéke szó szerint a szerveré. A `put()`/`lock` kapuba
tolni őket nagyobb változás lenne ugyanazért az eredményért — és a `name`-nél már ma
is helyes ugyanez az érvelés.

### Teszt

- `kamraItems.test.ts` új eset: `category: 'supplement'` + szerver `kind: 'food'`
  → a kimenet `kind` marad `food`. **Kontrollált reverttel visszamérve**, hogy a
  régi kódon elbukjon.
- BE IT (`PantryApiIT` vagy társa): `getPantry` ingredients ága `kind: food`-ot ad
  vissza egy `category = 'supplement'` katalógus-sorra is.

---

## B) `mezo-6omv` — őszintén nullable makrók (P2)

### A hiba

`PantryMapper.java:175` (`toIngredientResponse`) és `:231`
(`toSupplementStashResponse`) `nz()`-vel (`:327`, `v == null ? BigDecimal.ZERO : v`)
0-ra tölti a kcal/protein/carbs/fat mezőket, így a 0 és a NULL megkülönböztethetetlen
a dróton. Az S4 a HÍVÁSI oldalon szüntette meg az echót; a gyökér megmaradt, és
bármely jövőbeli hívó, aki a read modellt visszaküldi, újranyitja a családot.

A DB már ma őszinte: mind a négy oszlop külön-külön nullable a `pantry_catalog`-on.
Csak a kontraktus hazudik.

### Döntés

**Mezőnként nullable** (a vizsgált alternatívák: objektum-szinten nullable `macros`;
illetve mezőnként nullable, de a FE-n csak a Kamra-úton kezelve). Az objektum-szintű
null hazudik a részleges sorokra — ha csak a kcal ismert, vagy elveszik a kcal, vagy
visszajön a 0-tömés a másik háromra —, tehát a gyökeret nem szünteti meg. A DB négy
külön nullable oszlopa és a `mezo-32ko` nova-precedens is a mezőnkénti mellett szól.

### Változás

1. `pantry.yml`: `PantryMacros.kcal/p/c/f` → `nullable: true`. A `required` listában
   **maradnak**: a mező jelen van, csak az értéke lehet null (ugyanaz a minta, mint a
   `PantryStock.expires`-nél).
2. `PantryMapper`: `nz()` mindkét hívási helyről törölve, a helper is.
3. A `:231` „ha `c.getKcal() == null`, az egész `macros` null" ága mezőnkéntire vált:
   a stash válasz is mindig épít objektumot, benne a négy — esetleg null — mezővel.
   A Makrók blokk elrejtését a UI dönti el (mind a négy null).
4. FE `Macros` típus: `{ kcal: number | null; p: number | null; c: number | null; f: number | null }`.
5. Fogyasztók szétválasztva:
   - **számoló** utak (`MealComposer`, `RecipeIngredientRow`, `WorkshopIngredientRow`,
     `pantryPickables`) a határukon `?? 0`-val esnek vissza — dokumentált, egy helyen;
   - **megjelenítő** utak (`KamraItemDetailPage`, Kamra kártya) `—`-t írnak a null helyére,
     `0 g`-t a valódi 0-ra.

### Amit szándékosan NEM változtatunk

A `definitionDiffers` / `numDiffers` érintetlen marad: a 0-tolerancia csendben eldobna
egy valóban beírt 0-t. A javítás után a `null` és a `0` a `numDiffers`-ben is két
különböző érték — pontosan ezt akarjuk.

### Kockázat, amit a tervnek ellenőriznie kell

Az `AddPantryItemSheet` üres makró-mezője ma `undefined`-ot ad (a `put()` nem küldi el).
A nullable kontraktus után igazolni kell, hogy egy szerkesztetlen mező **továbbra sem**
küldődik el explicit `null`-ként — különben a „mező hiánya = ne nyúlj hozzá" szemantika
átfordulna „állítsd NULL-ra"-ba a megosztott soron.

---

## C) `mezo-qooi` — `status` oszlop a katalóguson (P2)

### A hiba

`PantryImportService.java:112` a `findOrCreate(userId, candidate, !manualReview)`
hívással csak a `mergeIfAuthor`-t tiltja le, tehát csak natural-key **TALÁLAT** esetén
véd. MISS esetén a `PantryCatalogService.insertOrBind` (`:174-196`) továbbra is beszúr
egy teljes, globálisan látható megosztott definíciót alacsony megbízhatóságú
scrape/photo adatból, ember jóváhagyása előtt. A bizalmi érvelés, ami a találatra
vonatkozott, legalább ilyen erősen áll a létrehozásra is.

### Döntés

**`status` oszlop a `pantry_catalog`-on** (a vizsgált alternatívák: a jelöltet
`is_deleted=true` sorhoz kötni; illetve MISS esetén egyáltalán nem létrehozni
katalógus-sort). Az `is_deleted` túlterhelése összemosná a „törölt" és a „még nem
ellenőrzött" állapotot, és a `findByCreatedByIsNull()` szándékosan nem szűri a
deletedet — új lyukat nyitna. A „ne jöjjön létre sor" változat a legtisztább elvileg,
de át kellene alakítani a feed-sor payloadját és a polc-sor létrejöttének idejítését.
A státusz-átmenet ráadásul elkerüli a pending/verified natural-key duplikációt.

### Megerősítő flow: ma nincs

A `manual-review` ma **csak** a `pantry_import` feed-sor státusza, amit a
`FuelKamraPage.tsx:291` egy „ellenőrzés" badge-ként kirajzol. Semmi nem lépteti tovább.
A `draft` státusznak tehát ki kell találni a kijáratát.

**Döntés: a szerző definíció-szerkesztése promotál.** Amikor a szerző a meglévő
`PATCH /pantry/items/{id}` úton tényleges definíció-változtatással átmegy a
`requireEditable` kapun, a sor `draft` → `verified`. Ez pontosan az a mozdulat, amit az
„ellenőrzés" badge kér: a felhasználó megnézi és menti. Nincs új endpoint és nincs új
UI-elem. (A vizsgált alternatívák: explicit „Rendben" gomb a feed-soron — új endpoint +
új design 2.0 UI, érezhetően nagyobb köteg; illetve a promociót külön issue-ba tolni —
az félkész állapotgépet hagyna hátra.)

Vállalt korlát: aki sosem szerkeszti a sorát, annak a definíciója tartósan `draft`
marad. Nem vész el semmi — a saját polcán látja —, csak mások keresésében és az
AI-párosításban nem jelenik meg. Ez a helyes alapértelmezés egy ellenőrizetlen sorra.

### Változás

1. Új Liquibase changeset (`db/changelog/1.0.0/script/`, a masterbe bekötve):
   ```sql
   alter table pantry_catalog add column status varchar(16) not null default 'verified';
   alter table pantry_catalog add constraint ck_pantry_catalog_status
       check (status in ('draft', 'verified'));
   ```
   A default miatt minden meglévő sor `verified` — a mai viselkedés nem változik.
2. `PantryCatalogEntity`: `status` mező, default `"verified"`.
3. `PantryCatalogService.findOrCreate` harmadik paramétere `allowMerge` → `trusted`-dé
   általánosul, és **mindkét ágat** kapuzza: HIT-en a `mergeIfAuthor`-t (mint eddig),
   MISS-en pedig `insertOrBind` `status = 'draft'`-tal szúr be. Az `insertOrBind`
   `REQUIRES_NEW` + `DataIntegrityViolationException` race-recovery szemantikája
   érintetlen.
4. Kizárás három ponton:
   - `PantryCatalogRepository.searchAll` → `and c.status = 'verified'`
   - `PantryCatalogRepository.searchByKind` → ugyanaz
   - `findByDeletedFalseOrderByNameAsc` (a `PantryNameIndex` forrása a
     `RecipeWorkshopService`-ben és a `MealAiDraftService`-ben) → verified-re szűrve.
5. Promoció: `PantryService.updateItem`-ben, a `requireEditable` kapu után, ha a sor
   `draft` és a hívó a szerzője, `verified`-re vált.

### Amit szándékosan NEM csinálunk

Natural-key **találat** esetén nem promotálunk: hogy egy másik felhasználó ugyanazt a
nevet begépelte, az nem hitelesíti az adatot.

### Teszt

- IT: manual-review import MISS → a katalógus-sor `status = 'draft'`, és **nem jön
  vissza** a `/pantry/catalog` keresésből; utána a szerző definíció-változtató PATCH-e
  után `verified`, és megjelenik.
- IT: nem-manual-review import MISS → azonnal `verified` (regresszió-védelem).

---

## D) `mezo-imet` — egy foldolás, a Postgresé (P3)

### A hiba

`PantryCatalogLoader.naturalKey()` (`:116-119`) Javában kisbetűsít
(`toLowerCase(Locale.ROOT)`), és ezzel épít egy in-memory `byKey` mapet (`:57-58`),
míg az `uq_pantry_catalog_natural` index Postgres `lower(trim(...))`-el számol
(`202609021410_mezo-qw37.4_pantry_catalog_split.sql:58-59`). Ahol a kettő eltér
(pl. görög végső szigma: Java `ς`, Postgres `σ`), a loader nem találja meg a létező
sort, beszúr, és az egyedi indexen **elbukik az alkalmazás indítása**.

A `PantryCatalogRepository.findByNaturalKey` javadocja már ma pontosan ezt a
tanulságot mondja ki — a loader nem lett hozzáigazítva.

### Változás

1. A loader `byKey` mapja helyett seed-soronként
   `repository.findByNaturalKey(row.name(), null)` (147 lekérdezés induláskor,
   elhanyagolható). A foldolás így egyedül Postgresé. A `naturalKey()` helper eltűnik
   (vagy ha a teszt hivatkozik rá, oda költözik).
2. Kapcsolódó kisebb: `searchAll`/`searchByKind` `lower(c.name)` → `lower(trim(c.name))`,
   és a needle is trimelve a `PantryCatalogService.search`-ben — a kereső úton ma
   ártalmatlan, de az „egy foldolás" invariánst helyreállítja.

### Nyitott terv-részlet

A szigma-eset tesztelése ma nehéz, mert a loader fix seed-fájlból olvas. Két út:
a `readCatalog()` teszt-oldali behelyettesítése, vagy a repository-hívásra váltás
közvetlen igazolása (a régi kódon bukó IT: pre-inzertált, csak a foldolásban eltérő
sor + loader-újrafuttatás → nincs `DataIntegrityViolationException`, nincs duplikátum).
A plan írásakor dől el; teszt nélkül nem megy be.

---

## E) `mezo-rxy0` — ár és mértékegység egy egységként (P3)

`PantryImportService.java:120-125` az S4 javítása után a `priceHuf`-ot és a
`priceUnit`-ot külön-külön írja felül, csak ha az adott érték nem null. Egy árat hozó,
de mértékegységet nem hozó újraimport az új összeg mellé otthagyja a korábbi
mértékegységet (1490 `db` helyett 1490 `kg`).

```java
if (req.getPriceHuf() != null || req.getPriceUnit() != null) {
    item.setPriceHuf(req.getPriceHuf());
    item.setPriceUnit(req.getPriceUnit());
}
```

A pár így együtt mozog: vagy mindkettő az új draftból, vagy egyik sem — a „ne nullázd
ki, amit a felhasználó beírt" eredeti szándék (a teljesen ár-mentes újraimport nem nyúl
hozzá) megmarad. Teszt: import IT-eset arra, hogy az árat hozó, egység nélküli
újraimport a `priceUnit`-ot is felülírja (null-ra).

---

## F) `mezo-ho5w` — megőrzési terv, takarítás nélkül (P3)

A `202609021410_mezo-qw37.4_pantry_catalog_split.sql:122-131` létrehozza a
`pantry_item_definition_archive` egyirányú biztonsági hálót, és a SQL kommentje ígér
egy későbbi takarító changesetet — dátum és issue nélkül.

**Ebben a kötegben nem dobjuk el a táblát.** A prod split működése nincs bizonyítva,
és a felhasználók közötti definíció-összevonás visszafordíthatatlan; a repóban egyetlen
changesetnek sincs rollback blokkja.

Ami elkészül: `docs/features/pantry.md` §3 kap egy konkrét megőrzési tervet — mi a
feltétele a takarításnak, és milyen lekérdezéssel igazolható, hogy nincs rá szükség
(az archive sorszáma vs. a `pantry_catalog` + `pantry_item` lefedettsége). Ugyanez
bekerül a `mezo-ho5w` issue-ba is.

**A `mezo-ho5w` issue nyitva marad** — nem záródik ezzel a köteggel.

---

## G) `mezo-gmy0` — törékeny teszt-állítás a globális seed ellen (P3)

`PantryItemRepositoryIT.java:69-83` a kereső tesztben `containsExactly`-t használ egy
GLOBÁLIS katalógus ellen, amit a `ResetDatabase` szándékosan nem ürít (a
`created_by IS NULL` master sorok megmaradnak, és a `PantryCatalogLoader` minden
profilban lefut). Ma átmegy, mert a 147 soros seedben nincs `zab`/`kreatin`, de bármely
új seed sor elronthatja. A `%myprot%` állítás már át lett írva `contains(...)`-ra
ugyanezért — a `%zab%` nem kapta meg ugyanezt a kezelést.

Változás: `containsExactly` → `contains(...)` + `doesNotContain(...)`. Mellette a
`PantryCatalogRepository.findByCreatedByIsNull()` javadocja kap egy tagmondatot arról,
hogy szándékosan **nem** szűri a deletedet (a Task 5 revive-on-upsert emiatt működik).

---

## Prior art

A researcher külső mintákat gyűjtött a köteg két valódi tervezési kérdéséhez.

**Nullable tápérték-mezők — átvéve.** A USDA FoodData Central és az Open Food Facts is
kemény különbséget tesz „nincs adat" és „0" között; a USDA dokumentációja kifejezetten
kimondja, hogy a hiányzó érték nem nulla értéket jelent, hanem azt, hogy az adatközlő
nem szolgáltatta. Az OFF API null/hiányzó kulcsot ad vissza, a 0-ra töltést a fogyasztó
explicit döntésévé teszi — sosem a kanonikus rekordba égetve.
(<https://fdc.nal.usda.gov/GBFPD_Documentation/>,
<https://openfoodfacts.github.io/openfoodfacts-server/api/>)
Ez pontosan a B) szakasz döntése: a kontraktus őszinte, a `?? 0` a *számoló* fogyasztó
határán, dokumentáltan.

**Tri-state PATCH szemantika — konceptuálisan átvéve, mechanizmus nélkül.** Az RFC 7396
(JSON Merge Patch) három drót-állapotot definiál mezőnként: hiányzó = ne változtass,
jelen `null`-lal = töröld, jelen értékkel = írd felül.
(<https://www.rfc-editor.org/info/rfc7396/>,
<https://www.baeldung.com/jackson-field-absent-vs-null-difference>)
A mi `put()` helperünk pontosan ezt a „hiányzó = ne nyúlj hozzá" szemantikát valósítja
meg már ma; `JsonNullable<T>` wrappert **nem** vezetünk be — a B) szakasz kockázati
pontja épp azt ellenőrzi, hogy a szerkesztetlen mező ne váltson át explicit `null`-ra.

**Wikidata `somevalue`/`novalue` snak-típusok — elvetve mint túl gazdag.**
(<https://www.wikidata.org/wiki/Help:Statements>) A négyállapotú modell egy fitnesz-app
makró-mezőihez fölösleges; a gyakorlati tanulság — „nincs adat" és „ellenőrzött 0"
két külön állapot a tárolásban, a kontraktusban és a UI-ban is — beépült.

**Open Food Facts „publish-then-verify" moderálása — tudatosan elvetve.** Az OFF az
OCR-ből és névtelen bevitelből származó adatot azonnal a globális táblába írja, és a
korrekciót a tömegre bízza. (<https://en.wikipedia.org/wiki/Open_Food_Facts>) Ez a
minta az OFF léptékén működik; a mezo néhány felhasználójánál nincs az a tömeg, ami
önjavítana, viszont a rossz adat mindenkinél azonnal látszik. Ezért megy a C) szakasz
a `draft` → `verified` kapuval.

**MusicBrainz merge-with-redirect + kockázat-rétegzett moderálás — részben átvéve.**
(<https://musicbrainz.org/doc/Merge>) A duplikátumot nem write-time próbálják
megelőzni, hanem olcsó, elsőosztályú későbbi művelettel olvasztják össze; a
kis-kockázatú szerkesztés azonnal él, a nagy-kockázatú sorba kerül. Az utóbbi elv
pontosan a C) döntése (a `trusted` paraméter kockázat szerint rétegez). A merge-műveletet
**nem** vezetjük be — a `findOrCreate` natural-key + fill-only merge-e ma ellátja ezt a
szerepet; ha később mégis kell, külön issue.

## Codebase terrain

Az investigator CODEMAP-first felmérése alapján.

**Érintett feature-blokkok:** `pantry` (BE + `api/feature/pantry/pantry.yml`),
`fuel` (a Kamra FE-felületek), `recipe` (`PantryNameIndex` fogyasztó), `meal`
(`MealAiDraftService`, szintén `PantryNameIndex`). Doksik: `docs/features/pantry.md`,
`docs/features/recipe.md`; a driving plan `docs/superpowers/plans/2026-09-02-s4-pantry-catalog.md`.

**A köteg magja:**

| Fájl | Miért |
|---|---|
| `api/feature/pantry/pantry.yml` | `IngredientResponse.kind` (A), `PantryMacros` nullable (B) |
| `backend/.../pantry/mapper/PantryMapper.java` | `:175`/`:231`/`:327` `nz()`, `:104` `definitionDiffers` |
| `backend/.../pantry/service/PantryCatalogService.java` | `:88` `findOrCreate`, `:174` `insertOrBind`, `:60` `search` |
| `backend/.../pantry/service/PantryImportService.java` | `:112` a `trusted` hívás, `:120-125` az ár-pár |
| `backend/.../pantry/service/PantryService.java` | `:52-57` kind-projekció, `updateItem` promoció |
| `backend/.../pantry/PantryCatalogLoader.java` | `:57-58` `byKey`, `:116-119` `naturalKey` |
| `backend/.../pantry/repository/PantryCatalogRepository.java` | `searchAll`, `searchByKind`, `findByDeletedFalseOrderByNameAsc`, `findByCreatedByIsNull` javadoc |
| `frontend/src/features/fuel/logic/kamraItems.ts` | `:59-65` a kind-származtatás |
| `frontend/src/data/types.ts` | `Ingredient` (`:332-345`), `Macros`, `PantryItem` |

**Követendő minták:**

- **Definíció/állapot szétválasztás.** Minden katalógus-mező írója a
  `PantryMapper.applyDefinition*` + `definitionDiffers` + `requireEditable` hármason
  megy át; az állapot-mezők (`applyUserFields*`) sosem kapuzottak. Egyik javítás sem
  moshatja el ezt a határt.
- **`findOrCreate` az egyetlen tölcsér.** Minden pantry-író (`PantryService`,
  `PantryImportService`, `ProtocolSeedData`, AI meal draft, Receptműhely) ezen megy át.
  A C) fix ezt a paramétert általánosítja, nem épít párhuzamos mechanizmust.
- **Fill-only merge, sosem felülírás** (`mergeIfAuthor` / `fillIfNull`).
- **`nz()`-kerülés precedense:** a nova már a `mezo-32ko`-ban őszinte null lett.
- **Kontraktus-first:** `api/feature/pantry/pantry.yml` → `cd api/generate && npm run generate:api`
  → `cd frontend && pnpm generate:api`, és mindkét generált fájl (`api/openapi.yml`,
  `frontend/src/data/_client/api.gen.ts`) commitolva. A `contract-drift` CI job
  `git diff --exit-code`-dal ellenőrzi.
- **Hibakódok:** `{DOMAIN}_{ACTION}_{REASON}` a `messages.properties`-ben.

**Csapdák:**

- **ArchUnit:** `@Entity`/`@Service`/`@RestController` csomag-helye, kizárólag
  konstruktor-injektálás, nincs osztályszintű `@Transactional`, nincs nyers
  `RuntimeException`/`IllegalArgumentException` a `techcore`-on kívül, és befagyasztott
  feature-ciklus gráf (`recipe → meal` élt tilos hozzáadni).
- **Liquibase:** a kiadott changesetek immutábilisak — a C) status-oszlop **új**
  changeset, a split SQL-jét tilos szerkeszteni. Prefix-konvenció (`ck_`) és
  `node scripts/lint-liquibase.mjs` a kapu; rollback blokk tudatosan nincs a repóban.
- **`ddl-auto=validate`:** az entity-változás és a migráció ugyanabba a commitba megy.
  A B) makró-javítás **nem** igényel migrációt (az oszlopok már nullable-ek).
- **`PantryCatalogLoader` minden profilban lefut** (`@Order(50)`, nincs `demodata` mögé
  zárva) — ezért van a G) teszt egyáltalán kitéve a seednek.
- **`insertOrBind` `REQUIRES_NEW` + race-recovery** — a C) fixnek meg kell őriznie.
- **`docs/features/pantry.md` §9** ma a HIT-ági `allowMerge=false` javítást
  dokumentálja, a MISS útról hallgat — a C) fix után ki kell egészíteni.
- **CODEMAP freshness gate** (`node scripts/gen-codemap.mjs --check`) — a merge UTÁN is
  regenerálni kell (szemantikai merge-ütközés textuális konfliktus nélkül már háromszor
  volt).

## Kapuk

- Backend (fókuszált, előtérben):
  `cd backend && ./mvnw clean test -Dtest='Pantry*,MealAiDraft*,MealService*,MealApiIT,RecipeService*,RecipeApiIT,RecipeWorkshop*,RecipeBreakdown*,Protocol*,Intake*,HabitEvaluator*,ArchitectureTest' -Dmezo.test.use-testcontainers=true`
  — a flag nélkül a fix-DB mód versenyhelyzetbe kerül és hamis hibákat ad. Mindig
  teszt-darabszámot nézünk, nem „BUILD SUCCESS"-t.
- Frontend: `pnpm build`, majd `VITE_USE_MOCK=false pnpm test` **és**
  `VITE_USE_MOCK=true pnpm test` (a csupasz `pnpm test` kétszer mockot futtat).
- `node scripts/gen-codemap.mjs`, `node scripts/lint-docs.mjs --errors-only`,
  `node scripts/lint-liquibase.mjs`.
- Kontraktus-regen mindkét generált fájlra.
- CI a hiteles kapu: self-PR, zöld check, majd lokális `--no-ff` merge.

## Kimenet

Zárul: `mezo-4orh`, `mezo-qooi`, `mezo-6omv`, `mezo-imet`, `mezo-rxy0`, `mezo-gmy0`.
Nyitva marad: `mezo-ho5w` (megőrzési terv dokumentálva, takarítás a prod bizonyítása után).
