# Köteg A — elavult javadocok + `MeWeekProperties` nyugdíjazása — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Két tényszerűen hamis javadoc-állítás javítása a napi értékelés körül (`mezo-jcpt.11`), és a bizonyítottan halott `MeWeekProperties` config-record + yml-blokkja törlése a rá mutató kód- és doksi-hivatkozásokkal együtt (`mezo-jcpt.7`).

**Architecture:** Backend-only takarítás, három független darabban. Task 1 és Task 2 **kizárólag javadoc-szöveget** ír át (nulla viselkedésváltozás, nulla új teszt). Task 3 egy `@ConfigurationProperties` recordot és a hozzá tartozó `application.yml` blokkot törli **egyetlen commitban** (default nélküli primitívek → matched pair), átvezeti a három rá hivatkozó javadocot és a négy doksit, majd regenerálja a `docs/CODEMAP.md`-t. A verifikáció a Spring-kontextus betöltése.

**Tech Stack:** Java 21 / Spring Boot (`@ConfigurationPropertiesScan`), Maven (`./mvnw`), JUnit 5 + Testcontainers, Node (`scripts/gen-codemap.mjs`).

**Spec:** [`docs/superpowers/specs/2026-09-04-jcpt-koteg-a-chore-design.md`](../specs/2026-09-04-jcpt-koteg-a-chore-design.md)

## Global Constraints

- **Egy branch, egy PR mindkét bd issue-ra:** `feat/jcpt-koteg-a-chore` (a „1 bd issue + 1 branch" házirend user-jóváhagyott felülbírálása; indoklás a `mezo-jcpt` epic 2026-09-04-i kommentjében). A commit-subjectek a hajtó bd id-t viszik: `mezo-jcpt.11` a Task 1-2-höz, `mezo-jcpt.7` a Task 3-hoz.
- **Minden commit-üzenet záró sora:** `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`
- **`docs/CODEMAP.md` KÉZZEL NEM SZERKESZTHETŐ** (a fájl első sora `DO NOT EDIT BY HAND`). Kizárólag `node scripts/gen-codemap.mjs` regenerálja, és ugyanabban a commitban, amiben a Java-fájl eltűnik — a CI (`.github/workflows/ci.yml:37`) `--check`-kel gate-eli.
- **Tilos `@Value`** bárhol a kódbázisban — az ArchUnit `no_spring_value_annotation` szabálya (`backend/src/test/java/io/mrkuhne/mezo/ArchitectureTest.java:90-103`) kemény bukás. A törölt három konstanst tilos így „beinline-olni" (amúgy sem kell sehova).
- **Testcontainers kötelező** minden Spring-kontextust indító teszthez: `-Dmezo.test.use-testcontainers=true`. A default fixed-DB mód versenyhelyzetet csinál és hamis bukást ad.
- **A `me-week` CONTRACT nem érintett.** Csak a `mezo.companion.me-week` **config-prefix** megy nyugdíjba. Marad: `api/feature/me-week/me-week.yml`, az OpenAPI tag, `MeWeekApi`/`MeWeekController`/`MeWeekService`, a `MeWeekSubscores` négymezős wire-alak, és minden `me-week` említés, ami ezekre vonatkozik (pl. `MeWeekService.java:152`, `DayScoreService.java:49`).
- **Dátumozott tervek/auditok nem frissülnek:** `docs/superpowers/plans/*` (a jelen fájlon kívül), `docs/design_2.0/*`. Történeti dokumentumok. Külön ismert, szándékosan nem javított elavulás: `docs/design_2.0/2026-08-27-heti-feature-audit.md:284` régi sor-horgonyt idéz.
- **Frontend nem érintett** — a record sosem volt a dróton. FE-tesztet/buildet ez a szelet nem futtat.
- A sorszámozott sor-horgonyok a `2551d122f` (`origin/main`) állapotra vonatkoznak. Ha egy horgony nem stimmel, a **szöveget** keresd (`grep`), ne a sorszámot kövesd vakon.

---

### Task 1: `WeeklyScoreService.resolve` javadoc — a shortcut nem egzakt (`mezo-jcpt.11` / 1)

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/WeeklyScoreService.java:141-161` (a `resolve(...)` javadoc; a metódus-szignatúra a 162. soron)
- Test: nincs. **Ez egy komment-változtatás — nem indokolt teszt, mert nincs viselkedés, amit rögzíthetne.** A helyesség bizonyítéka a hivatkozott kód elolvasása (lásd Step 1) és a fordítás.

**Interfaces:**
- Consumes: semmit korábbi taskból.
- Produces: semmit — se szignatúra, se típus nem változik. Task 2 és Task 3 független ettől.

**Miért hamis a jelenlegi szöveg:** azt állítja, hogy probe-olt írás nélküli héten „every day's base is null and the week's score is null by construction". A `training` dimenzió státuszát azonban a **terv** hajtja, nem a logolt session: a `DayScoreService` a `WorkoutWindowQueryService.windowsFor`-t olvassa, a frissesség-probe pedig szándékosan kihagyja az edzés-ütemterv táblákat. Tervezett edzésekkel bíró, nulla loggal záruló héten `training` DONE + `logging` DONE = **két intrinsic DONE dimenzió**, a 2-dimenziós kapu kinyílik, a napi base ~20-35, miközben ez a metódus null-t ad és törli a cache-sort.

- [ ] **Step 1: Olvasd el a bizonyítékot, mielőtt írsz**

Ez a lépés nem opcionális: a javadoc új szövege állításokat tesz a szomszéd kódról, és a rossz állítás cseréje egy másik rossz állításra a legrosszabb kimenet.

```bash
sed -n '40,70p' backend/src/main/java/io/mrkuhne/mezo/feature/companion/repository/WeeklyScoreRepository.java
grep -n "windowsFor" backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/DayScoreService.java
```

Amit látnod kell: (a) a `latestScoreInputWrittenAt` javadoc-ja már ma is felsorolja az **edzés-ütemterv táblákat mint szándékos kihagyást** (`gym_schedule_slot`, `sport_schedule_slot`, `sport_event`, `running_block`), kimondva, hogy „a schedule edit does not invalidate a cached week"; (b) a `DayScoreService` tényleg a `windowsFor`-on át kapja a training planned/done felosztást. Az új javadoc ehhez a meglévő korlát-dokumentációhoz horgonyoz.

- [ ] **Step 2: Cseréld le a javadocot**

A jelenlegi (törlendő) blokk a `/**`-tól a `*/`-ig, közvetlenül a `private WeeklyScoreEntity resolve(UUID userId, LocalDate weekStart, WeeklyScoreEntity cached) {` sor előtt. Az új szöveg:

```java
    /**
     * The cache decision for ONE week: serve {@code cached} when it is still valid, otherwise
     * recompute and re-cache. Returns null when the week genuinely has no score.
     *
     * <p>The cheap path first: when the week's window holds no score-relevant log at all, this
     * path returns null without computing anything. Under the 6-dimension engine (mezo-jcpt.4)
     * that shortcut is a deliberate APPROXIMATION, not an identity. With no log in the window,
     * nutrition and quality have no meal and sleep has no {@code sleep_log}, so those degrade;
     * {@code logging} is DONE with an honest 0 (it measures effort, and no effort is a real
     * measurement); {@code rhythm} may well be DONE, because it reads the days BEFORE this week,
     * outside the probe's window. {@code rhythm} is excluded from the engine's gate (it does not
     * measure the day itself), so on a week with no training PLAN {@code logging} alone is ONE
     * intrinsic dimension, one short of the 2-dimension gate: every day's base is null and the
     * week's score is null. There the shortcut is exact.
     *
     * <p><b>Where it is NOT exact (accepted limitation, mezo-jcpt.11).</b> The {@code training}
     * dimension is driven by the PLAN, not by a logged session: {@code DayScoreService} reads
     * {@code WorkoutWindowQueryService.windowsFor}, and the probe deliberately does not cover the
     * training schedule tables. So a week that has planned workouts and closes with zero logs has
     * {@code training} DONE and {@code logging} DONE — two intrinsic DONE dimensions, the gate
     * opens, and each day carries a real base (~20-35) in the engine's terms while this path
     * returns null and deletes the cached row. That is the same trade-off spelled out on
     * {@link WeeklyScoreRepository#latestScoreInputWrittenAt}, which lists exactly which tables
     * the probe covers — notably NOT the training schedule tables, so a schedule edit alone does
     * not invalidate a cached week.
     */
```

Figyelj: a régi szöveg záró zárójeles mondata („(Before that fix the shortcut was NOT exact in exactly this case …)") **is törlendő** — azt sugallja, hogy a rés bezárult, holott nem.

- [ ] **Step 3: Fordítsd le**

```bash
cd backend && ./mvnw -q -o compile
```

Várt: BUILD SUCCESS. (Ha a `-o` offline mód nem megy, hagyd el.) Ez a lépés a `{@link WeeklyScoreRepository#latestScoreInputWrittenAt}` horgony épségét is ellenőrzi — hibás `@link` javadoc-warningot ad.

- [ ] **Step 4: Ellenőrizd, hogy tényleg csak komment változott**

```bash
git diff --stat
git diff -U0 | grep -E '^\+' | grep -vE '^\+\s*(\*|/\*\*)' | grep -v '^+++'
```

Várt: az első parancs EGY fájlt mutat (`WeeklyScoreService.java`); a második parancs **semmit nem ír ki** — minden hozzáadott sor javadoc-sor.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/WeeklyScoreService.java
git commit -m "docs(companion): a heti cache-shortcut nem egzakt tervezett edzéseknél (mezo-jcpt.11)

A resolve javadoc azt állította, hogy log nélküli héten minden nap base-e
null by construction. A training dimenziót a TERV hajtja (windowsFor), a
frissesség-probe pedig kihagyja az ütemterv-táblákat, így tervezett
edzésekkel + nulla loggal a kapu kinyílik és a napi base ~20-35 — miközben
ez a path null-t ad. Elfogadott korlát, a WeeklyScoreRepository
latestScoreInputWrittenAt korlát-listájához horgonyozva.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: `DayReviewService.inputsHash` javadoc — a `priorBaseScores` rés (`mezo-jcpt.11` / 2)

**Files:**
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/DayReviewService.java:317-327` (az `inputsHash(...)` javadoc; a metódus a 328. soron)
- Test: nincs. **Komment-változtatás; a kulcs képzése SZÁNDÉKOSAN nem változik** (user-döntés, 2026-09-04) — épp ezért nincs új teszt sem, amit rögzíthetne.

**Interfaces:**
- Consumes: semmit korábbi taskból.
- Produces: semmit. `static String inputsHash(DayEvaluation evaluation)` szignatúrája és viselkedése változatlan.

**Miért hamis a jelenlegi szöveg:** azt írja, a hashelt mezők „everything the prose was shown — {@link #userMessage} hands the model exactly these fields". A `userMessage` viszont a nyers `priorBaseScores` listát is beleírja a promptba, és az nincs a kulcsban.

- [ ] **Step 1: Olvasd el a bizonyítékot**

```bash
grep -n "priorBaseScores" backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/DayReviewService.java
sed -n '355,392p' backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/DayReviewService.java
sed -n '328,352p' backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/DayReviewService.java
```

Amit látnod kell: a lista a hívási láncon (`inputs.priorBaseScores()` → `prose(...)` → `userMessage(...)`) jut a promptba, ahol nyersen kiíródik („Előző napok base-pontjai (a ritmus dimenzió alapja): …"), az `inputsHash` törzse viszont **csak** a dimenziókat (`id|score|status` + tények) és a `base`-t hasheli.

- [ ] **Step 2: Cseréld le a javadocot**

A `static String inputsHash(DayEvaluation evaluation) throws NoSuchAlgorithmException {` előtti javadoc-blokk teljes cseréje:

```java
    /**
     * The cache key: {@code sha256} over each dimension's {@code id|score|status} AND its facts
     * (in the engine's fixed order, the facts in their own emission order) plus the day's
     * {@code base}. The narrative typically QUOTES the facts ("312 g szénhidrát"), so the facts
     * must be in the key: dimension scores are integers 0..100, so a retroactive log can move a
     * fact (carbs 312 g → 280 g) without moving the rounded score, and a facts-free key would keep
     * serving a narrative quoting the old number (review round 2, Minor).
     *
     * <p><b>What the prompt sees and the key does not (mezo-jcpt.11).</b> {@link #userMessage} is
     * handed two further inputs, both deliberately outside the key. The unscored context signals
     * are re-read fresh on every call and never fold into a cached sentence's correctness. The raw
     * {@code priorBaseScores} list IS written into the prompt ("Előző napok base-pontjai"), and
     * stays out of the key because the {@code rhythm} dimension is computed FROM that list and
     * {@code rhythm}'s own score and facts are already hashed: every prior-day change that matters
     * moves the key through {@code rhythm}. What remains is a narrow, accepted gap — a change to
     * the prior list that moves neither {@code rhythm}'s score nor its facts leaves the key
     * identical while the prompt text differs. The prose rarely quotes the raw list, so the cached
     * sentence stays true.
     */
```

- [ ] **Step 3: Fordítsd le**

```bash
cd backend && ./mvnw -q -o compile
```

Várt: BUILD SUCCESS.

- [ ] **Step 4: Ellenőrizd, hogy tényleg csak komment változott**

```bash
git diff --stat
git diff -U0 | grep -E '^\+' | grep -vE '^\+\s*(\*|/\*\*)' | grep -v '^+++'
```

Várt: EGY fájl (`DayReviewService.java`), és a második parancs semmit nem ír ki.

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/DayReviewService.java
git commit -m "docs(companion): az inputsHash nem fedi a priorBaseScores-t (mezo-jcpt.11)

A javadoc azt állította, a kulcs mindent tartalmaz, amit a próza látott. A
userMessage a nyers priorBaseScores listát is a promptba írja, az viszont
nincs a kulcsban. A kulcs SZÁNDÉKOSAN marad változatlan (a ritmus dimenzió
score-ja és tényei már hashelve vannak, azokon át minden érdemi változás
bustelja a cache-t); a maradék szűk rés dokumentálva.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: `MeWeekProperties` nyugdíjazása (`mezo-jcpt.7`)

**Files:**
- Delete: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/config/MeWeekProperties.java`
- Modify: `backend/src/main/resources/application.yml:1221-1225` (a `me-week:` blokk törlése a komment-fejlécével)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/service/DayScoreService.java:44-46` (osztály-javadoc)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/companion/config/DayEvaluationProperties.java:16-17` (precedens-hivatkozás)
- Modify: `backend/src/main/java/io/mrkuhne/mezo/feature/proactive/config/DiagnosisProperties.java:9-10` (precedens-hivatkozás)
- Modify: `docs/features/companion.md:1319`, `:3495`, `:5474`
- Modify: `docs/features/me.md:749`
- Modify: `docs/features/proactive.md:2773`
- Regenerate: `docs/CODEMAP.md` (kézzel NEM)
- Test: **nincs új teszt.** A törlés bizonyítéka a meglévő `backend/src/test/java/io/mrkuhne/mezo/MezoApplicationIT.java` kontextus-betöltése — ez a record egyetlen éles vezetéke (boot-idejű validáció).

**Interfaces:**
- Consumes: semmit korábbi taskból (Task 1 és Task 2 más fájlokat érint; a sorrend szabad).
- Produces: `io.mrkuhne.mezo.feature.companion.config.MeWeekProperties` **megszűnik létezni**. Az utána következő bármely munka a `DayEvaluationProperties`-t használja (`sleepTargetH` = 7.5); a `kcalBand` és `xpBaseline` konstansoknak nincs utódjuk, mert nincs fogyasztójuk.

**KRITIKUS sorrendi kikötés:** a record komponensei default nélküli primitívek, ezért a record és a yml-blokk **matched pair**. A record törlése a yml-blokk hagyásával ártalmatlan (ismeretlen kulcs, nincs `fail-on-unknown`), de a **yml-blokk törlése a record hagyásával minden Spring-kontextust eltör** a suite-ban (a hiányzó blokk 0.0/0-t kötne, ami megbukik a `@DecimalMin`/`@Min` validáción). Ezért a kettő EGY commitban megy — soha nem yml-only, és soha nem külön lépésben commitolva.

- [ ] **Step 1: Igazold újra, hogy tényleg nulla fogyasztó van**

Ne a tervben bízz — a `main` mozoghatott azóta.

```bash
grep -rn "MeWeekProperties" backend/src frontend/src api scripts .github 2>/dev/null
grep -rn "me-week\|me_week\|ME_WEEK" backend/src/main/resources backend/src/test/resources
```

Várt az elsőre: **kizárólag** javadoc/komment-találatok a `DayScoreService.java`, `DayEvaluationProperties.java`, `DiagnosisProperties.java` fájlokban, plusz maga a `MeWeekProperties.java`. **Ha bármi injektálást, mezőolvasást vagy importot látsz, ÁLLJ MEG** és jelezd — a szelet előfeltétele dőlt meg.
Várt a másodikra: egyetlen blokk az `application.yml`-ben (1221-1225 környékén); a test-resources nem tartalmaz `me-week`-et.

- [ ] **Step 2: Töröld a recordot és a yml-blokkot (egy lépésben)**

```bash
git rm backend/src/main/java/io/mrkuhne/mezo/feature/companion/config/MeWeekProperties.java
```

Az `application.yml`-ből töröld ezt az ÖT sort (a komment-fejléccel együtt), a szomszédos `journal:` és `day-evaluation:` blokkokat és kommentjeiket **érintetlenül hagyva**:

```yaml
    # Weekly review (mezo-p2tr) — deterministic day-score constants (spec §2).
    me-week:
      sleep-target-h: 8.0
      kcal-band: 0.25
      xp-baseline: 150
```

Ellenőrzés (a `journal:` blokkot közvetlenül a `day-evaluation:` kommentje kövesse):

```bash
grep -n -A2 "decision-review-days" backend/src/main/resources/application.yml
```

- [ ] **Step 3: Vezesd át a három javadoc-hivatkozást**

`DayScoreService.java` — a mondat, ami a **jövőbeli** nyugdíjazást ígérte, most tárgytalan. Ezt:

```java
 * bit-for-bit, verified in Task 4). {@code MeWeekProperties} consequently has no reader left — it
 * is retired with the rest of the legacy documentation sweep (Task 11), not silently here.
```

cseréld erre:

```java
 * bit-for-bit, verified in Task 4). The legacy formula's tuning record {@code MeWeekProperties}
 * lost its last reader here and was deleted with its yml block (mezo-jcpt.7).
```

`DayEvaluationProperties.java` — a törölt record már nem lehet élő stílus-precedens:

```java
 * CompanionProperties} nested component (the {@code MeWeekProperties}/{@code
 * QuarterlyProperties} precedent). Picked up by {@code @ConfigurationPropertiesScan}.
```

→

```java
 * CompanionProperties} nested component (the {@code ProfileProperties}/{@code
 * QuarterlyProperties} precedent). Picked up by {@code @ConfigurationPropertiesScan}.
```

`DiagnosisProperties.java`:

```java
 * depend on, in one documented home (the {@code MeWeekProperties} precedent). Picked up by
```

→

```java
 * depend on, in one documented home (the {@code QuarterlyProperties} precedent). Picked up by
```

- [ ] **Step 4: Vezesd át a feature-doksikat**

`docs/features/companion.md` §3 (~1319) — a mondat már ma is nyugdíjazottként fogalmaz, most legyen egyértelmű, hogy törölve is van:

- keresd: `record, is retired with them — the day target it once held is`
- legyen: `record, was DELETED with them (`mezo-jcpt.7`) — the day target it once held is`

`docs/features/companion.md` config-tábla (~3495):

- keresd: `` the legacy `MeWeekProperties.sleepTargetH` — `8.0` — is retired with that record ``
- legyen: `` the legacy `MeWeekProperties.sleepTargetH` — `8.0` — went with that record, deleted in `mezo-jcpt.7` ``

`docs/features/companion.md` §10 bullet (~5474) — a teljes bullet cseréje (ez a „még a lemezen van" állítás, amit a szelet felold; a hangnem a `docs/features/fuel.md:345` `KeretBelt`-törlés mintája):

```markdown
- **`config/MeWeekProperties.java` is DELETED** (`mezo-jcpt.7`) — the legacy formula it configured is gone (§3), and a full-repo grep found zero readers: no injection, no field read, no test, no `@Value` (ArchUnit forbids it), no env-var/compose/CI mapping. The record and its `mezo.companion.me-week` block in `application.yml` were removed **together**: the record's components are primitives with no defaults, so the two are a matched pair and a yml-only removal would fail validation in every Spring context. The `me-week` **contract** (the `api/feature/me-week` fragment, the OpenAPI tag, `MeWeekController`/`MeWeekService`, the `MeWeekSubscores` wire shape) is untouched — only the config prefix retired. The `sleep-target-h: 8.0` it carried has no successor: the day evaluation's only sleep target is `DayEvaluationProperties.sleepTargetH` (`7.5`), and `kcal-band`/`xp-baseline` had no reader left at all.
```

`docs/features/me.md:749` — vedd ki a fájl-útvonalat a §10 listából:

- keresd: `` `feature/companion/controller/MeWeekController.java`, `feature/companion/config/MeWeekProperties.java`, `feature/companion/WeekReviewSource.java` ``
- legyen: `` `feature/companion/controller/MeWeekController.java`, `feature/companion/WeekReviewSource.java` ``

`docs/features/proactive.md:2773` — ugyanaz a kereszt-lista:

- keresd: `` `feature/companion/controller/MeWeekController.java`, `feature/companion/config/MeWeekProperties.java`, `feature/companion/WeekReviewSource.java` ``
- legyen: `` `feature/companion/controller/MeWeekController.java`, `feature/companion/WeekReviewSource.java` ``

Ellenőrzés — élő doksiban nem maradhat hivatkozás:

```bash
grep -rn "MeWeekProperties" docs/features docs/CODEMAP.md
```

Várt ezen a ponton: `docs/features/companion.md` három helye (mind a törlésről szól, múlt időben) és `docs/CODEMAP.md:286` (a következő lépés törli). `me.md`/`proactive.md`: nulla találat.

- [ ] **Step 5: Regeneráld a CODEMAP-ot**

```bash
node scripts/gen-codemap.mjs
node scripts/gen-codemap.mjs --check
git diff --stat docs/CODEMAP.md
```

Várt: a `--check` zöld, és a diff a companion **config** rosterből kiveszi a `MeWeekProperties`-t. Ha a generátor más, nem kapcsolódó sorokat is mozgat (mert a `main` közben elmozdult), az rendben van — a generált fájl az igazság, nem a diff mérete.

- [ ] **Step 6: Bizonyítsd, hogy a kontextus felmegy**

Ez a task egyetlen valódi tesztje: a boot-idejű config-validáció.

```bash
cd backend && ./mvnw clean test -Dtest='MezoApplicationIT,DayEvaluationPropertiesTest' \
  -Dmezo.test.use-testcontainers=true -DargLine="-Xmx2g"
```

Várt: BUILD SUCCESS, mindkét teszt lefut (0 failure, 0 error). **A `-Dmezo.test.use-testcontainers=true` nem elhagyható** — nélküle a fixed-DB mód versenyhelyzete hamis bukást ad.
Ha a kontextus **elhasal** `Binding to target ... me-week` vagy `ConfigurationPropertiesBindException` üzenettel, akkor maradt egy record-példány vagy egy yml-blokk fél kézzel törölve — nézd újra a Step 2-t.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore(companion): MeWeekProperties nyugdíjazása — halott config törlése (mezo-jcpt.7)

A mezo-jcpt.4 Task 5 óta a DayScoreService a DayEvaluationProperties-ből
olvas; a MeWeekProperties-nek nulla fogyasztója maradt (grep-igazolt: nincs
injektálás, mezőolvasás, teszt, @Value vagy env-var mapping), miközben az
application.yml blokkja minden bootnál validálódott.

A record és a mezo.companion.me-week yml-blokk EGYÜTT megy: a komponensek
default nélküli primitívek, így yml-only törlés minden Spring-kontextust
eltörne. A három rá mutató javadoc-precedens élő recordra irányítva, a
companion/me/proactive §10 fájltérképek átvezetve, CODEMAP regenerálva.

A me-week CONTRACT (fragment, tag, controller, service, MeWeekSubscores
wire-alak) érintetlen — csak a config-prefix megy nyugdíjba.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Zárás — PR mint CI-kapu

**Files:** nincs kód-változás.

**Interfaces:**
- Consumes: Task 1-3 commitjai a `feat/jcpt-koteg-a-chore` branchen.
- Produces: nyitott self-PR, ami a teljes suite authoritatív gate-je.

- [ ] **Step 1: Frissíts a mozgó `main`-hez**

A `main` PR-nyitás ELŐTT és UTÁN is mozoghat (párhuzamos sessionök merge-elnek). Mindig a **remote**-ot vedd alapul, ne a lokális `main`-t.

```bash
git fetch origin
git merge origin/main
```

Konfliktus a `.beads/issues.jsonl`-ben: bármelyik oldalt elfogadhatod, a pre-commit hook újraexportálja az igazságot Doltból.

- [ ] **Step 2: Merge után futtasd újra a gate-eket**

```bash
node scripts/gen-codemap.mjs && node scripts/gen-codemap.mjs --check
node scripts/lint-liquibase.mjs
cd backend && ./mvnw clean test -Dtest='MezoApplicationIT,DayEvaluationPropertiesTest' \
  -Dmezo.test.use-testcontainers=true -DargLine="-Xmx2g"
```

Ha a codemap elmozdult a merge miatt, commitold a regenerált fájlt.

- [ ] **Step 3: Push és PR**

```bash
git push -u origin feat/jcpt-koteg-a-chore
gh pr create --title "chore(companion): elavult javadocok + MeWeekProperties nyugdíjazása (mezo-jcpt.11, mezo-jcpt.7)" --body "..."
```

A PR-leírás sorolja fel a két bd issue-t, mondja ki a kötegelés user-jóváhagyott házirend-felülbírálását, és záruljon a `🤖 Generated with [Claude Code](https://claude.com/claude-code)` sorral.

- [ ] **Step 4: CI zöld megvárása**

```bash
gh pr checks --watch
```

**Ha piros: az ELSŐ lépés nem a saját kód gyanúsítása**, hanem `git fetch origin && git merge origin/main`, majd codemap-regen + liquibase-lint + a fókuszált tesztek újrafuttatása. A `main` mozgása stale codemapet és látszólagos lint-bukást okoz akkor is, ha a branch hibátlan.

- [ ] **Step 5: bd zárás**

```bash
bd close mezo-jcpt.11 mezo-jcpt.7
bd dolt push
```

**A merge NEM ebben a worktree-ben történik** — worktree-izolált session nem futhat git-műveletet a fő checkouton. A `--no-ff` merge-öt a user végzi a fő checkouton, vagy a GitHub PR-felület.
