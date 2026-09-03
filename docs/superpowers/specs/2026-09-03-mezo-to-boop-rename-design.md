# Mezo → Boop átnevezés

- **bd:** mezo-r89o (epic) · szeletek: mezo-4dld, mezo-q6rv, mezo-94im, mezo-w2eu
- **Dátum:** 2026-09-03
- **Állapot:** elfogadott spec, implementáció előtt

## Probléma

Az app neve `Mezo`, és ugyanez a szó a companion-persona neve is — az, aki a
felhasználóhoz beszél. Mindkettő `Boop` lesz.

A név azonban nem egy helyen él. A `mezo` szó 3 483 fájlban, ~48 000
előfordulásban szerepel, és ezek nem ugyanazok az állatok: van köztük márkanév,
kódazonosító, Spring property-prefix, adatbázisba mentett kulcs, liquibase
changeset-id, localStorage-kulcs, magyar köznév és — a legkellemetlenebb — a
`timezone` szó közepe.

Egy naiv keresés-csere ezen a repón adatvesztéssel jár. Ez a spec azt rögzíti,
hol húzódik a határ.

## Az elv

> **Amit olvasnak, az Boop. Amit tárolunk, az marad mezo.**

Márka és persona → `Boop`. Kulcs, azonosító, perzisztált sor → érintetlen.

Ez nem óvatosság, hanem az egyetlen olvasat, amely mellett az átnevezés nem
töri el a futó rendszert. A tárolt kulcs a múlt rekordja; a név a jelen
márkája. A kettő szétválasztása teszi az egészet visszagörgethetővé.

## Döntések

| Kérdés | Döntés |
|---|---|
| Mélység | Márka + kód. A történelmi réteg (bd id-k, lezárt tervek) marad. |
| Infra-identitás | **Semmi nem változik.** GitHub repo, k8s namespace, PG adatbázis, ghcr image nevek, Dolt db, `MEZO_*` env varok mind `mezo` maradnak. |
| `/mezo/*` útvonal | → `/boop/*`, a meglévő `LegacyPathRedirect` mintájára visszafelé kompatibilis átirányítással. |
| `mz-` / `mzc-` / `mzh-` CSS prefix | Marad. Láthatatlan; 3 754 előfordulás, 181 vizuális baseline mögötte — tiszta kockázat nulla haszonnal. |
| bd issue-prefix | Marad `mezo-`. A ~19 400 régi id úgyis az marad; vegyes prefix csak zajt adna. |
| `"mezo"` persona-kulcs | Marad. Csak a `displayName` lesz `Boop`. |
| Spring property-prefix `mezo.*` | **Marad.** A `MEZO_FEATURE_*` env varok relaxed bindinggel kötődnek hozzá, tehát a nevük a prefixből származik — átnevezése némán szétkötné őket (lásd lent). |
| Szeletelés | Négy önállóan zöld PR, értékkel elöl. |

## Prior art

Külső irodalom helyett a releváns előzmény **házon belül** van: a
`/today → /nap` és `/insights → /mezo` átnevezés (`mezo-d20.1.1`). Az akkor
bevezetett `LegacyPathRedirect` komponens
(`frontend/src/app/router.tsx:107,237`) ma is él, és pontosan ezt a problémát
oldja meg: a régi útvonal-prefix néma átirányítását az újra, hogy a máshol
tárolt deeplinkek ne szakadjanak el.

A `/mezo → /boop` váltás ezt a komponenst használja újra, nem ír újat. Ez
egyben bizonyíték is arra, hogy a route-átnevezés ebben a kódbázisban bejáratott
művelet, nem kísérlet.

Ami a `mezo → boop` cserét külön esetté teszi az `insights → mezo`-hoz képest:
az `insights` szó nem fordult elő kulcsként, köznévként, sem más szó belsejében.
A `mezo` mindhármat megteszi — innen a következő szakasz.

## Codebase terrain

### A rétegek és a méretük

| Réteg | Példa | Nagyságrend |
|---|---|---|
| bd issue id-k | `mezo-d20.5.1`, `mezo-hq44` | ~19 400 |
| Liquibase changeset id-k | `202607031400_mezo` | ~700 |
| Kódazonosítók | `io.mrkuhne.mezo`, `MezoChip`, `mezoFit` | ~2 500 |
| Spring property-prefix | `mezo.companion.flags` | ~200 (marad) |
| Márka / persona copy | `<title>Mezo`, `Mezo · olvasat` | ~250 |
| Docs próza | `docs/features/*`, `docs/superpowers/plans/*` | ~700 fájl |

### Kivétel-lista — ezekhez nem nyúlunk

Ez a lista a teljes token-inventárból származik
(`git grep -oh -E '[A-Za-z0-9_]*[Mm]ezo[A-Za-z0-9_]*'`), nem becslés.

**Más szó belseje — a néma rontás forrása:**

- `timezone`, `timezoneId`, `getTimezone`, `getTimezoneOffset`
- `mezonkenti` — „mezőnkénti", a magyar *mező* szóból

**Domain-szakszó, nem márka:**

- `mezociklus`, `Mezociklus`, `Mezociklusok`, `mezociklust` — a *mesocycle*
  magyar neve. A kód nagyrészt már szétválasztja: `Meso*` a domain
  (`MesocycleBuilderPage`, `ActiveMesoCard`), `Mezo*` a márka. A magyar próza
  nem, ezért ott szóalak szerint kell szűrni.

**Perzisztált kulcs — az átírásuk adatot ront:**

- `mezo.auth.token` (localStorage; átnevezése kilépteti a felhasználót),
  `mezo-theme`, `mezo-tab:`, `mezo-chat`, `mezo.kalauz.v1`,
  `mezo-morning-training-snooze`, `mezo-sleep-escal-snooze`,
  `mezo-night-wake:*`, `mezo.needsnudge.*`
- `"mezo"` persona-kulcs: `CharacterService.key("mezo")`,
  `ConferenceTranscriptEnvelope.Turn("mezo", …)`, FE `PersonaOrb expertKey`,
  a TabBar `id`, `features/tutorial/registry/mezo.ts` `id`
- `i-mezo` ikonkulcs (sprite-azonosító, több helyen semleges default)
- Liquibase changeset id-k — a `DATABASECHANGELOG` táblában szó szerint
  szerepelnek; átírásuk éles adatbázison a migrációk újrafutását jelenti

**Infra és teszt-identitás (a fenti döntés szerint):**

- `mezo_pg`, `mezo_test`, `_mezo_branch`, `MEZO_*` env varok

**Történelem:**

- bd issue id-k, `docs/superpowers/plans/*`, lezárt specek

### Miért marad a property-prefix

A `mezo.*` Spring property-prefix első ránézésre tiszta belső kódazonosító, és
a „márka + kód" döntés alá esne. Nem az.

Az `application.yml` az env varok egy részét explicit placeholderrel köti
(`jwt-secret: ${MEZO_JWT_SECRET:…}`) — ezek a prefixtől függetlenek. Három
kapcsoló viszont **nincs** benne az yml-ben, és Spring relaxed bindinggel
kötődik, vagyis a nevük a property-névből *származik*:

```
mezo.feature.companion.enabled  ←  MEZO_FEATURE_COMPANION_ENABLED
mezo.feature.proactive.enabled  ←  MEZO_FEATURE_PROACTIVE_ENABLED
mezo.feature.llm-log.enabled    ←  MEZO_FEATURE_LLM_LOG_ENABLED
```

Mindhármat a `k8s/backend/deployment.yaml` állítja. Ha a prefix `boop.*` lenne,
a k8s-ben maradó `MEZO_FEATURE_*` nem kötne semmire — **és nem dobna hibát**.
A `companion` és a `proactive` megúszná (az yml defaultja mindkettőnél `true`,
az override redundáns), de az `llm-log` defaultja `false`: az LLM audit log
némán kikapcsolna élesben.

Mivel az infra-döntés szerint az env varok `MEZO_*` maradnak, a prefix is
marad. Ez egyben megőrzi a `-Dmezo.test.use-testcontainers` és
`-Dmezo.excludedTestGroups` flageket a CI-ben és a helyi receptekben.

Ezzel az S3 szeletből eltűnik az egyetlen néma hibaosztály: ami marad — a
package-átnevezés — fordítási időben hangos.

## Szeletek

Négy bd issue, négy `feat/` branch, négy self-PR, mindegyik önállóan zöld CI-vel.
A sorrend értékvezérelt: az S1 után már Boop beszél a felhasználóhoz, a maradék
három tiszta mechanika alatta.

### S1 — Persona és látható copy (mezo-4dld)

**Backend.** A persona-önmegnevezés a rendszerpromptokban:

- `feature/companion/service/ChatService.java:68` — `Te vagy a mezo, …` →
  `Te vagy Boop, …` (a magyar névelő eltűnik: a `Boop` tulajdonnév)
- `feature/proactive/service/MemoirGenerator.java:74`
- `feature/character/service/KonziliumVerdictRound.java:257`
- `feature/character/service/PortraitWriter.java:48`
- `feature/companion/llm/CompanionHelloRunner.java`,
  `feature/notification/controller/NotificationController.java`

Megjelenített név és transzkript-címke:

- `CharacterService.java:140` — `displayName("Mezo")` → `"Boop"`
  (a `key("mezo")` **változatlan**)
- `KonziliumVerdictRound.java:242` — `"Mezo: "` transzkript-prefix
- `ChatHistory.java:27` és `MemoryEmbeddingWriter.java:99` — a `"Mezo: "` /
  `"\nMezo: "` render. Ezek futásidőben állnak elő a tárolt előzményből, így
  nem kell migráció; a már meglévő embeddingekben marad a régi címke, ami
  szemantikailag közömbös.

**Frontend.** ~25 látható mondat, többek közt: `Mezo · olvasat`,
`Mezo üzenetei`, `Mezo belső tanácsa — ők dolgoznak a karakteren`,
`Mezo olvassa a célt…`, `Mezo olvasata`, `Mezo javaslatok`,
`Mezo · heti elemzés`, `Mezo · napzárás`, `Mezo megszólal`,
`Replan · Mezo`, a `TabBar` felirata (`label: 'Mezo'` → `'Boop'`, az
`id: 'mezo'` és `icon: 'i-mezo'` változatlan).

**Alkalmazás-azonosság:** `frontend/index.html` `<title>`,
`frontend/vite.config.ts` `manifest.name` / `manifest.short_name`.

**Ellenőrzés:** FE tesztek mindkét módban (mock és valós), companion ITek
(`ContextSnapshotAssemblerIT`, `CompanionToolsRenderIT`, karakter-ITek).

### S2 — Frontend azonosítók és `/boop` route (mezo-q6rv)

**Átnevezések.** Komponensek és fájlok: `MezoChip` → `BoopChip`,
`MezoHubPage`, `MezoMessagesSheet`, `MezoMessageItem`, `NapMezoPage`,
`MezoTab`. Hookok és kontextus: `MezoThreadProvider`, `MezoThreadContext`,
`MezoThread`, `useMezoThread`, `partitionMezoThread`. Adatnevek: `mezoFit`,
`getMezoFit`, `RecipeMezoFit`, `mezoNote`, `mezoNoteSeed`, `mezoNoteSource`,
`emptyMezoNote`, `derivedMezoNote`, `getMezoNote`, `mezoMessages`,
`buildMezoMessages`, `checkMezoContext`, `mezotile`, `MezoData`.

**Útvonal.** `/mezo/*` → `/boop/*` — ~100 literal a `router.tsx`-ben,
navigációkban, teszteken és a `feedMock` deeplinkjeiben. A `router.tsx:237`
mintájára új sor:
`{ path: 'mezo/*', element: <LegacyPathRedirect prefix="/mezo" to="/boop" /> }`.
A meglévő `/insights → /mezo` redirect célja `/boop`-ra frissül, hogy a
backend `AppNotificationKind` `/insights/*` deeplinkjei egy ugrással érkezzenek.

**Csomag:** `frontend/package.json` `name`.

**Nem változik:** `i-mezo`, `mz-`/`mzc-`/`mzh-`, minden localStorage-kulcs.

**Ellenőrzés:** FE tesztek mindkét módban, build, vizuális regresszió (a
baselineeknek változatlanul kell átmenniük — ha nem, az elrontott selektor
jele), plusz egy teszt arra, hogy `/mezo/knowledge` a `/boop/knowledge`-re
landol.

### S3 — Backend package (mezo-94im)

**Package:** `io.mrkuhne.mezo` → `io.mrkuhne.boop` (~1 700 fájl importja,
`main` és `test` egyaránt). Osztályok: `MezoApplication` → `BoopApplication`,
`TestMezoApplication`, `MezoApplicationIT`, `PeopleMezoNoteSource`,
`PeopleMezoNoteAdapter`, `PeopleMezoNoteIT`.

**Maven:** `artifactId` és `name` `mezo` → `boop`. Ha a build az artifactId-ből
származtatja a jar nevét, a `Dockerfile` `COPY` mintáját is igazítani kell — az
image nevek (`ghcr.io/mrkuhne/mezo-backend`) a döntés szerint változatlanok.

**Nem változik:** a Spring property-prefix (`mezo.*`), az `application.yml`
gyökere, a `@ConfigurationProperties` prefixek, a `FeaturesConfiguration`
kapcsoló-konstansai, a `@Scheduled` cron-placeholderek, a `-Dmezo.test.*` és
`-Dmezo.excludedTestGroups` flagek a `pom.xml`-ben, a CI-ben és a docsban.
Az indoklás fent, a „Miért marad a property-prefix" szakaszban.

**Grep-guard.** A szelet záró lépése egy futtatható ellenőrzés: a
`backend/src/main/java` alatt `mezo` csak a kivétel-listán szereplő alakokban
maradhat (property-string, persona-kulcs, bd id kommentben, `mezociklus`,
`timezone`). Ez fogja el a félbehagyott package-átnevezést.

**Ellenőrzés:** teljes backend IT-suite CI-ben
(`-Dmezo.test.use-testcontainers=true` — változatlan parancs), ArchUnit
(a layer-subpackage szabályok az új package-gyökérre), `docs/CODEMAP.md`
újragenerálása ugyanebben a változásban.

### S4 — Docs és agent-tooling (mezo-w2eu)

`README.md`, `AGENTS.md`, `CLAUDE.md`, `docs/features/*`, `docs/CODEMAP.md`,
`.agents/skills/mezo-*` → `.agents/skills/boop-*` (öt skill: api-contract,
backend, deploy, frontend, testing).

**Nem változik:** `docs/superpowers/plans/*` és a lezárt specek — azok annak a
kornak a rekordjai, és a bennük lévő `mezo-` bd id-kkel együtt konzisztensek.

## Hibakezelés és visszagörgetés

Nincs futásidejű hibakezelési kérdés: az átnevezés fordítási idejű. A
kockázatkezelés a szeletelésben és a grep-guardban van.

- **S1–S2** visszagörgetése: egyetlen `git revert` a merge commiton.
- **S3** a legnagyobb, de a property-prefix kivétele után nincs benne néma
  hibaosztály: a package-átnevezés hibája fordítási idejű. A grep-guard a
  félbehagyott átnevezést fogja el, a teljes IT-suite CI-ben fut.
- **Deploy-kockázat nincs**: az infra-identitás (namespace, DB, image, env,
  SealedSecret) érintetlen, tehát egyik szelet sem igényel koordinált
  secret-frissítést vagy adatbázis-migrációt.

## Amit ez a spec kifejezetten nem tesz

- Nem nevezi át a GitHub repót, a k8s namespace-t, a PG adatbázist, a container
  image-eket, a Dolt db-t, sem a `MEZO_*` env varokat. Ezek külön bd issue-ként
  átnevezhetők, amikor van rá deploy-ablak.
- Nem írja át a bd issue id-ket és a lezárt tervdokumentumokat.
- Nem nyúl a `mz-` CSS prefixhez, sem a `mezo.*` Spring property-prefixhez.
- Nem cseréli a `mezociklus` szakszót.
