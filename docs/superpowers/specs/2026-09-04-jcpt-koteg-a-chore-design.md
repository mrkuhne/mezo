# Köteg A — elavult javadocok + `MeWeekProperties` nyugdíjazása

- **Dátum:** 2026-09-04
- **bd issue-k:** `mezo-jcpt.11` (két elavult javadoc-állítás), `mezo-jcpt.7` (`MeWeekProperties` nyugdíjazása)
- **Szülő epic:** `mezo-jcpt` — napi értékelés újratervezés (C-hibrid score + Mozaik 2.0 UI)
- **Státusz:** jóváhagyva (2026-09-04)

## Miért egy szelet

A két issue egyetlen PR-ban megy, ami **kifejezett felülbírálása** az `AGENTS.md`/`CLAUDE.md`
„1 bd issue + 1 branch" házirendjének, user-jóváhagyással (a döntés indoklása a `mezo-jcpt`
epic 2026-09-04-i kommentjében). Az indok: mindkettő triviális, kockázatmentes, backend-only
takarítás a `mezo-jcpt.4` szelet után maradt hulladék körül, és **átfedő fájlokat érintenek** —
a `DayScoreService` javadoc-ja és a companion feature-doksi ugyanazt a „még nem töröltük"
TODO-jelölőt hordozza, amit a `.7` old fel. Külön PR-ban a két változás egymás
merge-konfliktusa lenne.

A maradék négy gyerek-issue (`.9`, `.6`, `.8`, `.10`) **külön PR/branch marad** — contract-változás,
kereszt-feature perf-fix, 27 pinned tesztbe gyűrűző adatbővítés, illetve architekturális
konzisztencia-fix; egyik sem „chore".

## Prior art

Külső (webes) prior art felmérés **szándékosan kimaradt**, és ez a szelet elfogadott korlátja:
a munka teljes egészében „töröljünk egy bizonyítottan halott, ebben a repóban definiált
config-recordot, és igazítsunk három belső javadocot az itteni kód valóságához". Nincs olyan
külső könyvtár, API vagy közösségi minta, amiről érdemi tanulás származna; a releváns
konvenció végig házon belüli.

**Belső precedens** (ez a mérvadó): a repo teljes történetében **nulla** törölt
`*Properties` record van (`git log --diff-filter=D` a `backend/src/main/java/**/config/*Properties.java`
felett üres), tehát nincs „deprecate-aztán-töröl" ceremónia, amit követni kellene. A legközelebbi
analógia egy nem-config nyugdíjazás: a fuel `KeretBelt` törlése (`docs/features/fuel.md:345`,
`mezo-c9t5` Task 4, ADR 0024). Ott a ház stílusa: **grep-igazolt nulla fogyasztó → egyenes
törlés egy szeletben**, a feature-doksiban rögzített *miért*-tel („zero remaining consumers,
grep-verified"), a hozzátartozó CSS/props-szal együtt. Ezt követjük.

A `MeWeekProperties`-nek nincs `@DeprecatedConfigurationProperty`-je és nincs
`spring-configuration-metadata` kiegészítő JSON-ja, tehát deprecation-ablakhoz sem lenne mit
hátrahagyni.

## Codebase terrain

### `MeWeekProperties` — a törlés terepe

- **A record:** `backend/src/main/java/io/mrkuhne/mezo/feature/companion/config/MeWeekProperties.java:1-31`.
  Csomag: `io.mrkuhne.mezo.feature.companion.config`. `@Validated` +
  `@ConfigurationProperties(prefix = "mezo.companion.me-week")`. Három komponens:
  `double sleepTargetH` (`@DecimalMin("0.1") @DecimalMax("24.0")`), `double kcalBand`
  (`@DecimalMin("0.01") @DecimalMax("1.0")`), `int xpBaseline` (`@Min(1) @Max(10000)`).
- **Regisztráció:** nincs `@EnableConfigurationProperties`, nincs explicit bean — a globális
  `@ConfigurationPropertiesScan` szedi fel (`backend/src/main/java/io/mrkuhne/mezo/MezoApplication.java:8`).
  **A fájl törlése elegendő; nincs szerkesztendő regisztrációs pont.**
- **Valódi kódhasználat: NINCS.** Teljes repo-grep (`target/`, `node_modules/`, `.git/` nélkül):
  nulla import, nulla konstruktor-paraméter, nulla mezőolvasás. Az egyetlen `sleepTargetH`-olvasó
  a fában a `DayEvaluationProperties` **saját** mezője.
- **Teszt: NINCS.** Sem unit, sem IT, sem test-resources yml nem hivatkozik a recordra vagy a
  kulcsaira.
- **yml:** pontosan egy blokk, a default profilban — `backend/src/main/resources/application.yml:1221-1225`,
  a `mezo: companion:` alatt, a `journal:` (1218-1220) és a `day-evaluation:` (1226+) blokkok között,
  bd-id-s komment-fejléccel (`# Weekly review (mezo-p2tr) — ...`). Az `application-demodata.yml`-ben
  nincs `me-week` blokk; más `application*.yml/properties` nem érinti.
- **Kulcsokra név szerinti hivatkozás máshol: NINCS.** A repóban egyáltalán nincs `@Value`
  (ArchUnit tiltja), és nincs `MEZO_COMPANION_ME_WEEK_*` env-var mapping docker-compose-ban,
  k8s-ben, `.env.example`-ben, READMÉ-ben vagy CI-ban.
- **Csak-javadoc említések (3, main sources):**
  - `feature/companion/service/DayScoreService.java:45-46` — „`{@code MeWeekProperties}` … it is
    retired with the rest of the legacy documentation sweep (Task 11), not silently here." Ez a
    szelet TODO-jelölője; törlendő/átírandó mondat.
  - `feature/companion/config/DayEvaluationProperties.java:17` — „a `{@code MeWeekProperties}`/
    `{@code QuarterlyProperties}` precedens" (stílus-hivatkozás).
  - `feature/proactive/config/DiagnosisProperties.java:10` — „in one documented home (the
    `{@code MeWeekProperties}` precedent)".
- **Doksik:** `docs/CODEMAP.md:286` (**generált**, `DO NOT EDIT BY HAND`),
  `docs/features/companion.md:1319`, `:3495`, `:5474`, `docs/features/me.md:749`,
  `docs/features/proactive.md:2773`.
- **Dátumozott, befagyasztott doksik** (`docs/superpowers/plans/*`, `docs/design_2.0/*`) érintetlenek
  maradnak — történeti tervek és auditok, nem élő feature-doksi.

### Névütközés-csapda

A `me-week` **egyben a contract-fragment neve is** (`api/feature/me-week/me-week.yml`,
`api/generate/merge.yml:39`) és az OpenAPI tag → `MeWeekApi`/`MeWeekController`/`MeWeekService`/
`MeWeekSubscores`. **Csak a `mezo.companion.me-week` config-prefix megy nyugdíjba**; a contract,
a tag, a controller, a service és a `MeWeekSubscores` négymezős wire-alak mind marad
(`DayScoreService.java:47-50` explicit módon változatlannak köti a wire-alakot). A
`MeWeekService.java:152` és `DayScoreService.java:49` `me-week` említései a contract-névre
vonatkoznak — **nem** nyúlunk hozzájuk.

### A két javadoc terepe

- `feature/companion/service/WeeklyScoreService.java:140-160` — a `resolve(...)` javadoc-ja
  (a metódus-szignatúra a 162. soron; a bd issue ~344-es horgonya elavult).
- `feature/companion/service/DayReviewService.java:317-327` — az `inputsHash(...)` javadoc-ja
  (a metódus a 328. soron; a ~178-as horgony az érintetlen `state(...)` javadocra mutat).
  A releváns ellenpont ugyanabban a fájlban: `userMessage(...)` javadoc :358, szignatúra :359-360,
  és a `priorBaseScores` nyers listájának promptba írása :386-389 (a lista a :157-en jön
  `inputs.priorBaseScores()`-ból, a `prose(...)`-on át :286 → :298).

## Amit szállítunk

### 1. `MeWeekProperties` nyugdíjazása (`mezo-jcpt.7`)

Egyenes törlés, egy commitban:

1. `MeWeekProperties.java` törlése.
2. Az `application.yml:1221-1225` blokk törlése **a bd-id-s komment-fejléccel együtt**; a
   szomszédos `journal:` és `day-evaluation:` blokkok és kommentjeik érintetlenül.
3. A három javadoc-precedens-hivatkozás átirányítása élő recordra
   (`DayEvaluationProperties` / `QuarterlyProperties` / `ProfileProperties`), hogy a konvenciónak
   maradjon élő horgonya:
   - `DayScoreService.java:45-46`: a „Task 11-ben nyugdíjazzuk" mondat **törlése** (a jövőidő
     tárgytalan, amint a record eltűnik).
   - `DayEvaluationProperties.java:17`: a `MeWeekProperties`/`QuarterlyProperties` párosból az
     előbbi helyére `ProfileProperties` (a `QuarterlyProperties` marad).
   - `DiagnosisProperties.java:10`: a „`MeWeekProperties` precedent" → `QuarterlyProperties`.
4. Feature-doksik:
   - `companion.md:5474` — a „**`config/MeWeekProperties.java` is now DEAD** … Left in place, not
     deleted" bullet cseréje `KeretBelt`-hangnemű törlés-bulletre (mi tűnt el, miért, és hogy a
     nulla fogyasztó grep-igazolt).
   - `companion.md:1319` és `:3495` — a már-nyugdíjazottként fogalmazó mondatok igazítása a
     megvalósult állapothoz (a doksi itt előre szaladt a kódhoz képest; a `.7` a kód javára oldja fel).
   - `me.md:749` és `proactive.md:2773` — a `feature/companion/config/MeWeekProperties.java`
     útvonal kivétele a §10 fájltérképekből.
5. `node scripts/gen-codemap.mjs` **ugyanabban a commitban** (a `docs/CODEMAP.md:286` sor
   ettől tűnik el; kézzel nem szerkesztjük).

**Sorrendi kikötés:** a record komponensei default nélküli primitívek, ezért a record és a
yml-blokk **matched pair**. A record törlése a yml-blokk hagyásával ártalmatlan (ismeretlen
kulcs, nincs `fail-on-unknown`); a yml-blokk törlése a record hagyásával **minden Spring-kontextust
eltör** a suite-ban. Ezért: együtt, egy commitban — soha nem yml-only.

**Elvesző érték, tudatosan:** a régi `me-week.sleep-target-h: 8.0` konstans nem migrálódik sehova;
a napi értékelés alvás-célja a `DayEvaluationProperties.sleepTargetH` (7.5), ami már ma is az
egyetlen olvasott érték. A `kcal-band: 0.25` és `xp-baseline: 150` fogyasztó nélküli maradék.

### 2. `WeeklyScoreService.resolve` javadoc (`mezo-jcpt.11` / 1)

A bekezdés egzaktság-állítása hamis. A javadoc azt írja, hogy probe-olt írás nélküli héten
„every day's base is null and the week's score is null by construction". Valójában a `training`
dimenzió státuszát a **terv** hajtja, nem a session: a `DayScoreService` a
`WorkoutWindowQueryService.windowsFor`-t olvassa, a frissesség-probe pedig **szándékosan kihagyja
az edzés-ütemterv táblákat**. Egy tervezett edzésekkel bíró, nulla loggal záruló hét napjain
`training` DONE (30) + `logging` DONE (őszinte 0) = **két intrinsic DONE dimenzió**, a
2-dimenziós kapu kinyílik, a napi base ~20-35 — miközben a `resolve` null-t ad vissza és törli a
cache-sort.

Az átírás: a shortcut **nem egzakt** ebben az egy esetben; ez **elfogadott korlát**, nem hiba,
és a javadoc horgonyozza a meglévő korlát-dokumentációhoz
(`WeeklyScoreRepository:55-58` / `latestScoreInputWrittenAt`), ami már ma is kimondja, hogy a probe
nem fedi az ütemterv-táblákat. A „(Before that fix the shortcut was NOT exact …)" zárójeles
történeti mondat is felülvizsgálandó, mert azt sugallja, a rés bezárult.

**Kód nem változik** — a futásidejű viselkedés előzetesen ismert és elfogadott.

### 3. `DayReviewService.inputsHash` javadoc (`mezo-jcpt.11` / 2)

A javadoc azt állítja, a hashelt mezők „everything the prose was shown — `{@link #userMessage}`
hands the model exactly these fields". Ez **tényszerűen hamis**: a `userMessage` a nyers
`priorBaseScores` listát is beleírja a promptba („Előző napok base-pontjai: …", :386-389), és ez
nincs a kulcsban.

**Döntés (user, 2026-09-04): csak a javadoc javul, a kulcs nem bővül.** Az új szöveg kimondja:

- a kulcs a dimenziók (`id|score|status` + tények) és a nap `base`-e felett képződik;
- a `priorBaseScores` nyers listája **látszik** a modellnek, de **szándékosan kimarad** a kulcsból,
  mert a ritmus dimenzió score-ja és tényei már benne vannak — a prior-lista minden **érdemi**
  mozdulása azokon keresztül úgyis bustelja a cache-t;
- ami marad, az egy **szűk, elfogadott rés**: olyan prior-lista-változás, ami sem a ritmus
  score-t, sem a tényeit nem mozdítja, azonos hasht hagy eltérő prompt-szöveg mellett. A narratíva
  ritkán idézi a nyers listát, ezért a design nem hibás — csak az eddigi állítás volt túl erős.

**Kód nem változik.** A rést nem visszük külön follow-up issue-ba: a fenti bekezdés maga a
dokumentált elfogadás.

## Nem-célok

- A `resolve` shortcut és a napi motor közti valódi divergencia **megszüntetése** (a probe
  kiterjesztése az ütemterv-táblákra) — külön kérdés, nincs napirenden.
- A `priorBaseScores` bevonása az `inputsHash`-be — explicit user-döntéssel kimarad.
- A `me-week` **contract**, tag, controller, service vagy a `MeWeekSubscores` wire-alak bármilyen
  érintése.
- Dátumozott tervek/auditok (`docs/superpowers/plans/*`, `docs/design_2.0/*`) frissítése. Külön
  megjegyzés: `docs/design_2.0/2026-08-27-heti-feature-audit.md:284` már ma is elavult
  sor-horgonyt (`application.yml:1068-1072`) idéz — **szándékosan nem** nyúlunk hozzá.

## Verifikáció

- **A valódi éles vezeték a boot-idejű validáció**, ezért a fókuszált bizonyíték a
  Spring-kontextus betöltése: `MezoApplicationIT`, kötelezően
  `-Dmezo.test.use-testcontainers=true`-val (a default fixed-DB mód versenyhelyzetet csinál és
  hamis bukást ad).
- `DayEvaluationPropertiesTest` (kontextus nélküli, olcsó) — a túlélő config-record épsége.
- `node scripts/gen-codemap.mjs --check` zöld (CI `ci.yml:37` gate), és
  `node --test scripts/gen-codemap.test.mjs`.
- Frontend **nem érintett** (a record sosem volt a dróton) — FE gate-ek nem futnak külön ehhez.
- A teljes backend IT-suite az authoritatív self-PR CI-n fut, nem lokálisan.

## Kockázat

Gyakorlatilag nulla. Egyetlen éles vezeték a boot-idejű config-validáció, azt a kontextus-IT
lefedi; minden más doksi- és komment-szöveg. ArchUnit-szempontból a törlés csak lazíthat
(a `feature_slices_are_cycle_free` frozen store-ját nem sérti), és nincs `..config..`-ra vonatkozó
elhelyezési szabály. **Egy csapda marad:** a három konstanst tilos `@Value`-ként bárhova
„beinline-olni" — az ArchUnit `no_spring_value_annotation` szabálya (`ArchitectureTest.java:90-103`)
kemény bukás.
